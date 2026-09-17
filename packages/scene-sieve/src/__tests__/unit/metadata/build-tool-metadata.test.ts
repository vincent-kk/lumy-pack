import { expect, it } from 'vitest';
import { resolveOptions } from '../../../core/input-resolver/index.js';
import { buildToolMetadata } from '../../../core/utils/metadata/build-tool-metadata.js';

it('records exactly nine params in contract order', () => {
  const options = resolveOptions({ mode: 'frames', inputFrames: [], debug: true, sheet: true, includeEdges: true, concurrency: 7 });
  const result = buildToolMetadata(options, '1.2.3');
  expect(result.name).toBe('@lumy-pack/scene-sieve');
  expect(result.version).toBe('1.2.3');
  expect(Object.keys(result.params)).toEqual(['fps', 'count', 'threshold', 'scale', 'quality', 'maxFrames', 'iouThreshold', 'animationThreshold', 'maxSegmentDuration']);
  expect(result.params).toEqual({ fps: 5, count: 20, threshold: 0.5, scale: 720, quality: 80, maxFrames: 300, iouThreshold: 0.9, animationThreshold: 5, maxSegmentDuration: 300 });
});
