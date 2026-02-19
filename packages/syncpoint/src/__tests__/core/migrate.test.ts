import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import YAML from 'yaml';

import {
  buildMigratedDocument,
  diffConfigFields,
  migrateConfig,
} from '../../core/migrate.js';
import { readAsset } from '../../utils/assets.js';
import { createInitializedSandbox, createSandbox } from '../helpers/sandbox.js';

describe('migrate', () => {
  describe('diffConfigFields', () => {
    it('detects no changes when config matches template defaults', () => {
      const userData = {
        backup: {
          targets: ['~/.zshrc'],
          exclude: ['**/*.swp'],
          filename: '{hostname}_{datetime}',
          includeSensitiveFiles: false,
        },
        scripts: {
          includeInBackup: true,
        },
      };

      const diff = diffConfigFields(userData);

      expect(diff.added).toEqual([]);
      expect(diff.removed).toEqual([]);
      expect(diff.existing.length).toBeGreaterThan(0);
    });

    it('detects new fields missing from user config', () => {
      // Old config without includeSensitiveFiles
      const userData = {
        backup: {
          targets: ['~/.zshrc'],
          exclude: ['**/*.swp'],
          filename: '{hostname}_{datetime}',
        },
        scripts: {
          includeInBackup: true,
        },
      };

      const diff = diffConfigFields(userData);

      const addedKeys = diff.added.map((p) => p.join('.'));
      expect(addedKeys).toContain('backup.includeSensitiveFiles');
      expect(diff.removed).toEqual([]);
    });

    it('detects removed fields not in schema', () => {
      const userData = {
        backup: {
          targets: ['~/.zshrc'],
          exclude: ['**/*.swp'],
          filename: '{hostname}_{datetime}',
          includeSensitiveFiles: false,
          legacyOption: true, // not in schema
        },
        scripts: {
          includeInBackup: true,
        },
      };

      const diff = diffConfigFields(userData);

      const removedKeys = diff.removed.map((p) => p.join('.'));
      expect(removedKeys).toContain('backup.legacyOption');
    });

    it('detects both added and removed fields', () => {
      const userData = {
        backup: {
          targets: ['~/.zshrc'],
          exclude: ['**/*.swp'],
          filename: '{hostname}_{datetime}',
          oldField: 'value', // removed
        },
        scripts: {
          includeInBackup: true,
        },
        // missing: backup.includeSensitiveFiles (added)
      };

      const diff = diffConfigFields(userData);

      const addedKeys = diff.added.map((p) => p.join('.'));
      const removedKeys = diff.removed.map((p) => p.join('.'));
      expect(addedKeys).toContain('backup.includeSensitiveFiles');
      expect(removedKeys).toContain('backup.oldField');
    });

    it('does not add optional fields that are commented out in template', () => {
      // Config without optional destination field
      const userData = {
        backup: {
          targets: ['~/.zshrc'],
          exclude: ['**/*.swp'],
          filename: '{hostname}_{datetime}',
          includeSensitiveFiles: false,
        },
        scripts: {
          includeInBackup: true,
        },
      };

      const diff = diffConfigFields(userData);

      // destination is in schema but commented out in template, should NOT be added
      const addedKeys = diff.added.map((p) => p.join('.'));
      expect(addedKeys).not.toContain('backup.destination');
    });

    it('preserves user destination field as existing', () => {
      const userData = {
        backup: {
          targets: ['~/.zshrc'],
          exclude: ['**/*.swp'],
          filename: '{hostname}_{datetime}',
          includeSensitiveFiles: false,
          destination: '/my/backups',
        },
        scripts: {
          includeInBackup: true,
        },
      };

      const diff = diffConfigFields(userData);

      const existingKeys = diff.existing.map((p) => p.join('.'));
      expect(existingKeys).toContain('backup.destination');
      expect(diff.removed).toEqual([]);
    });
  });

  describe('buildMigratedDocument', () => {
    const templateText = readAsset('config.default.yml');

    it('preserves user values for existing fields', () => {
      const userData = {
        backup: {
          targets: ['~/custom1', '~/custom2'],
          exclude: ['**/*.log'],
          filename: 'my-backup_{datetime}',
        },
        scripts: {
          includeInBackup: false,
        },
      };

      const diff = diffConfigFields(userData);
      const output = buildMigratedDocument(templateText, userData, diff);
      const parsed = YAML.parse(output);

      expect(parsed.backup.targets).toEqual(['~/custom1', '~/custom2']);
      expect(parsed.backup.exclude).toEqual(['**/*.log']);
      expect(parsed.backup.filename).toBe('my-backup_{datetime}');
      expect(parsed.scripts.includeInBackup).toBe(false);
    });

    it('adds new fields with default values from template', () => {
      const userData = {
        backup: {
          targets: ['~/.zshrc'],
          exclude: ['**/*.swp'],
          filename: '{hostname}_{datetime}',
          // missing: includeSensitiveFiles
        },
        scripts: {
          includeInBackup: true,
        },
      };

      const diff = diffConfigFields(userData);
      const output = buildMigratedDocument(templateText, userData, diff);
      const parsed = YAML.parse(output);

      expect(parsed.backup.includeSensitiveFiles).toBe(false);
    });

    it('appends deprecated fields as comments', () => {
      const userData = {
        backup: {
          targets: ['~/.zshrc'],
          exclude: ['**/*.swp'],
          filename: '{hostname}_{datetime}',
          includeSensitiveFiles: false,
          legacyOption: 'old-value',
        },
        scripts: {
          includeInBackup: true,
        },
      };

      const diff = diffConfigFields(userData);
      const output = buildMigratedDocument(templateText, userData, diff);

      expect(output).toContain('# [deprecated]');
      expect(output).toContain('backup.legacyOption: old-value');
    });

    it('preserves yaml-language-server directive', () => {
      const userData = {
        backup: {
          targets: ['~/.zshrc'],
          exclude: [],
          filename: '{hostname}_{datetime}',
        },
        scripts: {
          includeInBackup: true,
        },
      };

      const diff = diffConfigFields(userData);
      const output = buildMigratedDocument(templateText, userData, diff);

      expect(output).toContain('yaml-language-server');
    });

    it('produces valid YAML that can be parsed', () => {
      const userData = {
        backup: {
          targets: ['~/a', '~/b'],
          exclude: ['**/*.tmp'],
          filename: 'test',
          oldSetting: 42,
        },
        scripts: {
          includeInBackup: true,
        },
      };

      const diff = diffConfigFields(userData);
      const output = buildMigratedDocument(templateText, userData, diff);
      const parsed = YAML.parse(output);

      expect(parsed).toBeDefined();
      expect(parsed.backup).toBeDefined();
      expect(parsed.scripts).toBeDefined();
    });
  });

  describe('migrateConfig', () => {
    it('throws when config file does not exist', async () => {
      const sandbox = createSandbox();
      sandbox.apply();

      try {
        await expect(migrateConfig()).rejects.toThrow(/Config file not found/);
      } finally {
        await sandbox.cleanup();
      }
    });

    it('returns migrated: false when config is already up to date', async () => {
      const sandbox = await createInitializedSandbox();

      try {
        // Write a config that matches current schema exactly
        const { writeFile } = await import('node:fs/promises');
        const configPath = join(sandbox.appDir, 'config.yml');
        const upToDateConfig = YAML.stringify({
          backup: {
            targets: ['~/.zshrc'],
            exclude: ['**/*.swp'],
            filename: '{hostname}_{datetime}',
            destination: '/backups',
            includeSensitiveFiles: false,
          },
          scripts: {
            includeInBackup: true,
          },
        });
        await writeFile(configPath, upToDateConfig, 'utf-8');

        const result = await migrateConfig();

        expect(result.migrated).toBe(false);
        expect(result.added).toEqual([]);
        expect(result.deprecated).toEqual([]);
      } finally {
        await sandbox.cleanup();
      }
    });

    it('migrates config with missing fields', async () => {
      const sandbox = await createInitializedSandbox();

      try {
        // The default sandbox config is missing includeSensitiveFiles
        const result = await migrateConfig();

        expect(result.migrated).toBe(true);
        expect(result.added).toContain('backup.includeSensitiveFiles');
        expect(result.backupPath).toMatch(/config\.yml\.bak$/);

        // Verify backup was created
        const { stat } = await import('node:fs/promises');
        const bakStats = await stat(result.backupPath);
        expect(bakStats.isFile()).toBe(true);

        // Verify migrated config is valid
        const configPath = join(sandbox.appDir, 'config.yml');
        const content = await readFile(configPath, 'utf-8');
        const parsed = YAML.parse(content);
        expect(parsed.backup.includeSensitiveFiles).toBe(false);
        // User values preserved
        expect(parsed.backup.targets).toEqual(['~/.zshrc']);
        expect(parsed.backup.filename).toBe('{hostname}_{datetime}');
      } finally {
        await sandbox.cleanup();
      }
    });

    it('dry-run does not modify files', async () => {
      const sandbox = await createInitializedSandbox();

      try {
        const configPath = join(sandbox.appDir, 'config.yml');
        const originalContent = await readFile(configPath, 'utf-8');

        const result = await migrateConfig({ dryRun: true });

        expect(result.migrated).toBe(false);
        expect(result.added.length).toBeGreaterThan(0);
        expect(result.backupPath).toBe('');

        // Config file unchanged
        const afterContent = await readFile(configPath, 'utf-8');
        expect(afterContent).toBe(originalContent);
      } finally {
        await sandbox.cleanup();
      }
    });

    it('handles deprecated fields', async () => {
      const sandbox = await createInitializedSandbox();

      try {
        // Write config with an unknown field
        const { writeFile } = await import('node:fs/promises');
        const configPath = join(sandbox.appDir, 'config.yml');
        const oldConfig = YAML.stringify({
          backup: {
            targets: ['~/.zshrc'],
            exclude: ['**/*.swp'],
            filename: '{hostname}_{datetime}',
            includeSensitiveFiles: false,
            obsoleteField: 'old-value',
          },
          scripts: {
            includeInBackup: true,
          },
        });
        await writeFile(configPath, oldConfig, 'utf-8');

        const result = await migrateConfig();

        expect(result.migrated).toBe(true);
        expect(result.deprecated).toContain('backup.obsoleteField');

        // Verify deprecated field is in comments
        const content = await readFile(configPath, 'utf-8');
        expect(content).toContain('# [deprecated]');
        expect(content).toContain('backup.obsoleteField');
      } finally {
        await sandbox.cleanup();
      }
    });

    it('creates backup file before migration', async () => {
      const sandbox = await createInitializedSandbox();

      try {
        const configPath = join(sandbox.appDir, 'config.yml');
        const originalContent = await readFile(configPath, 'utf-8');

        const result = await migrateConfig();

        expect(result.backupPath).toBeTruthy();
        const bakContent = await readFile(result.backupPath, 'utf-8');
        expect(bakContent).toBe(originalContent);
      } finally {
        await sandbox.cleanup();
      }
    });

    it('is idempotent - running twice produces same result', async () => {
      const sandbox = await createInitializedSandbox();

      try {
        // First migration
        await migrateConfig();

        // Second migration should detect no changes
        const result2 = await migrateConfig();
        expect(result2.migrated).toBe(false);
        expect(result2.added).toEqual([]);
        expect(result2.deprecated).toEqual([]);
      } finally {
        await sandbox.cleanup();
      }
    });
  });
});
