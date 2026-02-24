import { cp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { FrameNode, ProcessContext } from '../types/index.js';
import { FRAME_OUTPUT_EXTENSION, getTempWorkspaceDir } from '../constants.js';
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

  const outputFiles: string[] = [];
  for (let i = 0; i < selectedFrames.length; i++) {
    const frame = selectedFrames[i];
    const destName = `scene_${String(i + 1).padStart(3, '0')}.jpg`;
    const destPath = join(stagingDir, destName);
    await cp(frame.extractPath, destPath);
    outputFiles.push(join(outputPath, destName));
  }

  await ensureDir(join(outputPath, '..'));
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
 * Read selected FrameNode files as Buffers.
 * Used to return output buffers in 'buffer' and 'frames' modes.
 */
export async function readFramesAsBuffers(frameNodes: FrameNode[]): Promise<Buffer[]> {
  return Promise.all(frameNodes.map((f) => readFile(f.extractPath)));
}
