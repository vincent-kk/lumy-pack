import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const APP_NAME = 'scene-sieve';

// Pipeline defaults
export const DEFAULT_COUNT = 20;
export const DEFAULT_THRESHOLD = 0.5;
export const DEFAULT_FPS = 5;
export const DEFAULT_SCALE = 720;
export const DEFAULT_QUALITY = 80;
export const DEFAULT_MAX_FRAMES = 300;

// Pruner -- Robust Hybrid Normalization
export const NORMALIZATION_MIN_PERCENTILE = 0.1;
export const NORMALIZATION_MAX_PERCENTILE = 0.9;
export const NORMALIZATION_LOGISTIC_K = 3.0; // Sharpness of sigmoid curve
export const NORMALIZATION_ALPHA = 0.4; // Weight of CDF (rank) vs Logistic-Z (intensity)
export const NORMALIZATION_MAD_COEFFICIENT = 1.4826; // Scale MAD to match standard normal distribution
export const NORMALIZATION_MIN_SAMPLE_SIZE = 10; // Min samples before switching to robust stats

// Workspace
export const WORKSPACE_PREFIX = `${APP_NAME}-`;
export const TEMP_BASE_DIR = tmpdir();

// File patterns
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
export const MATCH_DISTANCE_THRESHOLD = 0.25;

// Vision Analysis — Pixel-Diff Fallback (compensates for AKAZE blind spots)
export const PIXELDIFF_GAUSSIAN_KERNEL = 3; // blur kernel for absdiff noise removal
export const PIXELDIFF_BINARY_THRESHOLD = 30; // grayscale diff binarization threshold (0-255)
export const PIXELDIFF_CONTOUR_MIN_AREA = 100; // minimum contour area (px^2) to filter cursor blinking
export const PIXELDIFF_SAMPLE_SPACING = 8; // grid sampling spacing inside contours (px)

// Long Video Segmentation
export const DEFAULT_MAX_SEGMENT_DURATION = 300; // 5 minutes
export const DEFAULT_SEGMENT_CONCURRENCY = 2;

export function getTempWorkspaceDir(sessionId: string): string {
  return join(TEMP_BASE_DIR, `${WORKSPACE_PREFIX}${sessionId}`);
}
