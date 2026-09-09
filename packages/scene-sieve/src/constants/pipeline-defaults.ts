/**
 * Default values for scene-sieve pipeline options (frame count, threshold, extraction, segmentation).
 */

// Pipeline defaults
export const DEFAULT_COUNT = 20;
export const DEFAULT_THRESHOLD = 0.5;
export const DEFAULT_FPS = 5;
export const DEFAULT_SCALE = 720;
export const DEFAULT_QUALITY = 80;
export const DEFAULT_MAX_FRAMES = 300;

// Long Video Segmentation
export const DEFAULT_MAX_SEGMENT_DURATION = 300; // 5 minutes
export const DEFAULT_SEGMENT_CONCURRENCY = 2;

// Vision Analysis — IoU Tracking
export const IOU_THRESHOLD = 0.9;
export const ANIMATION_FRAME_THRESHOLD = 5;
