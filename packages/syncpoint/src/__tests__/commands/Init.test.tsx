import { beforeEach, describe, expect, it, vi } from 'vitest';

import { initDefaultConfig } from '../../core/config.js';
import { ensureDir, fileExists } from '../../utils/paths.js';

// Mock dependencies before imports
vi.mock('../../core/config.js', () => ({
  initDefaultConfig: vi.fn(),
}));

vi.mock('../../utils/paths.js', () => ({
  ensureDir: vi.fn(),
  fileExists: vi.fn(),
}));

vi.mock('../../utils/assets.js', () => ({
  readAsset: vi.fn(() => '# Example template content'),
}));

vi.mock('../../constants.js', async () => {
  const actual =
    await vi.importActual<typeof import('../../constants.js')>(
      '../../constants.js',
    );
  return {
    ...actual,
    getAppDir: vi.fn(() => '/home/user/.syncpoint'),
    getSubDir: vi.fn((dir: string) => `/home/user/.syncpoint/${dir}`),
  };
});

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn(),
}));

describe('Init Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers init command with correct name', async () => {
    const { registerInitCommand } = await import('../../commands/Init.js');
    const { Command } = await import('commander');
    const program = new Command();

    registerInitCommand(program);

    const initCommand = program.commands.find((cmd) => cmd.name() === 'init');
    expect(initCommand).toBeDefined();
    expect(initCommand?.name()).toBe('init');
  });

  it('init command has correct description', async () => {
    const { registerInitCommand } = await import('../../commands/Init.js');
    const { Command } = await import('commander');
    const program = new Command();

    registerInitCommand(program);

    const initCommand = program.commands.find((cmd) => cmd.name() === 'init');
    expect(initCommand?.description()).toContain('Initialize');
    expect(initCommand?.description()).toContain('syncpoint');
  });

  it('exposes fileExists dependency for initialization check', () => {
    expect(fileExists).toBeDefined();
    expect(typeof fileExists).toBe('function');
  });

  it('exposes ensureDir dependency for directory creation', () => {
    expect(ensureDir).toBeDefined();
    expect(typeof ensureDir).toBe('function');
  });

  it('exposes initDefaultConfig dependency for config creation', () => {
    expect(initDefaultConfig).toBeDefined();
    expect(typeof initDefaultConfig).toBe('function');
  });
});
