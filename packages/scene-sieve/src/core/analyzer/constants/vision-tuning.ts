/**
 * Tuning constants for the OpenCV-based vision analysis pipeline (DBSCAN, feature matching, pixel-diff fallback).
 */

// OpenCV batch size for memory-efficient processing
export const OPENCV_BATCH_SIZE = 10;

// Vision Analysis — DBSCAN
export const DBSCAN_ALPHA = 0.03;
export const DBSCAN_MIN_PTS = 4;

// Vision Analysis — IoU Tracking
export const DECAY_LAMBDA = 0.95;

// Vision Analysis — Feature Matching
export const MATCH_DISTANCE_THRESHOLD = 0.25;

// Vision Analysis — Pixel-Diff Fallback (compensates for AKAZE blind spots)
export const PIXELDIFF_GAUSSIAN_KERNEL = 3; // blur kernel for absdiff noise removal
export const PIXELDIFF_BINARY_THRESHOLD = 30; // grayscale diff binarization threshold (0-255)
export const PIXELDIFF_CONTOUR_MIN_AREA = 100; // minimum contour area (px^2) to filter cursor blinking
export const PIXELDIFF_SAMPLE_SPACING = 8; // grid sampling spacing inside contours (px)
