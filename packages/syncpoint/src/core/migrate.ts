import { copyFile, readFile, writeFile } from 'node:fs/promises';

import YAML from 'yaml';

import configSchema from '../../assets/schemas/config.schema.json';
import { validateConfig } from '../schemas/config.schema.js';
import { readAsset } from '../utils/assets.js';
import { fileExists } from '../utils/paths.js';
import type { MigrateResult } from '../utils/types.js';
import { getConfigPath } from './config.js';

/**
 * Extract all leaf field paths from a JSON Schema object.
 */
function extractSchemaPaths(
  schema: Record<string, unknown>,
  prefix: string[] = [],
): string[][] {
  const paths: string[][] = [];
  const properties = schema.properties as
    | Record<string, Record<string, unknown>>
    | undefined;
  if (!properties) return paths;

  for (const [key, value] of Object.entries(properties)) {
    const currentPath = [...prefix, key];
    if (value.type === 'object' && value.properties) {
      paths.push(
        ...extractSchemaPaths(value as Record<string, unknown>, currentPath),
      );
    } else {
      paths.push(currentPath);
    }
  }
  return paths;
}

/**
 * Extract all leaf field paths from a plain config object.
 */
function extractDataPaths(
  data: unknown,
  prefix: string[] = [],
): string[][] {
  const paths: string[][] = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) return paths;

  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const currentPath = [...prefix, key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      paths.push(...extractDataPaths(value, currentPath));
    } else {
      paths.push(currentPath);
    }
  }
  return paths;
}

function pathKey(path: string[]): string {
  return path.join('.');
}

function getNestedValue(obj: unknown, path: string[]): unknown {
  let current = obj;
  for (const key of path) {
    if (!current || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

export interface DiffResult {
  added: string[][];
  removed: string[][];
  existing: string[][];
}

export function diffConfigFields(userData: unknown): DiffResult {
  const schemaPaths = extractSchemaPaths(
    configSchema as Record<string, unknown>,
  );
  const templateData = YAML.parse(readAsset('config.default.yml'));
  const templatePaths = extractDataPaths(templateData);
  const userPaths = extractDataPaths(userData);

  const schemaKeys = new Set(schemaPaths.map(pathKey));
  const userKeys = new Set(userPaths.map(pathKey));

  return {
    // Fields present in template with defaults AND valid in schema, but missing from user
    added: templatePaths.filter((p) => {
      const key = pathKey(p);
      return schemaKeys.has(key) && !userKeys.has(key);
    }),
    // Fields in user but not in schema (truly deprecated)
    removed: userPaths.filter((p) => !schemaKeys.has(pathKey(p))),
    // Fields in user AND in schema (preserve user values)
    existing: userPaths.filter((p) => schemaKeys.has(pathKey(p))),
  };
}

export function buildMigratedDocument(
  templateText: string,
  userData: unknown,
  diff: DiffResult,
): string {
  const doc = YAML.parseDocument(templateText);

  // Preserve user values for existing fields
  for (const path of diff.existing) {
    const userValue = getNestedValue(userData, path);
    if (userValue === undefined) continue;

    const node = doc.getIn(path, true);
    if (YAML.isScalar(node)) {
      // Preserve inline comment, replace value only
      node.value = userValue;
    } else {
      // For arrays/complex types, fully replace
      doc.setIn(path, userValue);
    }
  }

  let output = doc.toString();

  // Append deprecated fields as comments
  if (diff.removed.length > 0) {
    const lines: string[] = [
      '',
      '# [deprecated] The following fields are no longer in the current schema.',
      '# They have been preserved as comments for reference.',
    ];

    for (const path of diff.removed) {
      const value = getNestedValue(userData, path);
      const valueStr =
        typeof value === 'object' ? JSON.stringify(value) : String(value);
      lines.push(`# [deprecated] ${path.join('.')}: ${valueStr}`);
    }

    output += lines.join('\n') + '\n';
  }

  return output;
}

export async function migrateConfig(options?: {
  dryRun?: boolean;
}): Promise<MigrateResult> {
  const configPath = getConfigPath();

  if (!(await fileExists(configPath))) {
    throw new Error(
      `Config file not found: ${configPath}\nRun "syncpoint init" first.`,
    );
  }

  const userText = await readFile(configPath, 'utf-8');
  const userData = YAML.parse(userText);
  const templateText = readAsset('config.default.yml');
  const diff = diffConfigFields(userData);

  // No migration needed
  if (diff.added.length === 0 && diff.removed.length === 0) {
    return {
      added: [],
      deprecated: [],
      preserved: diff.existing.map(pathKey),
      backupPath: '',
      migrated: false,
    };
  }

  const result: MigrateResult = {
    added: diff.added.map(pathKey),
    deprecated: diff.removed.map(pathKey),
    preserved: diff.existing.map(pathKey),
    backupPath: '',
    migrated: false,
  };

  if (!options?.dryRun) {
    const migratedText = buildMigratedDocument(templateText, userData, diff);

    // Backup existing config
    const backupPath = configPath + '.bak';
    await copyFile(configPath, backupPath);
    result.backupPath = backupPath;

    // Write migrated config
    await writeFile(configPath, migratedText, 'utf-8');

    // Validate the result
    const migrated = YAML.parse(migratedText);
    const validation = validateConfig(migrated);
    if (!validation.valid) {
      // Restore from backup on validation failure
      await copyFile(backupPath, configPath);
      throw new Error(
        `Migration produced invalid config (restored from backup):\n${(validation.errors ?? []).join('\n')}`,
      );
    }

    result.migrated = true;
  }

  return result;
}
