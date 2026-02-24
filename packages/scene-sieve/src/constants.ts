import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const APP_NAME = 'scene-sieve';

// Pipeline defaults
export const DEFAULT_COUNT = 20;
export const DEFAULT_THRESHOLD = 0.5;
export const DEFAULT_FPS = 5;
export const DEFAULT_SCALE = 720;
export const DEFAULT_QUALITY = 80;

// Pruner -- Percentile-based normalization
export const NORMALIZATION_PERCENTILE = 0.9;

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

// Vision Analysis — DBSCAN
export const DBSCAN_ALPHA = 0.03;
export const DBSCAN_MIN_PTS = 4;

// Vision Analysis — IoU Tracking
export const IOU_THRESHOLD = 0.9;
export const DECAY_LAMBDA = 0.95;
export const ANIMATION_FRAME_THRESHOLD = 5;

// Vision Analysis — Feature Matching
export const MATCH_DISTANCE_THRESHOLD = 0.75;

export function getTempWorkspaceDir(sessionId: string): string {
  return join(TEMP_BASE_DIR, `${WORKSPACE_PREFIX}${sessionId}`);
}
