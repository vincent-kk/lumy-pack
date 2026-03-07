import { Command } from 'commander';
import { ModelManager, MODEL_REGISTRY } from '../detection/ner/model-manager.js';
import { ErrorCode } from '../errors/types.js';

export function buildModelCommand(): Command {
  const model = new Command('model').description('Manage NER models');

  model
    .command('download')
    .description('Pre-download NER model to ~/.ink-veil/models/')
    .option('--model <id>', 'Model ID to download', 'gliner_multi-v2.1')
    .action(async (opts: { model: string }) => {
      const modelId = opts.model;
      if (!MODEL_REGISTRY[modelId]) {
        process.stderr.write(`ink-veil: Unknown model "${modelId}". Available: ${Object.keys(MODEL_REGISTRY).join(', ')}\n`);
        process.exit(ErrorCode.INVALID_ARGUMENTS);
      }

      const manager = new ModelManager();
      try {
        const path = await manager.ensureModel(modelId);
        process.stdout.write(`Model installed: ${path}\n`);
        process.exit(ErrorCode.SUCCESS);
      } catch (err) {
        process.stderr.write(`ink-veil: model download failed — ${err instanceof Error ? err.message : String(err)}\n`);
        process.exit(ErrorCode.NER_MODEL_FAILED);
      }
    });

  model
    .command('status')
    .description('Show installation status of all NER models')
    .action(async () => {
      const manager = new ModelManager();
      const statuses = await manager.status();

      for (const s of statuses) {
        const info = MODEL_REGISTRY[s.modelId]!;
        if (!s.installed) {
          process.stdout.write(`${s.modelId}: not installed (${Math.round(info.sizeBytes / 1_048_576)}MB)\n`);
        } else if (s.checksumOk) {
          process.stdout.write(`${s.modelId}: installed (${Math.round(info.sizeBytes / 1_048_576)}MB, checksum OK)\n`);
        } else {
          process.stdout.write(`${s.modelId}: installed but checksum MISMATCH — run model download to repair\n`);
        }
      }
      process.exit(ErrorCode.SUCCESS);
    });

  model
    .command('list')
    .description('List installed NER models with disk size')
    .action(async () => {
      const manager = new ModelManager();
      const installed = await manager.list();

      if (installed.length === 0) {
        process.stdout.write('No models installed. Run: ink-veil model download\n');
        process.exit(ErrorCode.SUCCESS);
      }

      for (const s of installed) {
        const info = MODEL_REGISTRY[s.modelId]!;
        const status = s.checksumOk ? 'checksum OK' : 'checksum MISMATCH';
        process.stdout.write(`${s.modelId} (${Math.round(info.sizeBytes / 1_048_576)}MB, ${status})\n`);
      }
      process.exit(ErrorCode.SUCCESS);
    });

  model
    .command('remove')
    .description('Remove a cached NER model from ~/.ink-veil/models/')
    .argument('<model>', 'Model ID to remove')
    .action(async (modelId: string) => {
      if (!MODEL_REGISTRY[modelId]) {
        process.stderr.write(`ink-veil: Unknown model "${modelId}". Available: ${Object.keys(MODEL_REGISTRY).join(', ')}\n`);
        process.exit(ErrorCode.INVALID_ARGUMENTS);
      }

      const manager = new ModelManager();
      try {
        await manager.removeModel(modelId);
        process.stdout.write(`Model removed: ${modelId}\n`);
        process.exit(ErrorCode.SUCCESS);
      } catch (err) {
        process.stderr.write(`ink-veil: model remove failed — ${err instanceof Error ? err.message : String(err)}\n`);
        process.exit(ErrorCode.NER_MODEL_FAILED);
      }
    });

  return model;
}
