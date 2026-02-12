import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createBackup } from '../../core/backup.js';
import {
  initDefaultConfig,
  loadConfig,
  saveConfig,
} from '../../core/config.js';
import { restoreBackup } from '../../core/restore.js';
import { fileExists } from '../../utils/paths.js';
import { type Sandbox, createSandbox } from '../helpers/sandbox.js';

vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Init-Backup-Restore Lifecycle Integration Tests', () => {
  let sandbox: Sandbox;

  beforeEach(() => {
    sandbox = createSandbox();
    sandbox.apply();
  });

  afterEach(async () => {
    await sandbox.cleanup();
  });

  it('should create all required directory structure on init', async () => {
    // Run init
    const result = await initDefaultConfig();

    // Verify directories were created
    expect(result.created.length).toBeGreaterThan(0);

    // Verify all directories exist
    expect(await fileExists(sandbox.appDir)).toBe(true);
    expect(await fileExists(sandbox.backupsDir)).toBe(true);
    expect(await fileExists(sandbox.templatesDir)).toBe(true);
    expect(await fileExists(sandbox.scriptsDir)).toBe(true);
    expect(await fileExists(sandbox.logsDir)).toBe(true);

    // Verify config file exists
    const configPath = join(sandbox.appDir, 'config.yml');
    expect(await fileExists(configPath)).toBe(true);

    // Verify config is valid
    const config = await loadConfig();
    expect(config.backup.targets).toBeDefined();
    expect(config.backup.exclude).toBeDefined();
    expect(config.backup.filename).toBeDefined();
    expect(config.scripts.includeInBackup).toBeDefined();
  });

  it('should complete full init→backup→restore lifecycle', async () => {
    // 1. Init
    await initDefaultConfig();

    // 2. Create test dotfiles
    let zshrcPath = join(sandbox.home, '.zshrc');
    const zshrcContent = "export PATH=$PATH:/usr/local/bin\nalias ll='ls -la'";
    await writeFile(zshrcPath, zshrcContent, 'utf-8');

    let gitconfigPath = join(sandbox.home, '.gitconfig');
    const gitconfigContent =
      '[user]\nname = Test User\nemail = test@example.com';
    await writeFile(gitconfigPath, gitconfigContent, 'utf-8');

    // 3. Load config
    const config = await loadConfig();
    expect(config.backup.targets).toBeDefined();

    // 4. Create backup
    const backupResult = await createBackup(config);
    expect(await fileExists(backupResult.archivePath)).toBe(true);
    expect(backupResult.metadata.files.length).toBeGreaterThan(0);

    // Copy archive to temp location before cleanup
    const { copyFile } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { mkdtempSync } = await import('node:fs');
    const tempDir = mkdtempSync(join(tmpdir(), 'backup-test-'));
    const tempArchivePath = join(tempDir, 'backup.tar.gz');
    await copyFile(backupResult.archivePath, tempArchivePath);

    // 5. Simulate file loss - delete dotfiles
    await sandbox.cleanup();
    sandbox = createSandbox();
    sandbox.apply();
    await initDefaultConfig();

    // Update paths to new sandbox
    zshrcPath = join(sandbox.home, '.zshrc');
    gitconfigPath = join(sandbox.home, '.gitconfig');

    // Verify files don't exist
    expect(await fileExists(zshrcPath)).toBe(false);
    expect(await fileExists(gitconfigPath)).toBe(false);

    // 6. Restore from temp backup
    const restoreResult = await restoreBackup(tempArchivePath);
    expect(restoreResult.restoredFiles.length).toBeGreaterThan(0);

    // 7. Verify files are restored with correct content
    expect(await fileExists(zshrcPath)).toBe(true);
    expect(await fileExists(gitconfigPath)).toBe(true);

    const restoredZshrc = await readFile(zshrcPath, 'utf-8');
    const restoredGitconfig = await readFile(gitconfigPath, 'utf-8');

    expect(restoredZshrc).toBe(zshrcContent);
    expect(restoredGitconfig).toBe(gitconfigContent);

    // Cleanup temp dir
    const { rm } = await import('node:fs/promises');
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should support config round-trip (init→load→save→load)', async () => {
    // 1. Init with defaults
    await initDefaultConfig();

    // 2. Load default config
    const config1 = await loadConfig();
    expect(config1.backup.targets).toBeDefined();
    expect(config1.backup.exclude).toBeDefined();
    expect(config1.scripts.includeInBackup).toBe(true);

    // Verify default values
    expect(Array.isArray(config1.backup.targets)).toBe(true);
    expect(config1.backup.targets.length).toBeGreaterThan(0);

    // 3. Modify config
    const modifiedConfig = {
      ...config1,
      backup: {
        ...config1.backup,
        targets: ['~/.zshrc', '~/.bashrc', '~/.custom'],
        exclude: ['**/*.log', '**/*.tmp'],
        filename: 'custom_{hostname}_{datetime}',
      },
      scripts: {
        includeInBackup: false,
      },
    };

    // 4. Save modified config
    await saveConfig(modifiedConfig);

    // 5. Load again and verify changes persisted
    const config2 = await loadConfig();
    expect(config2.backup.targets).toEqual(modifiedConfig.backup.targets);
    expect(config2.backup.exclude).toEqual(modifiedConfig.backup.exclude);
    expect(config2.backup.filename).toBe('custom_{hostname}_{datetime}');
    expect(config2.scripts.includeInBackup).toBe(false);

    // 6. Verify file was actually written
    const configPath = join(sandbox.appDir, 'config.yml');
    const configContent = await readFile(configPath, 'utf-8');
    expect(configContent).toContain('custom_{hostname}_{datetime}');
    expect(configContent).toContain('.custom');
    expect(configContent).toContain('**/*.log');
  });

  it('should not overwrite existing files on re-init', async () => {
    // 1. First init
    const result1 = await initDefaultConfig();
    expect(result1.created.length).toBeGreaterThan(0);
    expect(result1.skipped.length).toBe(0);

    // 2. Modify config
    const config = await loadConfig();
    config.backup.targets.push('~/.customrc');
    await saveConfig(config);

    // 3. Second init
    const result2 = await initDefaultConfig();
    expect(result2.skipped.length).toBeGreaterThan(0);
    expect(result2.created.length).toBe(0);

    // 4. Verify config wasn't overwritten
    const reloadedConfig = await loadConfig();
    expect(reloadedConfig.backup.targets).toContain('~/.customrc');
  });
});
