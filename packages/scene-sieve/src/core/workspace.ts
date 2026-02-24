import { cp, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';

import type { FrameNode, ProcessContext } from '../types/index.js';
import { getTempWorkspaceDir } from '../constants.js';
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
