import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const APP_NAME = 'scene-sieve';

// Pipeline defaults
export const DEFAULT_COUNT = 5;
export const DEFAULT_FPS = 5;
export const DEFAULT_SCALE = 720;

// Workspace
export const WORKSPACE_PREFIX = `${APP_NAME}-`;
export const TEMP_BASE_DIR = tmpdir();

// File patterns
export const SUPPORTED_VIDEO_EXTENSIONS = [
  '.mp4',
  '.mov',
  '.avi',
  '.mkv',
  '.webm',
];
export const SUPPORTED_GIF_EXTENSIONS = ['.gif'];
export const FRAME_OUTPUT_EXTENSION = '.jpg';
export const FRAME_FILENAME_PATTERN = 'frame_%06d.jpg';

// OpenCV batch size for memory-efficient processing
export const OPENCV_BATCH_SIZE = 10;

// Minimum I-Frame count before falling back to FPS extraction
export const MIN_IFRAME_COUNT = 3;

export function getTempWorkspaceDir(sessionId: string): string {
  return join(TEMP_BASE_DIR, `${WORKSPACE_PREFIX}${sessionId}`);
}
