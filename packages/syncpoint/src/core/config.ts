import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import YAML from 'yaml';

import {
  BACKUPS_DIR,
  CONFIG_FILENAME,
  LOGS_DIR,
  SCRIPTS_DIR,
  TEMPLATES_DIR,
  getAppDir,
  getSubDir,
} from '../constants.js';
import { validateConfig } from '../schemas/config.schema.js';
import { readAsset } from '../utils/assets.js';
import { ensureDir, fileExists } from '../utils/paths.js';
import type { SyncpointConfig } from '../utils/types.js';

function stripDangerousKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(stripDangerousKeys);
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) continue;
    cleaned[key] = stripDangerousKeys(value);
  }
  return cleaned;
}

/**
 * Get the path to the config.yml file.
 */
export function getConfigPath(): string {
  return join(getAppDir(), CONFIG_FILENAME);
}

/**
 * Load and validate the config file.
 * Throws if the file does not exist or is invalid.
 */
export async function loadConfig(): Promise<SyncpointConfig> {
  const configPath = getConfigPath();
  const exists = await fileExists(configPath);
  if (!exists) {
    throw new Error(
      `Config file not found: ${configPath}\nRun "syncpoint init" first.`,
    );
  }

  const raw = await readFile(configPath, 'utf-8');
  const data = stripDangerousKeys(YAML.parse(raw));

  const result = validateConfig(data);
  if (!result.valid) {
    throw new Error(`Invalid config:\n${(result.errors ?? []).join('\n')}`);
  }

  return data as SyncpointConfig;
}

/**
 * Validate and save a config object to config.yml.
 */
export async function saveConfig(config: SyncpointConfig): Promise<void> {
  const result = validateConfig(config);
  if (!result.valid) {
    throw new Error(`Invalid config:\n${(result.errors ?? []).join('\n')}`);
  }

  const configPath = getConfigPath();
  await ensureDir(getAppDir());
  const yamlStr = YAML.stringify(config, { indent: 2 });
  await writeFile(configPath, yamlStr, 'utf-8');
}

/**
 * Create the default directory structure and config.yml.
 * Does not overwrite existing files.
 */
export async function initDefaultConfig(): Promise<{
  created: string[];
  skipped: string[];
}> {
  const created: string[] = [];
  const skipped: string[] = [];

  // Create directories
  const dirs = [
    getAppDir(),
    getSubDir(BACKUPS_DIR),
    getSubDir(TEMPLATES_DIR),
    getSubDir(SCRIPTS_DIR),
    getSubDir(LOGS_DIR),
  ];

  for (const dir of dirs) {
    const exists = await fileExists(dir);
    if (!exists) {
      await ensureDir(dir);
      created.push(dir);
    } else {
      skipped.push(dir);
    }
  }

  // Create default config
  const configPath = getConfigPath();
  const configExists = await fileExists(configPath);
  if (!configExists) {
    const yamlContent = readAsset('config.default.yml');
    await writeFile(configPath, yamlContent, 'utf-8');
    created.push(configPath);
  } else {
    skipped.push(configPath);
  }

  return { created, skipped };
}
