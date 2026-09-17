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

/** Default maximum contact sheet columns. */
export const DEFAULT_SHEET_COLUMNS = 4;
/** Default contact sheet tile width in pixels. */
export const DEFAULT_SHEET_TILE_WIDTH = 320;
/** Default maximum contact sheet tiles. */
export const DEFAULT_SHEET_MAX_TILES = 40;
/** Enable timestamp labels on contact sheet tiles by default. */
export const DEFAULT_SHEET_LABEL = true;
/** White contact sheet margin and gap in pixels. */
export const SHEET_TILE_GAP = 4;
/** Tile-height fraction used for label font size. */
export const SHEET_LABEL_HEIGHT_RATIO = 0.07;
/** Maximum distinct regions retained per selected-frame span. */
export const CHANGE_REGION_LIMIT = 5;
/** Metadata schema discriminator. */
export const METADATA_VERSION = 2;
/** Fixed contact sheet output name. */
export const SHEET_FILE_NAME = 'sheet.jpg';
/** Fixed metadata document output name. */
export const METADATA_FILE_NAME = '.metadata.json';
