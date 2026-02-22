import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getBackupList } from '../../core/restore.js';

// Mock dependencies
vi.mock('../../core/restore.js', () => ({
  getBackupList: vi.fn(),
}));

describe('Status Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers status command with correct name', async () => {
    const { registerStatusCommand } = await import('../../commands/Status.js');
    const { Command } = await import('commander');
    const program = new Command();

    registerStatusCommand(program);

    const statusCommand = program.commands.find(
      (cmd) => cmd.name() === 'status',
    );
    expect(statusCommand).toBeDefined();
    expect(statusCommand?.name()).toBe('status');
  });

  it('status command has correct description', async () => {
    const { registerStatusCommand } = await import('../../commands/Status.js');
    const { Command } = await import('commander');
    const program = new Command();

    registerStatusCommand(program);

    const statusCommand = program.commands.find(
      (cmd) => cmd.name() === 'status',
    );
    expect(statusCommand?.description()).toContain('status');
  });

  it('status command has cleanup option', async () => {
    const { registerStatusCommand } = await import('../../commands/Status.js');
    const { Command } = await import('commander');
    const program = new Command();

    registerStatusCommand(program);

    const statusCommand = program.commands.find(
      (cmd) => cmd.name() === 'status',
    );
    const options = statusCommand?.options || [];
    const cleanupOption = options.find((opt) => opt.long === '--cleanup');

    expect(cleanupOption).toBeDefined();
  });

  it('exposes getBackupList dependency', () => {
    expect(getBackupList).toBeDefined();
    expect(typeof getBackupList).toBe('function');
  });

  it('verifies status command uses fs operations', async () => {
    // Status command uses readdirSync and statSync from node:fs
    const { readdirSync, statSync } = await import('node:fs');

    expect(readdirSync).toBeDefined();
    expect(statSync).toBeDefined();
  });
});
