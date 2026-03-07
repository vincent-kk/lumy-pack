import { existsSync } from 'node:fs';
import { Command } from 'commander';
import { ErrorCode } from '../errors/types.js';
import { resolveModelDir, isModelInstalled, ensureModel } from '../detection/kiwi/downloader.js';

export function buildModelCommand(): Command {
  const model = new Command('model').description('Manage Kiwi NER models');

  model
    .command('download')
    .description('Download Kiwi morphological model to ~/.ink-veil/models/')
    .action(async () => {
      if (isModelInstalled('kiwi-base')) {
        process.stdout.write(`Model already installed: ${resolveModelDir('kiwi-base')}\n`);
        process.exit(ErrorCode.SUCCESS);
      }

      const result = await ensureModel('kiwi-base');
      if (result) {
        process.stdout.write(`Model installed: ${result}\n`);
        process.exit(ErrorCode.SUCCESS);
      } else {
        process.exit(ErrorCode.NER_MODEL_FAILED);
      }
    });

  model
    .command('status')
    .description('Show Kiwi model installation status')
    .action(async () => {
      if (isModelInstalled('kiwi-base')) {
        process.stdout.write(`kiwi-base: installed (${resolveModelDir('kiwi-base')})\n`);
      } else {
        process.stdout.write('kiwi-base: not installed. Run: ink-veil model download\n');
      }
      process.exit(ErrorCode.SUCCESS);
    });

  model
    .command('list')
    .description('List installed models')
    .action(async () => {
      if (isModelInstalled('kiwi-base')) {
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
      const { join } = await import('node:path');
      const { homedir } = await import('node:os');
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
