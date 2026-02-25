import { createRequire } from 'node:module';

import { Command } from 'commander';
import { render } from 'ink';
import React from 'react';

import { SieveView } from './commands/Sieve.js';
import {
  ANIMATION_FRAME_THRESHOLD,
  DEFAULT_FPS,
  DEFAULT_MAX_FRAMES,
  DEFAULT_QUALITY,
  DEFAULT_SCALE,
  IOU_THRESHOLD,
} from './constants.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };

const program = new Command();

program
  .name('scene-sieve')
  .description('Extract key frames from video and GIF files')
  .version(version)
  .argument('<input>', 'Input video or GIF file path')
  .option('-n, --count <number>', 'Max number of frames to keep (default: 20)')
  .option(
    '-t, --threshold <number>',
    'Normalized threshold 0~1 (default: 0.5; keeps frames above ratio of max change)',
  )
  .option('-o, --output <path>', 'Output directory path')
  .option('--fps <number>', 'Max FPS for frame extraction', String(DEFAULT_FPS))
  .option(
    '-mf, --max-frames <number>',
    'Max frames to extract (auto-reduces FPS for long videos)',
    String(DEFAULT_MAX_FRAMES),
  )
  .option(
    '-s, --scale <number>',
    'Scale size for vision analysis',
    String(DEFAULT_SCALE),
  )
  .option(
    '-q, --quality <number>',
    'JPEG output quality 1-100',
    String(DEFAULT_QUALITY),
  )
  .option(
    '-it, --iou-threshold <number>',
    `IoU threshold for animation tracking (0-1) (default: ${IOU_THRESHOLD})`,
  )
  .option(
    '-at, --anim-threshold <number>',
    `Min consecutive frames for animation (default: ${ANIMATION_FRAME_THRESHOLD})`,
  )
  .option('--debug', 'Enable debug mode (preserve temp workspace)')
  .action(async (input: string, opts) => {
    const { waitUntilExit } = render(
      React.createElement(SieveView, {
        input,
        ...(opts.threshold !== undefined
          ? { threshold: parseFloat(opts.threshold) }
          : {}),
        ...(opts.count !== undefined
          ? { count: parseInt(opts.count, 10) }
          : {}),
        output: opts.output,
        fps: parseInt(opts.fps, 10),
        maxFrames: parseInt(opts.maxFrames, 10),
        scale: parseInt(opts.scale, 10),
        quality: parseInt(opts.quality, 10),
        iouThreshold:
          opts.iouThreshold !== undefined
            ? parseFloat(opts.iouThreshold)
            : undefined,
        animationThreshold:
          opts.animThreshold !== undefined
            ? parseInt(opts.animThreshold, 10)
            : undefined,
        debug: opts.debug ?? false,
      }),
    );
    await waitUntilExit();
  });

program.parseAsync(process.argv).catch((error: Error) => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
