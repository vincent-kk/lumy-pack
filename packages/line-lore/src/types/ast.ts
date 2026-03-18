import type { Confidence } from './pipeline.js';

export type SymbolKind = 'function' | 'method' | 'class' | 'arrow_function';

export interface SymbolInfo {
  name: string;
  kind: SymbolKind;
  startLine: number;
  endLine: number;
  bodyText: string;
}

export interface ContentHash {
  exact: string;
  structural: string;
}

export type ChangeType =
  | 'rename'
  | 'move'
  | 'extract'
  | 'identical'
  | 'new'
  | 'modified';

export interface ComparisonResult {
  change: ChangeType;
  fromName?: string;
  toName?: string;
  fromFile?: string;
  confidence: Confidence;
}

export interface AstTraceResult {
  originSha: string;
  originSymbol: SymbolInfo;
  trackingMethod: 'ast-signature';
  confidence: Confidence;
  changes: ComparisonResult[];
}
