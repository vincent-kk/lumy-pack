import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';

import {
  cleanupWorkspace,
  createWorkspace,
  finalizeOutput,
  readFramesAsBuffers,
  writeInputBuffer,
  writeInputFrames,
} from '../../core/workspace.js';
import type { ProcessContext } from '../../types/index.js';
import { fileExists } from '../../utils/paths.js';

/** Create a tiny valid JPEG buffer for testing */
async function createTestJpeg(): Promise<Buffer> {
  return sharp({
    create: {
      width: 4,
      height: 4,
      channels: 3,
      background: { r: 128, g: 128, b: 128 },
    },
  })
    .jpeg({ quality: 80 })
    .toBuffer();
}

const testWorkspaces: string[] = [];

async function makeTempWorkspace(): Promise<string> {
  const p = join(tmpdir(), `scene-sieve-test-${randomUUID()}`);
  await mkdir(p, { recursive: true });
  testWorkspaces.push(p);
  return p;
}

afterEach(async () => {
  for (const ws of testWorkspaces.splice(0)) {
    await rm(ws, { recursive: true, force: true });
  }
});

describe('createWorkspace', () => {
  it('creates frames/ and output/ subdirectories', async () => {
    const sessionId = randomUUID();
    const workspacePath = await createWorkspace(sessionId);
    testWorkspaces.push(workspacePath);

    expect(await fileExists(join(workspacePath, 'frames'))).toBe(true);
    expect(await fileExists(join(workspacePath, 'output'))).toBe(true);
  });
});

describe('finalizeOutput', () => {
  it('copies frames to staging and renames to output path', async () => {
    const ws = await makeTempWorkspace();
    const framesDir = join(ws, 'frames');
    const outputDir = join(ws, 'output');
    await mkdir(framesDir, { recursive: true });
    await mkdir(outputDir, { recursive: true });

    // Create a valid JPEG frame file
    const framePath = join(framesDir, 'frame_000001.jpg');
    await writeFile(framePath, await createTestJpeg());

    const outputPath = join(ws, 'final_output');
    const ctx: ProcessContext = {
      options: {
        mode: 'file',
        count: 5,
        threshold: 0.5,
        pruneMode: 'threshold-with-cap',
        outputPath,
        fps: 5,
        maxFrames: 300,
        scale: 720,
        quality: 80,
        debug: false,
      },
      workspacePath: ws,
      frames: [],
      graph: [],
      status: 'FINALIZING',
      emitProgress: () => {},
    };

    const selectedFrames = [{ id: 0, timestamp: 0, extractPath: framePath }];
    const outputFiles = await finalizeOutput(ctx, selectedFrames);

    expect(outputFiles).toHaveLength(1);
    expect(outputFiles[0]).toContain('scene_001.jpg');
    expect(await fileExists(outputFiles[0])).toBe(true);
  });
});

describe('cleanupWorkspace', () => {
  it('removes workspace directory', async () => {
    const ws = await makeTempWorkspace();
    expect(await fileExists(ws)).toBe(true);
    await cleanupWorkspace(ws);
    expect(await fileExists(ws)).toBe(false);
  });

  it('does not throw if workspacePath is empty string', async () => {
    await expect(cleanupWorkspace('')).resolves.not.toThrow();
  });

  it('does not throw if path does not exist', async () => {
    await expect(
      cleanupWorkspace('/tmp/nonexistent-path-xyz-123'),
    ).resolves.not.toThrow();
  });
});

describe('writeInputBuffer', () => {
  it('writes buffer to temp file and returns path', async () => {
    const ws = await makeTempWorkspace();
    const data = Buffer.from('fake-video-data');
    const resultPath = await writeInputBuffer(data, ws);

    expect(resultPath).toContain('input.mp4');
    expect(await fileExists(resultPath)).toBe(true);
  });
});

describe('writeInputFrames', () => {
  it('writes frame buffers as JPGs and returns FrameNode[]', async () => {
    const ws = await makeTempWorkspace();
    await mkdir(join(ws, 'frames'), { recursive: true });

    const frames = [
      Buffer.from('frame-0-data'),
      Buffer.from('frame-1-data'),
      Buffer.from('frame-2-data'),
    ];

    const frameNodes = await writeInputFrames(frames, ws);

    expect(frameNodes).toHaveLength(3);
    for (let i = 0; i < frameNodes.length; i++) {
      expect(frameNodes[i].id).toBe(i);
      expect(await fileExists(frameNodes[i].extractPath)).toBe(true);
    }
  });
});

describe('readFramesAsBuffers', () => {
  it('reads frame files as Buffers', async () => {
    const ws = await makeTempWorkspace();
    const framesDir = join(ws, 'frames');
    await mkdir(framesDir, { recursive: true });

    const jpegBuf = await createTestJpeg();
    const frameNodes = [];

    for (let i = 0; i < 2; i++) {
      const p = join(framesDir, `frame_${i}.jpg`);
      await writeFile(p, jpegBuf);
      frameNodes.push({ id: i, timestamp: i, extractPath: p });
    }

    const buffers = await readFramesAsBuffers(frameNodes, 80);
    expect(buffers).toHaveLength(2);
    for (const buf of buffers) {
      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.length).toBeGreaterThan(0);
    }
  });
});
