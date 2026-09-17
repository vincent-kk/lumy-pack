import type { ResolvedOptions, ToolMetadata } from '../../../types/index.js';

/**
 * Record the tool and the nine selection and encoding settings in contract order.
 * @param options - Validated pipeline settings; operational options are excluded.
 * @param version - Runtime package version supplied by the I/O boundary.
 * @returns Deterministic tool provenance without paths or execution details.
 */
export function buildToolMetadata(options: ResolvedOptions, version: string): ToolMetadata {
  return {
    name: '@lumy-pack/scene-sieve',
    version,
    params: {
      fps: options.fps,
      count: options.count,
      threshold: options.threshold,
      scale: options.scale,
      quality: options.quality,
      maxFrames: options.maxFrames,
      iouThreshold: options.iouThreshold,
      animationThreshold: options.animationThreshold,
      maxSegmentDuration: options.maxSegmentDuration,
    },
  };
}
