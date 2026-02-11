import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import YAML from "yaml";

import {
  APP_NAME,
  CONFIG_FILENAME,
  DEFAULT_FILENAME_PATTERN,
  getAppDir,
  getSubDir,
  BACKUPS_DIR,
  TEMPLATES_DIR,
  SCRIPTS_DIR,
  LOGS_DIR,
} from "../constants.js";
import { validateConfig } from "../schemas/config.schema.js";
import { ensureDir, fileExists } from "../utils/paths.js";
import type { SyncpointConfig } from "../utils/types.js";

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

  const raw = await readFile(configPath, "utf-8");
  const data = YAML.parse(raw) as unknown;

  const result = validateConfig(data);
  if (!result.valid) {
    throw new Error(
      `Invalid config:\n${(result.errors ?? []).join("\n")}`,
    );
  }

  return data as SyncpointConfig;
}

/**
 * Validate and save a config object to config.yml.
 */
export async function saveConfig(config: SyncpointConfig): Promise<void> {
  const result = validateConfig(config);
  if (!result.valid) {
    throw new Error(
      `Invalid config:\n${(result.errors ?? []).join("\n")}`,
    );
  }

  const configPath = getConfigPath();
  await ensureDir(getAppDir());
  const yamlStr = YAML.stringify(config, { indent: 2 });
  await writeFile(configPath, yamlStr, "utf-8");
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
    const defaultConfig: SyncpointConfig = {
      backup: {
        targets: [
          "~/.zshrc",
          "~/.zprofile",
          "~/.gitconfig",
          "~/.gitignore_global",
          "~/.ssh/config",
          "~/.config/starship.toml",
        ],
        exclude: ["**/*.swp", "**/.DS_Store"],
        filename: DEFAULT_FILENAME_PATTERN,
      },
      scripts: {
        includeInBackup: true,
      },
    };

    const yamlContent = [
      `# ~/.${APP_NAME}/config.yml`,
      "",
      YAML.stringify(defaultConfig, { indent: 2 }),
    ].join("\n");

    await writeFile(configPath, yamlContent, "utf-8");
    created.push(configPath);
  } else {
    skipped.push(configPath);
  }

  return { created, skipped };
}
