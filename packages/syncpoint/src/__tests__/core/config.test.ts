import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import YAML from 'yaml';

import {
  getConfigPath,
  initDefaultConfig,
  loadConfig,
  saveConfig,
} from '../../core/config.js';
import type { SyncpointConfig } from '../../utils/types.js';
import { createInitializedSandbox, createSandbox } from '../helpers/sandbox.js';

describe('config', () => {
  describe('getConfigPath', () => {
    it('uses SYNCPOINT_HOME environment variable', () => {
      const sandbox = createSandbox();
      sandbox.apply();

      try {
        const configPath = getConfigPath();

        expect(configPath).toContain(sandbox.home);
        expect(configPath).toMatch(/\.syncpoint[/\\]config\.yml$/);
      } finally {
        sandbox.restore();
      }
    });

    it('returns path ending in .syncpoint/config.yml', () => {
      const sandbox = createSandbox();
      sandbox.apply();

      try {
        const configPath = getConfigPath();

        expect(configPath.endsWith('.syncpoint/config.yml')).toBe(true);
      } finally {
        sandbox.restore();
      }
    });
  });

  describe('loadConfig', () => {
    it('loads valid YAML config from sandbox', async () => {
      const sandbox = await createInitializedSandbox();

      try {
        const config = await loadConfig();

        expect(config).toBeDefined();
        expect(config.backup).toBeDefined();
        expect(config.backup.targets).toBeInstanceOf(Array);
        expect(config.scripts).toBeDefined();
        expect(typeof config.scripts.includeInBackup).toBe('boolean');
      } finally {
        await sandbox.cleanup();
      }
    });

    it('throws when file is missing', async () => {
      const sandbox = createSandbox();
      sandbox.apply();

      try {
        await expect(loadConfig()).rejects.toThrow(/Config file not found/);
      } finally {
        await sandbox.cleanup();
      }
    });

    it('throws on invalid YAML', async () => {
      const sandbox = createSandbox();
      sandbox.apply();

      try {
        const { mkdir } = await import('node:fs/promises');
        await mkdir(sandbox.appDir, { recursive: true });
        const configPath = join(sandbox.appDir, 'config.yml');
        await writeFile(
          configPath,
          'invalid: yaml: :\n  bad: syntax:',
          'utf-8',
        );

        await expect(loadConfig()).rejects.toThrow();
      } finally {
        await sandbox.cleanup();
      }
    });

    it('throws on schema validation failure - missing required fields', async () => {
      const sandbox = createSandbox();
      sandbox.apply();

      try {
        const { mkdir } = await import('node:fs/promises');
        await mkdir(sandbox.appDir, { recursive: true });
        const configPath = join(sandbox.appDir, 'config.yml');
        const invalidConfig = YAML.stringify({
          backup: {
            // Missing required fields
          },
        });
        await writeFile(configPath, invalidConfig, 'utf-8');

        await expect(loadConfig()).rejects.toThrow(/Invalid config/);
      } finally {
        await sandbox.cleanup();
      }
    });

    it('throws on schema validation failure - wrong types', async () => {
      const sandbox = createSandbox();
      sandbox.apply();

      try {
        const { mkdir } = await import('node:fs/promises');
        await mkdir(sandbox.appDir, { recursive: true });
        const configPath = join(sandbox.appDir, 'config.yml');
        const invalidConfig = YAML.stringify({
          backup: {
            targets: 'not an array', // Wrong type
            exclude: [],
            filename: 'test',
          },
          scripts: {
            includeInBackup: true,
          },
        });
        await writeFile(configPath, invalidConfig, 'utf-8');

        await expect(loadConfig()).rejects.toThrow(/Invalid config/);
      } finally {
        await sandbox.cleanup();
      }
    });

    it('loads config with all fields correctly', async () => {
      const sandbox = createSandbox();
      sandbox.apply();

      try {
        const { mkdir } = await import('node:fs/promises');
        await mkdir(sandbox.appDir, { recursive: true });
        const configPath = join(sandbox.appDir, 'config.yml');
        const validConfig: SyncpointConfig = {
          backup: {
            targets: ['~/.zshrc', '~/.bashrc'],
            exclude: ['**/*.log', '**/*.swp'],
            filename: 'backup_{hostname}_{datetime}',
            destination: '/backups',
          },
          scripts: {
            includeInBackup: true,
          },
        };
        await writeFile(configPath, YAML.stringify(validConfig), 'utf-8');

        const loaded = await loadConfig();

        expect(loaded.backup.targets).toEqual(['~/.zshrc', '~/.bashrc']);
        expect(loaded.backup.exclude).toEqual(['**/*.log', '**/*.swp']);
        expect(loaded.backup.filename).toBe('backup_{hostname}_{datetime}');
        expect(loaded.backup.destination).toBe('/backups');
        expect(loaded.scripts.includeInBackup).toBe(true);
      } finally {
        await sandbox.cleanup();
      }
    });
  });

  describe('saveConfig', () => {
    it('writes valid YAML to config file', async () => {
      const sandbox = createSandbox();
      sandbox.apply();

      try {
        const config: SyncpointConfig = {
          backup: {
            targets: ['~/.zshrc'],
            exclude: [],
            filename: 'test_{datetime}',
          },
          scripts: {
            includeInBackup: false,
          },
        };

        await saveConfig(config);

        const configPath = getConfigPath();
        const content = await readFile(configPath, 'utf-8');
        const parsed = YAML.parse(content);
        expect(parsed).toEqual(config);
      } finally {
        await sandbox.cleanup();
      }
    });

    it('creates parent directory if not exists', async () => {
      const sandbox = createSandbox();
      sandbox.apply();

      try {
        const config: SyncpointConfig = {
          backup: {
            targets: ['~/.zshrc'],
            exclude: [],
            filename: 'test',
          },
          scripts: {
            includeInBackup: true,
          },
        };

        await saveConfig(config);

        const { stat } = await import('node:fs/promises');
        const stats = await stat(sandbox.appDir);
        expect(stats.isDirectory()).toBe(true);
      } finally {
        await sandbox.cleanup();
      }
    });

    it('throws on invalid config - missing required fields', async () => {
      const sandbox = createSandbox();
      sandbox.apply();

      try {
        const invalidConfig = {
          backup: {
            // Missing required fields
          },
        } as unknown as SyncpointConfig;

        await expect(saveConfig(invalidConfig)).rejects.toThrow(
          /Invalid config/,
        );
      } finally {
        await sandbox.cleanup();
      }
    });

    it('throws on invalid config - wrong types', async () => {
      const sandbox = createSandbox();
      sandbox.apply();

      try {
        const invalidConfig = {
          backup: {
            targets: 'not an array',
            exclude: [],
            filename: 'test',
          },
          scripts: {
            includeInBackup: true,
          },
        } as unknown as SyncpointConfig;

        await expect(saveConfig(invalidConfig)).rejects.toThrow(
          /Invalid config/,
        );
      } finally {
        await sandbox.cleanup();
      }
    });

    it('formats YAML with correct indentation', async () => {
      const sandbox = createSandbox();
      sandbox.apply();

      try {
        const config: SyncpointConfig = {
          backup: {
            targets: ['~/.zshrc', '~/.bashrc'],
            exclude: ['**/*.log'],
            filename: 'backup_{datetime}',
          },
          scripts: {
            includeInBackup: true,
          },
        };

        await saveConfig(config);

        const configPath = getConfigPath();
        const content = await readFile(configPath, 'utf-8');

        // Check for proper YAML structure with indentation
        expect(content).toContain('backup:');
        expect(content).toContain('  targets:');
        expect(content).toContain('scripts:');
      } finally {
        await sandbox.cleanup();
      }
    });

    it('overwrites existing config file', async () => {
      const sandbox = await createInitializedSandbox();

      try {
        const newConfig: SyncpointConfig = {
          backup: {
            targets: ['~/new.txt'],
            exclude: [],
            filename: 'new_{datetime}',
          },
          scripts: {
            includeInBackup: false,
          },
        };

        await saveConfig(newConfig);

        const loaded = await loadConfig();
        expect(loaded.backup.targets).toEqual(['~/new.txt']);
        expect(loaded.backup.filename).toBe('new_{datetime}');
      } finally {
        await sandbox.cleanup();
      }
    });
  });

  describe('initDefaultConfig', () => {
    it('creates directories and config.yml from default asset', async () => {
      const sandbox = createSandbox();
      sandbox.apply();

      try {
        const result = await initDefaultConfig();

        expect(result.created).toContain(sandbox.appDir);
        expect(result.created).toContain(sandbox.backupsDir);
        expect(result.created).toContain(sandbox.templatesDir);
        expect(result.created).toContain(sandbox.scriptsDir);
        expect(result.created).toContain(sandbox.logsDir);
        expect(result.created.some((p) => p.endsWith('config.yml'))).toBe(true);

        const { stat } = await import('node:fs/promises');
        const appDirStats = await stat(sandbox.appDir);
        expect(appDirStats.isDirectory()).toBe(true);

        const configPath = getConfigPath();
        const configStats = await stat(configPath);
        expect(configStats.isFile()).toBe(true);
      } finally {
        await sandbox.cleanup();
      }
    });

    it('is idempotent - does not overwrite existing files', async () => {
      const sandbox = createSandbox();
      sandbox.apply();

      try {
        const result1 = await initDefaultConfig();
        expect(result1.created.length).toBeGreaterThan(0);

        const result2 = await initDefaultConfig();
        expect(result2.created).toEqual([]);
        expect(result2.skipped.length).toBeGreaterThan(0);
        expect(result2.skipped).toContain(sandbox.appDir);
      } finally {
        await sandbox.cleanup();
      }
    });

    it('creates all required directories', async () => {
      const sandbox = createSandbox();
      sandbox.apply();

      try {
        await initDefaultConfig();

        const { stat } = await import('node:fs/promises');

        const appDirStats = await stat(sandbox.appDir);
        expect(appDirStats.isDirectory()).toBe(true);

        const backupsDirStats = await stat(sandbox.backupsDir);
        expect(backupsDirStats.isDirectory()).toBe(true);

        const templatesDirStats = await stat(sandbox.templatesDir);
        expect(templatesDirStats.isDirectory()).toBe(true);

        const scriptsDirStats = await stat(sandbox.scriptsDir);
        expect(scriptsDirStats.isDirectory()).toBe(true);

        const logsDirStats = await stat(sandbox.logsDir);
        expect(logsDirStats.isDirectory()).toBe(true);
      } finally {
        await sandbox.cleanup();
      }
    });

    it('creates valid config file that can be loaded', async () => {
      const sandbox = createSandbox();
      sandbox.apply();

      try {
        await initDefaultConfig();

        const config = await loadConfig();
        expect(config).toBeDefined();
        expect(config.backup).toBeDefined();
        expect(config.scripts).toBeDefined();
      } finally {
        await sandbox.cleanup();
      }
    });

    it('skips existing directories and config', async () => {
      const sandbox = createSandbox();
      sandbox.apply();

      try {
        const { mkdir } = await import('node:fs/promises');
        await mkdir(sandbox.appDir, { recursive: true });
        await mkdir(sandbox.backupsDir, { recursive: true });

        const result = await initDefaultConfig();

        expect(result.skipped).toContain(sandbox.appDir);
        expect(result.skipped).toContain(sandbox.backupsDir);
      } finally {
        await sandbox.cleanup();
      }
    });

    it('creates only missing items on partial initialization', async () => {
      const sandbox = createSandbox();
      sandbox.apply();

      try {
        const { mkdir } = await import('node:fs/promises');
        await mkdir(sandbox.appDir, { recursive: true });
        await mkdir(sandbox.backupsDir, { recursive: true });

        const result = await initDefaultConfig();

        expect(result.created.some((p) => p === sandbox.templatesDir)).toBe(
          true,
        );
        expect(result.created.some((p) => p === sandbox.scriptsDir)).toBe(true);
        expect(result.created.some((p) => p === sandbox.logsDir)).toBe(true);
        expect(result.skipped).toContain(sandbox.appDir);
        expect(result.skipped).toContain(sandbox.backupsDir);
      } finally {
        await sandbox.cleanup();
      }
    });
  });
});
