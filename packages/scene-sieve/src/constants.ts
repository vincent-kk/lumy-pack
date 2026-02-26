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

// Pruner -- Percentile-based normalization
export const NORMALIZATION_PERCENTILE = 0.9;

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

// Vision Analysis — Pixel-Diff Fallback (AKAZE blind spot 보완)
export const PIXELDIFF_GAUSSIAN_KERNEL = 3; // absdiff 노이즈 제거 블러 커널
export const PIXELDIFF_BINARY_THRESHOLD = 30; // 그레이스케일 diff 이진화 임계값 (0-255)
export const PIXELDIFF_CONTOUR_MIN_AREA = 100; // 최소 contour 면적 (px^2), 커서 깜빡임 필터
export const PIXELDIFF_SAMPLE_SPACING = 8; // contour 내부 그리드 샘플링 간격 (px)

export function getTempWorkspaceDir(sessionId: string): string {
  return join(TEMP_BASE_DIR, `${WORKSPACE_PREFIX}${sessionId}`);
}
