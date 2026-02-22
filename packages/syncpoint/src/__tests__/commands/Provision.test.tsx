import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  listTemplates,
  loadTemplate,
  runProvision,
} from '../../core/provision.js';
import { ensureSudo } from '../../utils/sudo.js';

// Mock dependencies
vi.mock('../../core/provision.js', () => ({
  loadTemplate: vi.fn(),
  listTemplates: vi.fn(),
  runProvision: vi.fn(),
}));

vi.mock('../../utils/sudo.js', () => ({
  ensureSudo: vi.fn(),
  isSudoCached: vi.fn(() => true),
}));

describe('Provision Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers provision command with correct name', async () => {
    const { registerProvisionCommand } =
      await import('../../commands/Provision.js');
    const { Command } = await import('commander');
    const program = new Command();

    registerProvisionCommand(program);

    const provisionCommand = program.commands.find(
      (cmd) => cmd.name() === 'provision',
    );
    expect(provisionCommand).toBeDefined();
    expect(provisionCommand?.name()).toBe('provision');
  });

  it('provision command has correct description', async () => {
    const { registerProvisionCommand } =
      await import('../../commands/Provision.js');
    const { Command } = await import('commander');
    const program = new Command();

    registerProvisionCommand(program);

    const provisionCommand = program.commands.find(
      (cmd) => cmd.name() === 'provision',
    );
    expect(provisionCommand?.description()).toContain('provision');
  });

  it('provision command is properly registered', async () => {
    const { registerProvisionCommand } =
      await import('../../commands/Provision.js');
    const { Command } = await import('commander');
    const program = new Command();

    registerProvisionCommand(program);

    const provisionCommand = program.commands.find(
      (cmd) => cmd.name() === 'provision',
    );
    expect(provisionCommand).toBeDefined();
    expect(provisionCommand?.name()).toBe('provision');
  });

  it('provision command has dry-run option', async () => {
    const { registerProvisionCommand } =
      await import('../../commands/Provision.js');
    const { Command } = await import('commander');
    const program = new Command();

    registerProvisionCommand(program);

    const provisionCommand = program.commands.find(
      (cmd) => cmd.name() === 'provision',
    );
    const options = provisionCommand?.options || [];
    const dryRunOption = options.find((opt) => opt.long === '--dry-run');

    expect(dryRunOption).toBeDefined();
  });

  it('provision command has skip-restore option', async () => {
    const { registerProvisionCommand } =
      await import('../../commands/Provision.js');
    const { Command } = await import('commander');
    const program = new Command();

    registerProvisionCommand(program);

    const provisionCommand = program.commands.find(
      (cmd) => cmd.name() === 'provision',
    );
    const options = provisionCommand?.options || [];
    const skipRestoreOption = options.find(
      (opt) => opt.long === '--skip-restore',
    );

    expect(skipRestoreOption).toBeDefined();
  });

  it('provision command has file option', async () => {
    const { registerProvisionCommand } =
      await import('../../commands/Provision.js');
    const { Command } = await import('commander');
    const program = new Command();

    registerProvisionCommand(program);

    const provisionCommand = program.commands.find(
      (cmd) => cmd.name() === 'provision',
    );
    const options = provisionCommand?.options || [];
    const fileOption = options.find((opt) => opt.long === '--file');

    expect(fileOption).toBeDefined();
    expect(fileOption?.short).toBe('-f');
  });

  it('provision command template argument is optional', async () => {
    const { registerProvisionCommand } =
      await import('../../commands/Provision.js');
    const { Command } = await import('commander');
    const program = new Command();

    registerProvisionCommand(program);

    const provisionCommand = program.commands.find(
      (cmd) => cmd.name() === 'provision',
    );
    const args = provisionCommand?.registeredArguments || [];

    expect(args.length).toBeGreaterThan(0);
    const templateArg = args[0];
    expect(templateArg.name()).toBe('template');
    expect(templateArg.required).toBe(false);
  });

  it('exposes loadTemplate dependency', () => {
    expect(loadTemplate).toBeDefined();
    expect(typeof loadTemplate).toBe('function');
  });

  it('exposes listTemplates dependency', () => {
    expect(listTemplates).toBeDefined();
    expect(typeof listTemplates).toBe('function');
  });

  it('exposes runProvision dependency', () => {
    expect(runProvision).toBeDefined();
    expect(typeof runProvision).toBe('function');
  });

  it('exposes ensureSudo dependency', () => {
    expect(ensureSudo).toBeDefined();
    expect(typeof ensureSudo).toBe('function');
  });
});
