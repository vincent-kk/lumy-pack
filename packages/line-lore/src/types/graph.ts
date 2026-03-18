import type { TraceNode } from './pipeline.js';

export interface GraphOptions {
  type: 'pr' | 'issue';
  number: number;
  depth?: number;
  json?: boolean;
}

export interface GraphResult {
  nodes: TraceNode[];
  edges: Array<{ from: string; to: string; relation: string }>;
}
