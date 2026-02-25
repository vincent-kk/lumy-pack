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
  maxFrames?: number; // default: 300. Caps extracted frames; FPS is auto-reduced for long videos.
  scale?: number; // default: 720
  quality?: number; // JPEG output quality 1-100 (default: 80)
  iouThreshold?: number; // default: 0.9. IoU threshold for animation tracking.
  animationThreshold?: number; // default: 5. Minimum consecutive frames to be considered an animation.
  debug?: boolean; // default: false
  onProgress?: (phase: ProgressPhase, percent: number) => void;
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
  originalDurationMs: number;
  fps: number;
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
}
