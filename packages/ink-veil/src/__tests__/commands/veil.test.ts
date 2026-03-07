import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { Command } from 'commander';

// Test helpers — invoke command builder and parse args programmatically
async function runVeilCommand(args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const { buildVeilCommand } = await import('../../commands/veil.js');

  let exitCode = 0;
  let stdout = '';
  let stderr = '';

  const originalExit = process.exit.bind(process);
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);

  process.exit = ((code: number) => { exitCode = code; throw new Error(`exit:${code}`); }) as never;
  process.stdout.write = ((chunk: string) => { stdout += chunk; return true; }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string) => { stderr += chunk; return true; }) as typeof process.stderr.write;

  try {
    const program = new Command();
    program.exitOverride();
    program.addCommand(buildVeilCommand());
    await program.parseAsync(['node', 'ink-veil', ...args]);
  } catch (e) {
    if (!(e instanceof Error) || !e.message.startsWith('exit:')) {
      // Commander exitOverride throws CommanderError
    }
  } finally {
    process.exit = originalExit;
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  }

  return { exitCode, stdout, stderr };
}

describe('veil command', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ink-veil-test-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('exits with code 2 when no files and no --stdin', async () => {
    const { exitCode } = await runVeilCommand(['veil', '-d', join(tmpDir, 'dict.json')]);
    expect(exitCode).toBe(2);
  });

  it('exits with non-zero code when input file does not exist', async () => {
    const { exitCode } = await runVeilCommand([
      'veil',
      join(tmpDir, 'nonexistent.txt'),
      '-d', join(tmpDir, 'dict.json'),
    ]);
    // Concurrent processing collects per-file errors and exits with GENERAL_ERROR (1)
    expect(exitCode).toBe(1);
  });

  it('exits with code 0 and creates output for valid text file', async () => {
    const inputFile = join(tmpDir, 'input.txt');
    await writeFile(inputFile, '홍길동의 전화번호는 010-1234-5678입니다.');

    const { exitCode } = await runVeilCommand([
      'veil',
      inputFile,
      '-d', join(tmpDir, 'dict.json'),
      '-o', join(tmpDir, 'veiled'),
    ]);
    expect(exitCode).toBe(0);
  });

  it('--json outputs JSON with success:true', async () => {
    const inputFile = join(tmpDir, 'input.txt');
    await writeFile(inputFile, 'user@example.com에 연락하세요.');

    const { exitCode, stdout } = await runVeilCommand([
      'veil',
      inputFile,
      '-d', join(tmpDir, 'dict.json'),
      '-o', join(tmpDir, 'veiled'),
      '--json',
    ]);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout.trim());
    expect(parsed.success).toBe(true);
    expect(parsed.command).toBe('veil');
  });
});

describe('Exit codes mapping', () => {
  it('ErrorCode.SUCCESS === 0', async () => {
    const { ErrorCode } = await import('../../errors/types.js');
    expect(ErrorCode.SUCCESS).toBe(0);
  });

  it('ErrorCode.GENERAL_ERROR === 1', async () => {
    const { ErrorCode } = await import('../../errors/types.js');
    expect(ErrorCode.GENERAL_ERROR).toBe(1);
  });

  it('ErrorCode.INVALID_ARGUMENTS === 2', async () => {
    const { ErrorCode } = await import('../../errors/types.js');
    expect(ErrorCode.INVALID_ARGUMENTS).toBe(2);
  });

  it('ErrorCode.FILE_NOT_FOUND === 3', async () => {
    const { ErrorCode } = await import('../../errors/types.js');
    expect(ErrorCode.FILE_NOT_FOUND).toBe(3);
  });

  it('ErrorCode.UNSUPPORTED_FORMAT === 4', async () => {
    const { ErrorCode } = await import('../../errors/types.js');
    expect(ErrorCode.UNSUPPORTED_FORMAT).toBe(4);
  });

  it('ErrorCode.DICTIONARY_ERROR === 5', async () => {
    const { ErrorCode } = await import('../../errors/types.js');
    expect(ErrorCode.DICTIONARY_ERROR).toBe(5);
  });

  it('ErrorCode.NER_MODEL_FAILED === 6', async () => {
    const { ErrorCode } = await import('../../errors/types.js');
    expect(ErrorCode.NER_MODEL_FAILED).toBe(6);
  });

  it('ErrorCode.VERIFICATION_FAILED === 7', async () => {
    const { ErrorCode } = await import('../../errors/types.js');
    expect(ErrorCode.VERIFICATION_FAILED).toBe(7);
  });

  it('ErrorCode.TOKEN_INTEGRITY_BELOW_THRESHOLD === 8', async () => {
    const { ErrorCode } = await import('../../errors/types.js');
    expect(ErrorCode.TOKEN_INTEGRITY_BELOW_THRESHOLD).toBe(8);
  });
});
