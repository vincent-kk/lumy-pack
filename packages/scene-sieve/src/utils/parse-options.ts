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

/**
 * Parse one complete decimal string without truncating fractional values.
 * @param value - Decimal CLI argument, optionally using an exponent.
 * @param integer - Whether the result must be an integer.
 * @returns The finite parsed number, or NaN for invalid input.
 */
function parseNumberStrict(value: string, integer = false): number {
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) return NaN;
  const number = Number(value);
  return Number.isFinite(number) && (!integer || Number.isInteger(number))
    ? number
    : NaN;
}

/**
 * Convert CLI strings to pipeline values for subsequent range validation.
 * @param opts - Commander options with raw numeric strings.
 * @returns Typed settings, preserving invalid numeric input as NaN.
 */
export function parsePipelineOptions(
  opts: RawCliOptions,
): ParsedPipelineOptions {
  return {
    ...(opts.threshold !== undefined
      ? { threshold: parseNumberStrict(opts.threshold) }
      : {}),
    ...(opts.count !== undefined
      ? { count: parseNumberStrict(opts.count, true) }
      : {}),
    outputPath: opts.output,
    fps: parseNumberStrict(opts.fps),
    maxFrames: parseNumberStrict(opts.maxFrames, true),
    scale: parseNumberStrict(opts.scale, true),
    quality: parseNumberStrict(opts.quality, true),
    iouThreshold:
      opts.iouThreshold !== undefined
        ? parseNumberStrict(opts.iouThreshold)
        : undefined,
    animationThreshold:
      opts.animThreshold !== undefined
        ? parseNumberStrict(opts.animThreshold, true)
        : undefined,
    maxSegmentDuration:
      opts.maxSegmentDuration !== undefined
        ? parseNumberStrict(opts.maxSegmentDuration)
        : undefined,
    concurrency:
      opts.concurrency !== undefined
        ? parseNumberStrict(opts.concurrency, true)
        : undefined,
    debug: opts.debug ?? false,
  };
}
