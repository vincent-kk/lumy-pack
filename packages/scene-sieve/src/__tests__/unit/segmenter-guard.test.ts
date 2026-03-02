import { describe, expect, it } from 'vitest';

import { shouldSegment } from '../../core/segmenter.js';
import type { ResolvedOptions, SieveOptions } from '../../types/index.js';

// ── Helpers ──

function makeResolvedOptions(
  overrides: Partial<ResolvedOptions> = {},
): ResolvedOptions {
  return {
    mode: 'file',
    count: 20,
    threshold: 0.5,
    pruneMode: 'threshold-with-cap',
    outputPath: '/tmp/out',
    fps: 5,
    maxFrames: 300,
    scale: 720,
    quality: 80,
    iouThreshold: 0.9,
    animationThreshold: 5,
    debug: false,
    maxSegmentDuration: 300,
    concurrency: 2,
    ...overrides,
  };
}

function makeFileOptions(inputPath: string): SieveOptions {
  return { mode: 'file', inputPath };
}

// ── shouldSegment ──

describe('shouldSegment', () => {
  it('frames mode: always returns false', () => {
    const resolved = makeResolvedOptions({ mode: 'frames' });
    const options: SieveOptions = {
      mode: 'frames',
      inputFrames: [],
    };
    expect(shouldSegment(resolved, options)).toBe(false);
  });

  it.each([
    ['file mode + .gif input: returns false', '/path/to/animation.gif', false],
    ['file mode + .GIF input (uppercase): returns false (case insensitive)', '/path/to/animation.GIF', false],
    ['file mode + mixed case extension (.Gif): returns false', '/path/to/animation.Gif', false],
    ['file mode + .mp4 input: returns true', '/path/to/video.mp4', true],
    ['file mode + .mov input: returns true', '/path/to/video.mov', true],
    ['file mode + .gif in path directory (not extension): returns true', '/path/gif.stuff/video.mp4', true],
  ])('%s', (_label, inputPath, expected) => {
    const resolved = makeResolvedOptions({ mode: 'file' });
    const options = makeFileOptions(inputPath);
    expect(shouldSegment(resolved, options)).toBe(expected);
  });

  it('buffer mode: returns true', () => {
    const resolved = makeResolvedOptions({ mode: 'buffer' });
    const options: SieveOptions = {
      mode: 'buffer',
      inputBuffer: Buffer.from(''),
    };
    expect(shouldSegment(resolved, options)).toBe(true);
  });
});
