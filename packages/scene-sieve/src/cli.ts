import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';

import { Command } from 'commander';
import { render } from 'ink';
import React from 'react';

import { respond, respondError } from '@lumy-pack/shared';

import { SieveView } from './commands/Sieve.js';
import {
  ANIMATION_FRAME_THRESHOLD,
  DEFAULT_FPS,
  DEFAULT_MAX_FRAMES,
  DEFAULT_MAX_SEGMENT_DURATION,
  DEFAULT_QUALITY,
  DEFAULT_SCALE,
  DEFAULT_SEGMENT_CONCURRENCY,
  IOU_THRESHOLD,
} from './constants.js';
import { runPipeline } from './core/orchestrator.js';
import { SieveErrorCode } from './errors.js';

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
  .option(
    '--max-segment-duration <number>',
    `Max segment duration in seconds for long video splitting (default: ${DEFAULT_MAX_SEGMENT_DURATION})`,
  )
  .option(
    '--concurrency <number>',
    `Number of segments to process in parallel (default: ${DEFAULT_SEGMENT_CONCURRENCY})`,
  )
  .option('--debug', 'Enable debug mode (preserve temp workspace)')
  .option('--json', 'Output structured JSON to stdout')
  .option('--describe', 'Output JSON schema of available options')
  .action(async (input: string, opts) => {
    if (opts.describe) {
      const startTime = Date.now();
      const schema = {
        name: program.name(),
        version,
        description: program.description(),
        arguments: program.registeredArguments.map((a) => ({
          name: a.name(),
          description: a.description,
          required: a.required,
        })),
        options: program.options.map((o) => ({
          flag: o.flags,
          description: o.description,
          default: o.defaultValue,
        })),
      };
      respond('describe', schema, startTime, version);
      return;
    }

    if (opts.json) {
      const startTime = Date.now();

      if (!existsSync(input)) {
        respondError(
          'extract',
          SieveErrorCode.FILE_NOT_FOUND,
          `File not found: ${input}`,
          startTime,
          version,
        );
        return;
      }

      try {
        const result = await runPipeline({
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
          maxSegmentDuration:
            opts.maxSegmentDuration !== undefined
              ? parseInt(opts.maxSegmentDuration, 10)
              : undefined,
          concurrency:
            opts.concurrency !== undefined
              ? parseInt(opts.concurrency, 10)
              : undefined,
          debug: opts.debug ?? false,
          onProgress: (phase, percent) => {
            process.stderr.write(JSON.stringify({ phase, percent }) + '\n');
          },
        });

        const data = {
          success: result.success,
          originalFrames: result.originalFramesCount,
          selectedFrames: result.prunedFramesCount,
          outputFiles: result.outputFiles,
          animations: result.animations ?? [],
          video: result.video ?? null,
        };
        respond('extract', data, startTime, version);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        const msg = err.message.toLowerCase();
        let errorCode: SieveErrorCode;
        if ((err as NodeJS.ErrnoException).code === 'ENOENT' || msg.includes('not found')) {
          errorCode = SieveErrorCode.FILE_NOT_FOUND;
        } else if (msg.includes('no video stream') || msg.includes('invalid format')) {
          errorCode = SieveErrorCode.INVALID_FORMAT;
        } else if (msg.includes('worker')) {
          errorCode = SieveErrorCode.WORKER_ERROR;
        } else {
          errorCode = SieveErrorCode.PIPELINE_ERROR;
        }
        respondError('extract', errorCode, err.message, startTime, version);
      }
      return;
    }

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
        maxSegmentDuration:
          opts.maxSegmentDuration !== undefined
            ? parseInt(opts.maxSegmentDuration, 10)
            : undefined,
        concurrency:
          opts.concurrency !== undefined
            ? parseInt(opts.concurrency, 10)
            : undefined,
        debug: opts.debug ?? false,
      }),
    );
    await waitUntilExit();
  });

program.parseAsync(process.argv).catch((error: Error) => {
  if (process.argv.includes('--json')) {
    respondError('extract', SieveErrorCode.UNKNOWN, error.message, Date.now(), version);
  } else {
    console.error('Fatal error:', error.message);
  }
  process.exit(1);
});
