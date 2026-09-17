import { describe, expect, it } from 'vitest';
import { resolveOptions } from '../../../core/input-resolver/index.js';
import { buildSieveMetadata } from '../../../core/utils/metadata/build-sieve-metadata.js';
import type { ProcessContext, VideoMetadata, SheetMetadata } from '../../../types/index.js';

/** Minimal file input state for deterministic metadata assembly tests. */
const ctx: ProcessContext = {
  options: resolveOptions({ mode: 'file', inputPath: '/private/input/example.mp4' }),
  workspacePath: '/temporary/path', frames: [{ id: 0, timestamp: 0, extractPath: '' }],
  graph: [], status: 'FINALIZING', emitProgress: () => {},
};
/** Complete video metadata passed through unchanged to the document. */
const video: VideoMetadata = { originalDurationMs: 2000, fps: 1, resolution: { width: 20, height: 10 },
  candidatesCount: 1, selectedCount: 1, source: { mode: 'file', fileName: 'example.mp4' } };

describe('buildSieveMetadata', () => {
  it('assembles only default keys and preserves inputs while converting animation IDs', () => {
    const animations = [{ type: 'loading_spinner', boundingBox: { x: 1, y: 2, width: 3, height: 4 }, startFrameId: 0, endFrameId: 2, durationMs: 123.6 }];
    const original = structuredClone(animations);
    const originalVideo = structuredClone(video);
    const doc = buildSieveMetadata({ ctx, selected: ctx.frames, video, animations, version: '0.2.0' });
    expect(Object.keys(doc)).toEqual(['metadataVersion', 'tool', 'video', 'frames', 'animations']);
    expect(doc.metadataVersion).toBe(2);
    expect(doc.video).toMatchObject({ candidatesCount: 1, selectedCount: 1, source: { mode: 'file', fileName: 'example.mp4' } });
    expect(doc.video).toBe(video);
    expect(doc.animations[0]).toEqual({ ...animations[0], startFrameId: 1, endFrameId: 3, durationMs: 124 });
    expect('sheet' in doc).toBe(false);
    expect('edges' in doc).toBe(false);
    expect(animations).toEqual(original);
    expect(video).toEqual(originalVideo);
  });
  it('appends sheet before edges only when requested', () => {
    const sheet: SheetMetadata = { fileName: 'sheet.jpg', columns: 1, tileWidth: 20, tileHeight: 10, frameIds: [1], sampled: false };
    const state = { ...ctx, options: { ...ctx.options, includeEdges: true } };
    const input = { ctx: state, selected: ctx.frames, video, animations: [], version: '0.2.0' };
    expect(Object.keys(buildSieveMetadata(input))).toEqual(['metadataVersion', 'tool', 'video', 'frames', 'animations', 'edges']);
    const doc = buildSieveMetadata({ ...input, sheet });
    expect(Object.keys(doc)).toEqual(['metadataVersion', 'tool', 'video', 'frames', 'animations', 'sheet', 'edges']);
    expect(doc.sheet).toBe(sheet);
    expect(doc.edges).toEqual([]);
  });
  it.each(['buffer', 'frames'] as const)('preserves video metadata in %s mode', (mode) => {
    const modeVideo: VideoMetadata = { ...video, selectedCount: 0, source: { mode, fileName: null } };
    const doc = buildSieveMetadata({ ctx: { ...ctx, options: { ...ctx.options, mode } }, selected: [], video: modeVideo, animations: [], version: '0.2.0' });
    expect(doc.video).toBe(modeVideo);
    expect(doc.video.source).toEqual({ mode, fileName: null });
  });
});
