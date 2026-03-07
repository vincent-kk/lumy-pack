import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { execSync } from 'node:child_process';
import { Command } from 'commander';
import { ErrorCode } from '../errors/types.js';

const KIWI_MODEL_DIR = join(homedir(), '.ink-veil', 'models', 'kiwi-base', 'base');
const KIWI_MODEL_URL = 'https://github.com/bab2min/Kiwi/releases/download/v0.22.2/kiwi_model_v0.22.2_base.tgz';

function isModelInstalled(): boolean {
  return existsSync(join(KIWI_MODEL_DIR, 'sj.morph'));
}

export function buildModelCommand(): Command {
  const model = new Command('model').description('Manage Kiwi NER models');

  model
    .command('download')
    .description('Download Kiwi morphological model to ~/.ink-veil/models/')
    .action(async () => {
      if (isModelInstalled()) {
        process.stdout.write(`Model already installed: ${KIWI_MODEL_DIR}\n`);
        process.exit(ErrorCode.SUCCESS);
      }

      try {
        const parentDir = join(homedir(), '.ink-veil', 'models', 'kiwi-base');
        await mkdir(parentDir, { recursive: true });
        process.stderr.write('ink-veil: Downloading Kiwi model (~16MB)...\n');
        execSync(
          `curl -sL "${KIWI_MODEL_URL}" | tar -xzf - --strip-components=2 -C "${parentDir}"`,
          { stdio: ['pipe', 'pipe', 'inherit'] },
        );
        process.stdout.write(`Model installed: ${KIWI_MODEL_DIR}\n`);
        process.exit(ErrorCode.SUCCESS);
      } catch (err) {
        process.stderr.write(`ink-veil: model download failed — ${err instanceof Error ? err.message : String(err)}\n`);
        process.exit(ErrorCode.NER_MODEL_FAILED);
      }
    });

  model
    .command('status')
    .description('Show Kiwi model installation status')
    .action(async () => {
      if (isModelInstalled()) {
        process.stdout.write(`kiwi-base: installed (${KIWI_MODEL_DIR})\n`);
      } else {
        process.stdout.write('kiwi-base: not installed. Run: ink-veil model download\n');
      }
      process.exit(ErrorCode.SUCCESS);
    });

  model
    .command('list')
    .description('List installed models')
    .action(async () => {
      if (isModelInstalled()) {
        process.stdout.write(`kiwi-base (installed)\n`);
      } else {
        process.stdout.write('No models installed. Run: ink-veil model download\n');
      }
      process.exit(ErrorCode.SUCCESS);
    });

  model
    .command('remove')
    .description('Remove cached Kiwi model from ~/.ink-veil/models/')
    .argument('[model]', 'Model ID to remove', 'kiwi-base')
    .action(async () => {
      const parentDir = join(homedir(), '.ink-veil', 'models', 'kiwi-base');
      if (!existsSync(parentDir)) {
        process.stdout.write('No model to remove.\n');
        process.exit(ErrorCode.SUCCESS);
      }
      const { rm } = await import('node:fs/promises');
      await rm(parentDir, { recursive: true, force: true });
      process.stdout.write('Model removed: kiwi-base\n');
      process.exit(ErrorCode.SUCCESS);
    });

  return model;
}
