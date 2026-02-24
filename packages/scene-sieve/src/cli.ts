import { createRequire } from 'node:module';

import { Command } from 'commander';

import { extractScenes } from './index.js';
import type { ProgressPhase } from './types/index.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };

const program = new Command();

program
  .name('scene-sieve')
  .description('Extract key frames from video and GIF files')
  .version(version)
  .argument('<input>', 'Input video or GIF file path')
  .option('-n, --count <number>', 'Number of frames to keep (default: 5 when no --threshold)')
  .option('-t, --threshold <number>', 'Normalized threshold 0~1 (keeps frames above ratio of max change; combine with -n to cap result count)')
  .option('-o, --output <path>', 'Output directory path')
  .option('--fps <number>', 'Fallback FPS for frame extraction', '5')
  .option('-s, --scale <number>', 'Scale size for vision analysis', '720')
  .option('-q, --quality <number>', 'JPEG output quality 1-100', '80')
  .option('--debug', 'Enable debug mode (preserve temp workspace)')
  .action(async (input: string, opts) => {
    const { default: ora } = await import('ora');
    const { default: cliProgress } = await import('cli-progress');

    const spinner = ora('Initializing...').start();

    try {
      spinner.stop();

      const bar = new cliProgress.SingleBar({
        format: '{phase} |{bar}| {percentage}%',
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true,
      });

      bar.start(100, 0, { phase: 'EXTRACTING' });

      const result = await extractScenes({
        mode: 'file',
        inputPath: input,
        ...(opts.threshold !== undefined
          ? { threshold: parseFloat(opts.threshold) }
          : {}),
        ...(opts.count !== undefined
          ? { count: parseInt(opts.count, 10) }
          : {}),
        outputPath: opts.output,
        fps: parseInt(opts.fps, 10),
        scale: parseInt(opts.scale, 10),
        quality: parseInt(opts.quality, 10),
        debug: opts.debug ?? false,
        onProgress: (phase: ProgressPhase, percent: number) => {
          bar.update(Math.round(percent), { phase });
        },
      });

      bar.stop();

      console.log(
        `\nDone! ${result.originalFramesCount} frames -> ${result.prunedFramesCount} scenes (${result.executionTimeMs}ms)`,
      );
      console.log(`Output: ${result.outputFiles[0]?.replace(/\/[^/]+$/, '/')}`);
      result.outputFiles.forEach((f) => console.log(`  - ${f}`));
    } catch (error) {
      spinner.fail(
        `Failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exit(1);
    }
  });

program.parseAsync(process.argv).catch((error: Error) => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
