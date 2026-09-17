import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { renderContactSheet } from '../../core/utils/sheet/render-contact-sheet.js';
import type { FrameNode } from '../../types/index.js';

let directory: string;
const frames: FrameNode[] = [];
const options = { columns: 2, tileWidth: 80, maxTiles: 40, label: false };

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'scene-sieve-sheet-'));
  for (const [id, background] of ['red', 'green', 'blue'].entries()) {
    const extractPath = join(directory, `${id}.jpg`);
    await sharp({ create: { width: 160, height: 90, channels: 3, background } }).jpeg().toFile(extractPath);
    frames.push({ id, timestamp: id, extractPath });
  }
});
afterAll(async () => { await rm(directory, { recursive: true, force: true }); });

describe('renderContactSheet', () => {
  it('renders the row-major grid with exact dimensions and metadata', async () => {
    const result = await renderContactSheet({ selected: frames, resolution: { width: 160, height: 90 }, options, quality: 80 });
    expect(await sharp(result.buffer).metadata()).toMatchObject({ format: 'jpeg', width: 172, height: 102 });
    expect(result.metadata).toEqual({ fileName: 'sheet.jpg', columns: 2, tileWidth: 80, tileHeight: 45, frameIds: [1, 2, 3], sampled: false });
    const { data, info } = await sharp(result.buffer).raw().toBuffer({ resolveWithObject: true });
    const red = (25 * info.width + 40) * info.channels;
    const blue = (75 * info.width + 40) * info.channels;
    expect(data[red]).toBeGreaterThan(200);
    expect(data[red + 2]).toBeLessThan(30);
    expect(data[blue + 2]).toBeGreaterThan(200);
  });
  it('caps the effective columns for one frame', async () => {
    const result = await renderContactSheet({ selected: frames.slice(0, 1), resolution: { width: 160, height: 90 }, options, quality: 80 });
    expect(result.metadata.columns).toBe(1);
    expect(await sharp(result.buffer).metadata()).toMatchObject({ width: 88, height: 53 });
  });
  it('renders labels and produces identical bytes on repeated input', async () => {
    const input = { selected: frames, resolution: { width: 160, height: 90 }, options, quality: 80 };
    const plain = await renderContactSheet(input);
    const labeled = await renderContactSheet({ ...input, options: { ...options, label: true } });
    const repeated = await renderContactSheet({ ...input, options: { ...options, label: true } });
    expect(labeled.buffer.equals(plain.buffer)).toBe(false);
    expect(labeled.buffer.equals(repeated.buffer)).toBe(true);
    expect(labeled.metadata).toEqual(repeated.metadata);
  });
  it('samples both endpoints and clamps a very short tile height to one pixel', async () => {
    const result = await renderContactSheet({ selected: frames, resolution: { width: 160, height: 1 }, options: { ...options, tileWidth: 16, maxTiles: 2, label: true }, quality: 80 });
    expect(result.metadata).toMatchObject({ tileHeight: 1, frameIds: [1, 3], sampled: true });
    expect(await sharp(result.buffer).metadata()).toMatchObject({ width: 44, height: 9 });
  });
});
