import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Temp workspace naming and frame file layout for pipeline runs.
 */

export const APP_NAME = 'scene-sieve';

// Workspace
export const WORKSPACE_PREFIX = `${APP_NAME}-`;
export const TEMP_BASE_DIR = tmpdir();

// File patterns
export const FRAME_OUTPUT_EXTENSION = '.jpg';
export const FRAME_FILENAME_PATTERN = 'frame_%06d.jpg';

export function getTempWorkspaceDir(sessionId: string): string {
  return join(TEMP_BASE_DIR, `${WORKSPACE_PREFIX}${sessionId}`);
}
