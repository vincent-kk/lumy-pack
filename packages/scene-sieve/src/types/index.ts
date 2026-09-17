// ── Progress ──

export type ProgressPhase =
  | 'EXTRACTING'
  | 'ANALYZING'
  | 'PRUNING'
  | 'FINALIZING';

// ── Input Mode (Discriminated Union) ──

export type SieveInput =
  | { mode: 'file'; inputPath: string }
  | { mode: 'buffer'; inputBuffer: Buffer }
  | { mode: 'frames'; inputFrames: Buffer[] };

// ── Common Options ──

export interface SieveOptionsBase {
  /** Enable a contact sheet with defaults or selected overrides; disabled by default. */
  sheet?: boolean | SheetOptions;
  /** Include adjacent candidate edge diagnostics in the metadata document. */
  includeEdges?: boolean;
  count?: number; // default: 20
  threshold?: number; // default: 0.5. G(t) score threshold. Keeps frames with score >= threshold, capped by count.
  outputPath?: string; // default: derived from inputPath (file mode only)
  fps?: number; // default: 5
  /** Strict file/buffer candidate frame limit (default: 300); ignored in frames mode. */
  maxFrames?: number;
  scale?: number; // default: 720
  quality?: number; // JPEG output quality 1-100 (default: 80)
  iouThreshold?: number; // default: 0.9. IoU threshold for animation tracking.
  animationThreshold?: number; // default: 5. Minimum consecutive frames to be considered an animation.
  debug?: boolean; // default: false
  onProgress?: (phase: ProgressPhase, percent: number) => void;
  maxSegmentDuration?: number; // in seconds, default: 300 (5 minutes)
  concurrency?: number; // number of segments processed in parallel, default: 2
}

// ── Public API Type ──

export type SieveOptions = SieveOptionsBase & SieveInput;

// ── Internal Resolved Options (for ProcessContext) ──

export interface ResolvedOptions {
  /** Complete contact sheet settings, or null when disabled. */
  sheet: Required<SheetOptions> | null;
  /** Whether the document contains candidate edge diagnostics. */
  includeEdges: boolean;
  mode: 'file' | 'buffer' | 'frames';
  inputPath?: string;
  count: number;
  threshold: number; // default: 0.5
  pruneMode: 'threshold-with-cap';
  outputPath: string;
  fps: number;
  maxFrames: number;
  scale: number;
  quality: number;
  iouThreshold: number;
  animationThreshold: number;
  debug: boolean;
  maxSegmentDuration: number;
  concurrency: number;
}

// ── Result ──

export interface SieveResult {
  success: boolean;
  originalFramesCount: number;
  prunedFramesCount: number;
  outputFiles: string[];
  outputBuffers?: Buffer[];
  animations?: AnimationMetadata[];
  video?: VideoMetadata;
  /** Selected frames paired with output files or buffers; IDs are one-based. */
  frames?: FrameMetadata[];
  /** Layout of the rendered contact sheet; absent when no sheet exists. */
  sheet?: SheetMetadata;
  /** Encoded contact sheet for buffer and frames modes only. */
  sheetBuffer?: Buffer;
  executionTimeMs: number;
}

// ── Animation Metadata ──

export interface AnimationMetadata {
  type: string;
  boundingBox: BoundingBox;
  startFrameId: number;
  endFrameId: number;
  durationMs: number;
}

export interface VideoMetadata {
  /** Source duration from ffprobe, or the final candidate timestamp in frames mode. */
  originalDurationMs: number;
  /** Effective sampling frequency; frames mode uses one frame per second. */
  fps: number;
  /** Actual output JPEG dimensions; zero when no candidate exists. */
  resolution: {
    width: number;
    height: number;
  };
  /** Number of candidates before pruning. */
  candidatesCount: number;
  /** Number of selected frames after pruning. */
  selectedCount: number;
  /** Input mode and basename only; in-memory inputs have no file name. */
  source: { fileName: string | null; mode: 'file' | 'buffer' | 'frames' };
}

// ── Internal Pipeline Types ──

export interface FrameNode {
  id: number;
  timestamp: number;
  extractPath: string;
}

export interface ScoreEdge {
  sourceId: number;
  targetId: number;
  /**
   * Information gain score (G(t)) between adjacent frames.
   * Higher values = greater visual change (state transition) = should be preserved.
   * Lower values = similar frames (little change) = candidates for pruning.
   *
   * Pruner removes frames with the LOWEST scores first (greedy ascending).
   * Maps directly to G(t) from the vision analysis pipeline.
   */
  score: number;
  /** Analysis-space cluster partition; absent on failed pairs and synthetic edges. */
  change?: EdgeChange;
}

/** Optional contact sheet overrides, validated before defaults are applied. */
export interface SheetOptions {
  /** Maximum columns, an integer at least one; defaults to four. */
  columns?: number;
  /** Tile width in pixels, an integer at least sixteen; defaults to 320. */
  tileWidth?: number;
  /** Tile limit, an integer at least two; defaults to forty. */
  maxTiles?: number;
  /** Burn a frame ID and timestamp into each tile; defaults to true. */
  label?: boolean;
}

/** Adjacent-pair cluster boxes in analysis coordinates, partitioned by the tracker. */
export interface EdgeChange {
  /** Non-animation clusters in DBSCAN label order. */
  regions: BoundingBox[];
  /** Clusters whose indices the tracker classified as animation. */
  animatedRegions: BoundingBox[];
}

