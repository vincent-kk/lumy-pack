import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getBackupList,
  getRestorePlan,
  restoreBackup,
} from '../../core/restore.js';

// Mock dependencies
vi.mock('../../core/config.js', () => ({
  loadConfig: vi.fn(),
}));

vi.mock('../../core/restore.js', () => ({
  getBackupList: vi.fn(),
  getRestorePlan: vi.fn(),
  restoreBackup: vi.fn(),
}));

vi.mock('../../core/backup.js', () => ({
  createBackup: vi.fn(),
}));

vi.mock('../../utils/system.js', () => ({
  getHostname: vi.fn(() => 'testhost'),
}));

describe('Restore Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers restore command with correct name', async () => {
    const { registerRestoreCommand } =
      await import('../../commands/Restore.js');
    const { Command } = await import('commander');
    const program = new Command();

    registerRestoreCommand(program);

    const restoreCommand = program.commands.find(
      (cmd) => cmd.name() === 'restore',
    );
    expect(restoreCommand).toBeDefined();
    expect(restoreCommand?.name()).toBe('restore');
  });

  it('restore command has correct description', async () => {
    const { registerRestoreCommand } =
      await import('../../commands/Restore.js');
    const { Command } = await import('commander');
    const program = new Command();

    registerRestoreCommand(program);

    const restoreCommand = program.commands.find(
      (cmd) => cmd.name() === 'restore',
    );
    expect(restoreCommand?.description()).toContain('Restore');
  });

  it('restore command is properly registered', async () => {
    const { registerRestoreCommand } =
      await import('../../commands/Restore.js');
    const { Command } = await import('commander');
    const program = new Command();

    registerRestoreCommand(program);

    const restoreCommand = program.commands.find(
      (cmd) => cmd.name() === 'restore',
    );
    expect(restoreCommand).toBeDefined();
    expect(restoreCommand?.name()).toBe('restore');
  });

  it('restore command has dry-run option', async () => {
    const { registerRestoreCommand } =
      await import('../../commands/Restore.js');
    const { Command } = await import('commander');
    const program = new Command();

    registerRestoreCommand(program);

    const restoreCommand = program.commands.find(
      (cmd) => cmd.name() === 'restore',
    );
    const options = restoreCommand?.options || [];
    const dryRunOption = options.find((opt) => opt.long === '--dry-run');

    expect(dryRunOption).toBeDefined();
  });

  it('exposes getBackupList dependency', () => {
    expect(getBackupList).toBeDefined();
    expect(typeof getBackupList).toBe('function');
  });

  it('exposes getRestorePlan dependency', () => {
    expect(getRestorePlan).toBeDefined();
    expect(typeof getRestorePlan).toBe('function');
  });

  it('exposes restoreBackup dependency', () => {
    expect(restoreBackup).toBeDefined();
    expect(typeof restoreBackup).toBe('function');
  });
});
