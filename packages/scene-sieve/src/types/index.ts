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