/** Change across the candidate edges between two selected frames. */
export interface FrameChange {
  /** Previous selected frame ID, one-based. */
  fromFrameId: number;
  /** Candidates pruned between the selected endpoints. */
  skippedCandidates: number;
  /** Maximum raw information gain, rounded to six decimals. */
  peakScore: number;
  /** Sum of raw information gain, rounded to six decimals. */
  sumScore: number;
  /** Non-animation union area fraction, clamped and rounded to four decimals. */
  areaRatio: number;
  /** Up to five distinct largest regions in clamped integer output pixels. */
  regions: BoundingBox[];
}

/** Selected frame timing and change signals shared by file and API output. */
export interface FrameMetadata {
  /** One-based position in the selected sequence. */
  step: number;
  /** Deterministic JPEG name, including for in-memory output pairing. */
  fileName: string;
  /** One-based candidate frame ID. */
  frameId: number;
  /** Rounded candidate timestamp in milliseconds. */
  timestampMs: number;
  /** Nonnegative time until the next selection or the source end. */
  holdsMs: number;
  /** Span summary, or null for the first selection. */
  change: FrameChange | null;
}

/** Raw candidate edge diagnostics in graph order. */
export interface EdgeMetadata {
  /** One-based source candidate ID. */
  sourceFrameId: number;
  /** One-based target candidate ID. */
  targetFrameId: number;
  /** Raw information gain rounded to six decimals. */
  score: number;
  /** Non-animation union area fraction rounded to four decimals. */
  areaRatio: number;
  /** Animation union area fraction rounded to four decimals. */
  animatedAreaRatio: number;
}

/** Selection and encoding settings in deterministic serialization order. */
export interface ToolParams {
  /** Requested extraction frequency, before the candidate cap. */
  fps: number;
  /** Requested maximum selected frame count. */
  count: number;
  /** Normalized pruning threshold. */
  threshold: number;
  /** Analysis image height in pixels. */
  scale: number;
  /** JPEG encoding quality. */
  quality: number;
  /** Strict file/buffer candidate cap. */
  maxFrames: number;
  /** Tracker overlap threshold. */
  iouThreshold: number;
  /** Consecutive frames required for animation classification. */
  animationThreshold: number;
  /** Maximum logical segment duration in seconds. */
  maxSegmentDuration: number;
}

/** Tool provenance and reproducible pipeline parameters. */
export interface ToolMetadata {
  /** Published package identifier. */
  name: '@lumy-pack/scene-sieve';
  /** Version from the runtime package manifest. */
  version: string;
  /** Nine selection and encoding parameters, excluding operational options. */
  params: ToolParams;
}

/** Contact sheet layout and sampled frame IDs in tile order. */
export interface SheetMetadata {
  /** Fixed output name. */
  fileName: 'sheet.jpg';
  /** Effective columns, capped by tile count. */
  columns: number;
  /** Tile width in pixels. */
  tileWidth: number;
  /** Aspect-preserving rounded tile height, at least one pixel. */
  tileHeight: number;
  /** One-based frame IDs ordered left-to-right, then top-to-bottom. */
  frameIds: number[];
  /** Whether the tile limit required uniform sampling. */
  sampled: boolean;
}

/** Version-two document; properties are serialized in declaration order. */
export interface SieveMetadata {
  /** Schema discriminator; absent in version-one documents. */
  metadataVersion: 2;
  /** Runtime tool provenance. */
  tool: ToolMetadata;
  /** Source timing, dimensions and candidate counts. */
  video: VideoMetadata;
  /** Selected frame summaries in temporal order. */
  frames: FrameMetadata[];
  /** Output-space animations with one-based IDs and integer durations. */
  animations: AnimationMetadata[];
  /** Present only when a sheet was rendered. */
  sheet?: SheetMetadata;
  /** Present only when includeEdges was enabled. */
  edges?: EdgeMetadata[];
}

// ── Bounding Box (for DBSCAN clusters) ──

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ── DBSCAN Result ──

export interface DBSCANResult {
  labels: number[];
  boundingBoxes: BoundingBox[];
}

// ── Process Context ──

export interface ProcessContext {
  options: ResolvedOptions;
  /** Actual extraction grid frequency; frames mode uses one-second intervals. */
  effectiveFps?: number;
  /** Original video duration reported by ffprobe, in seconds. */
  sourceDurationSec?: number;
  /** Dimensions of analysis-space boxes; absent or zero if no pair was analyzed. */
  analysisResolution?: { width: number; height: number };
  workspacePath: string;
  frames: FrameNode[];
  graph: ScoreEdge[];
  animations?: AnimationMetadata[];
  status: 'INIT' | ProgressPhase | 'SUCCESS' | 'FAILED';
  emitProgress: (percent: number) => void;
  error?: Error;
}

export interface AnalysisResult {
  edges: ScoreEdge[];
  animations: AnimationMetadata[];
  /** First analyzed image dimensions, or zero dimensions when no pair exists. */
  analysisResolution: { width: number; height: number };
}

// ── Segment Types (Long Video Segmentation) ──

export interface SegmentPlan {
  index: number;
  startTime: number; // logical start (seconds)
  endTime: number; // logical end (seconds)
  duration: number; // logical duration (seconds)
  /** FFmpeg output limit, including overlap slots; a single segment uses the full budget. */
  allocatedFrames: number;
  effectiveFps: number; // actual fps for this segment
  overlapBefore: number; // number of leading overlap frames (0 or 1)
  overlapAfter: number; // number of trailing overlap frames (0 or 1)
  /** First extraction grid time in seconds, including overlap. */
  extractStartTime: number;
  extractDuration: number; // actual FFmpeg extraction duration (including overlap)
}

export interface SegmentResult {
  segment: SegmentPlan;
  frames: FrameNode[];
  edges: ScoreEdge[];
  animations: AnimationMetadata[];
  /** Analysis coordinates retained through merging for output-only box scaling. */
  analysisResolution: { width: number; height: number };
}
