import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import Ajv from 'ajv';
import { CONFIG_SCHEMA } from './schema.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InkVeilConfig {
  tokenMode: 'tag' | 'bracket' | 'plain';
  signature: boolean;
  ner: {
    model: string;
    threshold: number;
    enabled: boolean;
    /** Absolute path to a pre-installed model directory. Overrides default path resolution. */
    modelPath?: string;
  };
  detection: {
    priorityOrder: ('MANUAL' | 'REGEX' | 'NER')[];
    categories: string[];
  };
  dictionary: {
    defaultPath: string;
  };
  output: {
    directory: string;
    encoding: string;
  };
  manualRules: Array<{
    pattern: string;
    category: string;
    isRegex: boolean;
  }>;
}

/** CLI/programmatic overrides — all fields optional */
export type ConfigOverrides = Partial<{
  tokenMode: InkVeilConfig['tokenMode'];
  signature: boolean;
  nerModel: string;
  nerModelPath: string;
  nerThreshold: number;
  noNer: boolean;
  dictionaryPath: string;
  outputDirectory: string;
  encoding: string;
  configPath: string;
}>;

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_CONFIG: InkVeilConfig = {
  tokenMode: 'tag',
  signature: true,
  ner: {
    model: 'kiwi-base',
    threshold: 0.2,
    enabled: true,
  },
  detection: {
    priorityOrder: ['MANUAL', 'REGEX', 'NER'],
    categories: [],
  },
  dictionary: {
    defaultPath: './dictionary.json',
  },
  output: {
    directory: './veiled/',
    encoding: 'utf-8',
  },
  manualRules: [],
};

// ---------------------------------------------------------------------------
// AJV validator (singleton)
// ---------------------------------------------------------------------------

const ajv = new Ajv({ allErrors: true, useDefaults: true });
const _validate = ajv.compile(CONFIG_SCHEMA);

function validateConfig(raw: unknown): { valid: boolean; errors: string[] } {
  const valid = _validate(raw);
  if (valid) return { valid: true, errors: [] };
  const errors = (_validate.errors ?? []).map(
    (e) => `${e.instancePath || '(root)'} ${e.message ?? 'invalid'}`
  );
  return { valid: false, errors };
}

// ---------------------------------------------------------------------------
// Config file resolution
// ---------------------------------------------------------------------------

function resolveConfigPath(overridePath?: string): string {
  // Priority: explicit override > INK_VEIL_CONFIG env > default
  if (overridePath) return overridePath;
  if (process.env['INK_VEIL_CONFIG']) return process.env['INK_VEIL_CONFIG'];
  return join(homedir(), '.ink-veil', 'config.json');
}

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------

/**
 * Load configuration with priority: CLI overrides > env vars > config file > defaults.
 *
 * Invalid config file: warning to stderr, fall back to defaults (never fatal).
 */
export function loadConfig(overrides: ConfigOverrides = {}): InkVeilConfig {
  const configPath = resolveConfigPath(overrides.configPath);

  // Start from deep clone of defaults
  const base: InkVeilConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

  // Layer 1: config file (if present)
  if (existsSync(configPath)) {
    try {
      const raw: unknown = JSON.parse(readFileSync(configPath, 'utf-8'));
      const { valid, errors } = validateConfig(raw);
      if (!valid) {
        process.stderr.write(
          `ink-veil: config file invalid (${configPath}), falling back to defaults\n` +
            errors.map((e) => `  - ${e}`).join('\n') +
            '\n'
        );
        // raw still has defaults injected by AJV useDefaults for valid sub-fields
      }
      // Merge validated (possibly partially-defaulted) config onto base
      deepMerge(base as unknown as Record<string, unknown>, raw as Record<string, unknown>);
    } catch (err) {
      process.stderr.write(
        `ink-veil: failed to read config file (${configPath}): ${(err as Error).message}, using defaults\n`
      );
    }
  }

  // Layer 2: env vars
  if (process.env['INK_VEIL_TOKEN_MODE']) {
    const mode = process.env['INK_VEIL_TOKEN_MODE'];
    if (mode === 'tag' || mode === 'bracket' || mode === 'plain') {
      base.tokenMode = mode;
    }
  }
  if (process.env['INK_VEIL_NER_MODEL']) {
    base.ner.model = process.env['INK_VEIL_NER_MODEL'];
  }
  if (process.env['INK_VEIL_NER_THRESHOLD']) {
    const t = parseFloat(process.env['INK_VEIL_NER_THRESHOLD']);
    if (!isNaN(t) && t >= 0 && t <= 1) base.ner.threshold = t;
  }
  if (process.env['INK_VEIL_NER_MODEL_PATH']) {
    base.ner.modelPath = process.env['INK_VEIL_NER_MODEL_PATH'];
  }
  if (process.env['INK_VEIL_NO_NER'] === '1') {
    base.ner.enabled = false;
  }
  if (process.env['INK_VEIL_DICT_PATH']) {
    base.dictionary.defaultPath = process.env['INK_VEIL_DICT_PATH'];
  }
  if (process.env['INK_VEIL_OUTPUT_DIR']) {
    base.output.directory = process.env['INK_VEIL_OUTPUT_DIR'];
  }
  if (process.env['INK_VEIL_ENCODING']) {
    base.output.encoding = process.env['INK_VEIL_ENCODING'];
  }

  // Layer 3: CLI overrides (highest priority)
  if (overrides.tokenMode !== undefined) base.tokenMode = overrides.tokenMode;
  if (overrides.signature !== undefined) base.signature = overrides.signature;
  if (overrides.nerModel !== undefined) base.ner.model = overrides.nerModel;
  if (overrides.nerModelPath !== undefined) base.ner.modelPath = overrides.nerModelPath;
  if (overrides.nerThreshold !== undefined) base.ner.threshold = overrides.nerThreshold;
  if (overrides.noNer === true) base.ner.enabled = false;
  if (overrides.dictionaryPath !== undefined) base.dictionary.defaultPath = overrides.dictionaryPath;
  if (overrides.outputDirectory !== undefined) base.output.directory = overrides.outputDirectory;
  if (overrides.encoding !== undefined) base.output.encoding = overrides.encoding;

  return base;
}

// ---------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------

/**
 * Save config to disk. Creates parent directory if necessary.
 */
export function saveConfig(config: InkVeilConfig, configPath?: string): void {
  const target = resolveConfigPath(configPath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const key of Object.keys(source)) {
    const sv = source[key];
    const tv = target[key];
    if (
      sv !== null &&
      typeof sv === 'object' &&
      !Array.isArray(sv) &&
      tv !== null &&
      typeof tv === 'object' &&
      !Array.isArray(tv)
    ) {
      deepMerge(tv as Record<string, unknown>, sv as Record<string, unknown>);
    } else if (sv !== undefined) {
      target[key] = sv;
    }
  }
}
