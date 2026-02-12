import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createBackup } from '../../core/backup.js';
import {
  getBackupList,
  getRestorePlan,
  restoreBackup,
} from '../../core/restore.js';
import { fileExists } from '../../utils/paths.js';
import { makeConfig } from '../helpers/fixtures.js';
import { type Sandbox, createInitializedSandbox } from '../helpers/sandbox.js';

vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('core/restore', () => {
  let sandbox: Sandbox;

  beforeEach(async () => {
    sandbox = await createInitializedSandbox();
  });

  afterEach(async () => {
    await sandbox.cleanup();
  });

  describe('getBackupList', () => {
    it('returns empty array when no .tar.gz files', async () => {
      const config = makeConfig();
      const list = await getBackupList(config);

      expect(list).toEqual([]);
    });

    it('lists .tar.gz files with metadata', async () => {
      // Create a real backup
      await writeFile(join(sandbox.home, '.zshrc'), 'export PATH=...', 'utf-8');

      const config = makeConfig({
        backup: {
          targets: ['~/.zshrc'],
          exclude: [],
          filename: 'test',
        },
      });

      await createBackup(config);

      const list = await getBackupList(config);

      expect(list).toHaveLength(1);
      expect(list[0].filename).toMatch(/test.*\.tar\.gz$/);
      expect(list[0].path).toBeDefined();
      expect(list[0].size).toBeGreaterThan(0);
      expect(list[0].createdAt).toBeInstanceOf(Date);
      expect(list[0].fileCount).toBe(1);
    });

    it('uses custom destination from config', async () => {
      await writeFile(join(sandbox.home, '.zshrc'), 'export PATH=...', 'utf-8');
      const customDest = join(sandbox.home, 'custom-backups');

      const config = makeConfig({
        backup: {
          targets: ['~/.zshrc'],
          exclude: [],
          filename: 'test',
          destination: customDest,
        },
      });

      await createBackup(config);

      const list = await getBackupList(config);

      expect(list).toHaveLength(1);
      expect(list[0].path).toContain('custom-backups');
    });
  });

  describe('getRestorePlan', () => {
    it('creates plan with "create" for missing files', async () => {
      // Create backup with a file
      await writeFile(join(sandbox.home, '.zshrc'), 'export PATH=...', 'utf-8');

      const config = makeConfig({
        backup: {
          targets: ['~/.zshrc'],
          exclude: [],
          filename: 'test',
        },
      });

      const { archivePath } = await createBackup(config);

      // Remove the file to simulate missing
      await import('node:fs/promises').then((fs) =>
        fs.rm(join(sandbox.home, '.zshrc'), { force: true }),
      );

      const plan = await getRestorePlan(archivePath);

      expect(plan.actions).toHaveLength(1);
      expect(plan.actions[0].action).toBe('create');
      expect(plan.actions[0].path).toBe('~/.zshrc');
      expect(plan.actions[0].reason).toContain('does not exist');
    });

    it('creates plan with "skip" for identical files', async () => {
      // Create backup
      await writeFile(join(sandbox.home, '.zshrc'), 'export PATH=...', 'utf-8');

      const config = makeConfig({
        backup: {
          targets: ['~/.zshrc'],
          exclude: [],
          filename: 'test',
        },
      });

      const { archivePath } = await createBackup(config);

      // File still exists with same content
      const plan = await getRestorePlan(archivePath);

      expect(plan.actions).toHaveLength(1);
      expect(plan.actions[0].action).toBe('skip');
      expect(plan.actions[0].path).toBe('~/.zshrc');
      expect(plan.actions[0].reason).toContain('identical');
    });

    it('creates plan with "overwrite" for modified files', async () => {
      // Create backup
      await writeFile(join(sandbox.home, '.zshrc'), 'export PATH=...', 'utf-8');

      const config = makeConfig({
        backup: {
          targets: ['~/.zshrc'],
          exclude: [],
          filename: 'test',
        },
      });

      const { archivePath } = await createBackup(config);

      // Modify the file
      await writeFile(
        join(sandbox.home, '.zshrc'),
        'export PATH=modified',
        'utf-8',
      );

      const plan = await getRestorePlan(archivePath);

      expect(plan.actions).toHaveLength(1);
      expect(plan.actions[0].action).toBe('overwrite');
      expect(plan.actions[0].path).toBe('~/.zshrc');
      expect(plan.actions[0].reason).toContain('modified');
    });
  });

  describe('restoreBackup', () => {
    it('restores files to correct locations', async () => {
      // Create backup
      await writeFile(
        join(sandbox.home, '.zshrc'),
        'original content',
        'utf-8',
      );

      const config = makeConfig({
        backup: {
          targets: ['~/.zshrc'],
          exclude: [],
          filename: 'test',
        },
      });

      const { archivePath } = await createBackup(config);

      // Remove the file
      await import('node:fs/promises').then((fs) =>
        fs.rm(join(sandbox.home, '.zshrc'), { force: true }),
      );

      // Restore
      const result = await restoreBackup(archivePath);

      expect(result.restoredFiles).toContain('~/.zshrc');
      expect(await fileExists(join(sandbox.home, '.zshrc'))).toBe(true);

      const content = await readFile(join(sandbox.home, '.zshrc'), 'utf-8');
      expect(content).toBe('original content');
    });

    it('creates safety backup before overwriting', async () => {
      // Create backup
      await writeFile(
        join(sandbox.home, '.zshrc'),
        'original content',
        'utf-8',
      );

      const config = makeConfig({
        backup: {
          targets: ['~/.zshrc'],
          exclude: [],
          filename: 'test',
        },
      });

      const { archivePath } = await createBackup(config);

      // Modify the file
      await writeFile(
        join(sandbox.home, '.zshrc'),
        'modified content',
        'utf-8',
      );

      // Restore
      const result = await restoreBackup(archivePath);

      expect(result.safetyBackupPath).toBeDefined();
      expect(await fileExists(result.safetyBackupPath!)).toBe(true);
      expect(result.safetyBackupPath).toContain('_pre-restore_');
    });

    it('dry-run returns plan without modifying files', async () => {
      // Create backup
      await writeFile(
        join(sandbox.home, '.zshrc'),
        'original content',
        'utf-8',
      );

      const config = makeConfig({
        backup: {
          targets: ['~/.zshrc'],
          exclude: [],
          filename: 'test',
        },
      });

      const { archivePath } = await createBackup(config);

      // Modify the file
      await writeFile(
        join(sandbox.home, '.zshrc'),
        'modified content',
        'utf-8',
      );

      // Dry-run restore
      const result = await restoreBackup(archivePath, { dryRun: true });

      expect(result.restoredFiles).toContain('~/.zshrc');

      // File should still have modified content
      const content = await readFile(join(sandbox.home, '.zshrc'), 'utf-8');
      expect(content).toBe('modified content');
    });
  });
});
