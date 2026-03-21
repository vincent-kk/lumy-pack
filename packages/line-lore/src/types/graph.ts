import type { TraceNode } from './pipeline.js';

export interface GraphOptions {
  type: 'pr' | 'issue';
  number: number;
  depth?: number;
  /** Git remote name to use for platform detection (default: 'origin') */
  remote?: string;
}

export interface GraphResult {
  nodes: TraceNode[];
  edges: Array<{ from: string; to: string; relation: string }>;
}
