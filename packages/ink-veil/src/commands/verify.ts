import { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { verify } from '../verification/verify.js';
import { ErrorCode } from '../errors/types.js';
import type { FidelityTier } from '../types.js';

export function buildVerifyCommand(): Command {
  const cmd = new Command('verify').description('Verify round-trip fidelity between original and restored files');

  cmd
    .argument('<original>', 'Path to original file')
    .argument('<restored>', 'Path to restored file')
    .option('--tier <tier>', 'Fidelity tier: 1a, 1b, 2, 3, 4', '1a')
    .option('--json', 'Output structured JSON to stdout')
    .action(async (original: string, restored: string, opts: Record<string, unknown>) => {
      const jsonMode = Boolean(opts['json']);
      const tier = String(opts['tier'] ?? '1a') as FidelityTier;

      const origPath = resolve(original);
      const restPath = resolve(restored);

      if (!existsSync(origPath)) {
        process.stderr.write(`ink-veil: File not found: ${origPath}\n`);
        process.exit(ErrorCode.FILE_NOT_FOUND);
      }
      if (!existsSync(restPath)) {
        process.stderr.write(`ink-veil: File not found: ${restPath}\n`);
        process.exit(ErrorCode.FILE_NOT_FOUND);
      }

      const origBuf = await readFile(origPath);
      const restBuf = await readFile(restPath);

      const result = await verify(origBuf, restBuf, tier);

      if (!result.ok) {
        process.stderr.write(`ink-veil: Verification error: ${result.error.message}\n`);
        process.exit(ErrorCode.VERIFICATION_FAILED);
      }

      const vr = result.value;

      if (!jsonMode) {
        process.stdout.write(`Verification ${vr.passed ? 'PASSED' : 'FAILED'} (tier=${tier}, method=${vr.method})\n`);
        if (vr.detail) process.stdout.write(`  ${vr.detail}\n`);
      } else {
        const output = {
          success: true,
          command: 'verify',
          passed: vr.passed,
          method: vr.method,
          tier: vr.tier,
          detail: vr.detail,
          ...(vr.hashOriginal ? { hashOriginal: vr.hashOriginal } : {}),
          ...(vr.hashRestored ? { hashRestored: vr.hashRestored } : {}),
        };
        process.stdout.write(JSON.stringify(output, null, 2) + '\n');
      }

      if (vr.passed === false) {
        process.exit(ErrorCode.VERIFICATION_FAILED);
      }
      process.exit(ErrorCode.SUCCESS);
    });

  return cmd;
}
