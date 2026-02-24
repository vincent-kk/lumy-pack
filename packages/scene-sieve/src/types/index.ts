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
  count?: number;        // default: 5 (when no threshold specified)
  threshold?: number;    // G(t) score threshold. Keeps frames with score >= threshold. When combined with count, caps result to at most count frames.
  outputPath?: string;   // default: derived from inputPath (file mode only)
  fps?: number;          // default: 5
  scale?: number;        // default: 720
  debug?: boolean;       // default: false
  onProgress?: (phase: ProgressPhase, percent: number) => void;
}

// ── Public API Type ──

export type SieveOptions = SieveOptionsBase & SieveInput;

// ── Internal Resolved Options (for ProcessContext) ──

export interface ResolvedOptions {
  mode: 'file' | 'buffer' | 'frames';
  inputPath?: string;
  count: number;
  threshold?: number;    // undefined = count mode, number = threshold mode
  pruneMode: 'count' | 'threshold' | 'threshold-with-cap';
  outputPath: string;
  fps: number;
  scale: number;
  debug: boolean;
}

// ── Result ──

export interface SieveResult {
  success: boolean;
  originalFramesCount: number;
  prunedFramesCount: number;
  outputFiles: string[];
  outputBuffers?: Buffer[];
  executionTimeMs: number;
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
  status: 'INIT' | ProgressPhase | 'SUCCESS' | 'FAILED';
  emitProgress: (percent: number) => void;
  error?: Error;
}
