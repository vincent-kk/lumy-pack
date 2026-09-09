import { describe, expect, it } from 'vitest';

import { parsePipelineOptions } from '../../utils/parse-options.js';

describe('parsePipelineOptions', () => {
  it.each([
    ['fps', '0.5', 0.5],
    ['count', '1.5', NaN],
    ['scale', '5abc', NaN],
    ['threshold', '0.5abc', NaN],
    ['fps', '', NaN],
    ['fps', 'Infinity', NaN],
    ['fps', '1e-1', 0.1],
    ['maxSegmentDuration', '0.5', 0.5],
    ['maxFrames', '2.5', NaN],
    ['quality', '80junk', NaN],
    ['concurrency', '1.5', NaN],
    ['iouThreshold', '0.9junk', NaN],
  ])('parses the entire %s value %s', (name, value, expected) => {
    const result = parsePipelineOptions({
      fps: '5',
      maxFrames: '300',
      scale: '720',
      quality: '80',
      [name]: value,
    });
    expect(result[name as keyof typeof result]).toBe(expected);
  });

  it('rejects fractional animation frame counts', () => {
    expect(
      parsePipelineOptions({
        fps: '5',
        maxFrames: '300',
        scale: '720',
        quality: '80',
        animThreshold: '1.5',
      }).animationThreshold,
    ).toBeNaN();
  });
});
