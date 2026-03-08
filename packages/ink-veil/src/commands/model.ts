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
    .description('List installed models with disk usage')
    .action(async () => {
      if (isModelInstalled('kiwi-base')) {
        const modelDir = resolveModelDir('kiwi-base');
        let sizeStr = '';
        try {
          const { readdirSync, statSync } = await import('node:fs');
          let totalBytes = 0;
          const walkDir = (dir: string) => {
            for (const entry of readdirSync(dir, { withFileTypes: true })) {
              const fullPath = `${dir}/${entry.name}`;
              if (entry.isDirectory()) walkDir(fullPath);
              else totalBytes += statSync(fullPath).size;
            }
          };
          walkDir(modelDir);
          const mb = (totalBytes / (1024 * 1024)).toFixed(1);
          sizeStr = ` (${mb} MB)`;
        } catch { /* ignore size calculation errors */ }
        process.stdout.write(`kiwi-base (installed)${sizeStr}  ${modelDir}\n`);
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
