import type { SieveOptionsBase } from '../types/index.js';

/**
 * Common pipeline options parsed from CLI opts (Commander string values → typed values).
 * Does NOT include mode-specific fields (mode, inputPath, onProgress).
 */
export type ParsedPipelineOptions = Pick<
  Required<SieveOptionsBase>,
  'fps' | 'maxFrames' | 'scale' | 'quality' | 'debug'
> &
  Pick<
    SieveOptionsBase,
    | 'count'
    | 'threshold'
    | 'outputPath'
    | 'iouThreshold'
    | 'animationThreshold'
    | 'maxSegmentDuration'
    | 'concurrency'
  >;

export interface RawCliOptions {
  count?: string;
  threshold?: string;
  output?: string;
  fps: string;
  maxFrames: string;
  scale: string;
  quality: string;
  iouThreshold?: string;
  animThreshold?: string;
  maxSegmentDuration?: string;
  concurrency?: string;
  debug?: boolean;
}

export function parsePipelineOptions(
  opts: RawCliOptions,
): ParsedPipelineOptions {
  return {
    ...(opts.threshold !== undefined
      ? { threshold: parseFloat(opts.threshold) }
      : {}),
    ...(opts.count !== undefined ? { count: parseInt(opts.count, 10) } : {}),
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
  };
}
