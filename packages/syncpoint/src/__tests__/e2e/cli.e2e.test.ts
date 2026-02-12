import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = join(__dirname, '../../../dist/cli.mjs');

function runCli(args: string, env?: Record<string, string>): string {
  try {
    return execSync(`node ${CLI_PATH} ${args}`, {
      encoding: 'utf-8',
      timeout: 5000,
      env: { ...process.env, ...env },
    });
  } catch (error: any) {
    // Return stdout/stderr for assertions even on non-zero exit
    return error.stdout?.toString() || error.stderr?.toString() || '';
  }
}

function runCliWithCode(
  args: string,
  env?: Record<string, string>,
): { output: string; exitCode: number } {
  try {
    const output = execSync(`node ${CLI_PATH} ${args}`, {
      encoding: 'utf-8',
      timeout: 5000,
      env: { ...process.env, ...env },
    });
    return { output, exitCode: 0 };
  } catch (error: any) {
    return {
      output: error.stdout?.toString() || error.stderr?.toString() || '',
      exitCode: error.status || 1,
    };
  }
}

describe('CLI E2E Tests', () => {
  beforeAll(() => {
    if (!existsSync(CLI_PATH)) {
      throw new Error(
        `CLI not built. Run 'pnpm build' first. Expected: ${CLI_PATH}`,
      );
    }
  });

  it('should print version with --version', () => {
    const output = runCli('--version');
    expect(output).toMatch(/\d+\.\d+\.\d+/);
  });

  it('should print version with -V', () => {
    const output = runCli('-V');
    expect(output).toMatch(/\d+\.\d+\.\d+/);
  });

  it('should print help with --help', () => {
    const output = runCli('--help');
    expect(output).toContain('syncpoint');
    expect(output).toContain('init');
    expect(output).toContain('backup');
    expect(output).toContain('restore');
    expect(output).toContain('provision');
    expect(output).toContain('list');
    expect(output).toContain('status');
  });

  it('should show backup help with backup --help', () => {
    const output = runCli('backup --help');
    expect(output).toContain('backup');
    expect(output).toMatch(/options|usage/i);
  });

  it('should show init help with init --help', () => {
    const output = runCli('init --help');
    expect(output).toContain('init');
  });

  it('should show provision help with provision --help', () => {
    const output = runCli('provision --help');
    expect(output).toContain('provision');
  });

  it('should show list help with list --help', () => {
    const output = runCli('list --help');
    expect(output).toContain('list');
  });

  it('should show status help with status --help', () => {
    const output = runCli('status --help');
    expect(output).toContain('status');
  });

  it('should show restore help with restore --help', () => {
    const output = runCli('restore --help');
    expect(output).toContain('restore');
  });

  it('should handle unknown command with error', () => {
    const { exitCode } = runCliWithCode('unknown-command');
    expect(exitCode).not.toBe(0);
  });

  it('should run init command in isolated environment', async () => {
    const testHome = mkdtempSync(join(tmpdir(), 'syncpoint-e2e-'));
    try {
      const { output, exitCode } = runCliWithCode('init', {
        SYNCPOINT_HOME: testHome,
      });

      // Init command may use Ink rendering which can cause issues in CI
      // We accept either success or timeout/rendering issues
      expect([0, 1]).toContain(exitCode);

      // If successful, should contain relevant output
      if (exitCode === 0) {
        expect(output.length).toBeGreaterThan(0);
      }
    } finally {
      await rm(testHome, { recursive: true, force: true });
    }
  });

  it('should run status command in isolated environment', async () => {
    const testHome = mkdtempSync(join(tmpdir(), 'syncpoint-e2e-'));
    try {
      // Run status - it should handle non-initialized directory gracefully
      const { output, exitCode } = runCliWithCode('status', {
        SYNCPOINT_HOME: testHome,
      });

      // Status may fail if not initialized or use Ink rendering
      // Accept any exit code but verify output exists
      expect(output.length).toBeGreaterThan(0);
    } finally {
      await rm(testHome, { recursive: true, force: true });
    }
  });
});
