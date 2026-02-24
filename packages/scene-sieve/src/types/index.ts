// ── Progress ──

export type ProgressPhase =
  | 'EXTRACTING'
  | 'ANALYZING'
  | 'PRUNING'
  | 'FINALIZING';

// ── Public API ──

export interface SieveOptions {
  inputPath: string;
  count?: number;
  outputPath?: string;
  fps?: number;
  scale?: number;
  debug?: boolean;
  onProgress?: (phase: ProgressPhase, percent: number) => void;
}

export interface SieveResult {
  success: boolean;
  originalFramesCount: number;
  prunedFramesCount: number;
  outputFiles: string[];
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
  score: number;
}

export interface ProcessContext {
  options: Required<Omit<SieveOptions, 'onProgress'>>;
  workspacePath: string;
  frames: FrameNode[];
  graph: ScoreEdge[];
  status: 'INIT' | ProgressPhase | 'SUCCESS' | 'FAILED';
  emitProgress: (percent: number) => void;
  error?: Error;
}
