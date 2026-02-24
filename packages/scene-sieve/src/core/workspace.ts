import { readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import sharp from 'sharp';

import {
  FRAME_OUTPUT_EXTENSION,
  TEMP_BASE_DIR,
  WORKSPACE_PREFIX,
  getTempWorkspaceDir,
} from '../constants.js';
import type { FrameNode, ProcessContext } from '../types/index.js';
import { ensureDir } from '../utils/paths.js';

export async function createWorkspace(sessionId: string): Promise<string> {
  const workspacePath = getTempWorkspaceDir(sessionId);
  await ensureDir(join(workspacePath, 'frames'));
  await ensureDir(join(workspacePath, 'output'));
  return workspacePath;
}

export async function finalizeOutput(
  ctx: ProcessContext,
  selectedFrames: FrameNode[],
): Promise<string[]> {
  const stagingDir = join(ctx.workspacePath, 'output');
  const outputPath = ctx.options.outputPath;

  const quality = ctx.options.quality;

  const outputFiles: string[] = [];
  for (let i = 0; i < selectedFrames.length; i++) {
    const frame = selectedFrames[i];
    const destName = `scene_${String(i + 1).padStart(3, '0')}.jpg`;
    const destPath = join(stagingDir, destName);
    await sharp(frame.extractPath)
      .jpeg({ quality, mozjpeg: true })
      .toFile(destPath);
    outputFiles.push(join(outputPath, destName));
  }

  await ensureDir(join(outputPath, '..'));
  await rm(outputPath, { recursive: true, force: true });
  await rename(stagingDir, outputPath);

  return outputFiles;
}

export async function cleanupWorkspace(workspacePath: string): Promise<void> {
  if (!workspacePath) return;
  try {
    await rm(workspacePath, { recursive: true, force: true });
  } catch {
    // Cleanup failure is non-fatal; OS cleans tmpdir on reboot
  }
}

const STALE_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

/**
 * Remove stale workspace directories left by previous interrupted runs.
 * Only deletes directories older than 1 hour to avoid removing active workspaces.
 */
export async function cleanupStaleWorkspaces(): Promise<void> {
  const entries = await readdir(TEMP_BASE_DIR);
  const now = Date.now();

  for (const entry of entries) {
    if (!entry.startsWith(WORKSPACE_PREFIX)) continue;
    const fullPath = join(TEMP_BASE_DIR, entry);
    try {
      const info = await stat(fullPath);
      if (info.isDirectory() && now - info.mtimeMs > STALE_THRESHOLD_MS) {
        await rm(fullPath, { recursive: true, force: true });
      }
    } catch {
      // Skip entries that can't be stat'd or removed
    }
  }
}

/**
 * Write a video buffer to a temp file in the workspace and return the path.
 * Used by 'buffer' input mode.
 */
export async function writeInputBuffer(
  buffer: Buffer,
  workspacePath: string,
): Promise<string> {
  const inputDir = join(workspacePath, 'input');
  await ensureDir(inputDir);
  const tempPath = join(inputDir, 'input.mp4');
  await writeFile(tempPath, buffer);
  return tempPath;
}

/**
 * Write an array of frame Buffers as JPG files and return FrameNode[].
 * Used by 'frames' input mode.
 */
export async function writeInputFrames(
  frames: Buffer[],
  workspacePath: string,
): Promise<FrameNode[]> {
  const framesDir = join(workspacePath, 'frames');
  await ensureDir(framesDir);

  const frameNodes: FrameNode[] = [];
  for (let i = 0; i < frames.length; i++) {
    const filename = `frame_${String(i).padStart(6, '0')}${FRAME_OUTPUT_EXTENSION}`;
    const extractPath = join(framesDir, filename);
    await writeFile(extractPath, frames[i]);
    frameNodes.push({ id: i, timestamp: i, extractPath });
  }
  return frameNodes;
}

/**
 * Read selected FrameNode files as Buffers with JPEG compression.
 * Used to return output buffers in 'buffer' and 'frames' modes.
 */
export async function readFramesAsBuffers(
  frameNodes: FrameNode[],
  quality: number,
): Promise<Buffer[]> {
  return Promise.all(
    frameNodes.map((f) =>
      sharp(f.extractPath).jpeg({ quality, mozjpeg: true }).toBuffer(),
    ),
  );
}
