import type { FidelityTier } from '../types.js';

export type SegmentPosition =
  | { type: 'offset'; start: number; end: number }
  | { type: 'jsonpath'; path: string }
  | { type: 'xmlpath'; xpath: string }
  | { type: 'cell'; row: number; col: number }
  | { type: 'node'; nodeId: string }
  | { type: 'generic'; info: Record<string, unknown> };

export interface TextSegment {
  text: string;
  position: SegmentPosition;
  skippable: boolean;
}

export interface ParsedDocument {
  format: string;
  tier: FidelityTier;
  encoding: string;
  segments: TextSegment[];
  metadata: Record<string, unknown>;
  originalBuffer?: Buffer;
}

export interface FormatParser {
  readonly tier: FidelityTier;
  parse(buffer: Buffer, encoding?: string): Promise<ParsedDocument>;
  reconstruct(parsed: ParsedDocument): Promise<Buffer>;
}
