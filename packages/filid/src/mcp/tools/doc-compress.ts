import {
  type ToolCallEntry,
  type ToolCallSummary,
  summarizeLossy,
} from '../../compress/lossy-summarizer.js';
import { compactReversible } from '../../compress/reversible-compactor.js';
import type { CompressionMeta } from '../../types/documents.js';

/** Input for doc-compress tool */
export interface DocCompressInput {
  /** Compression mode */
  mode: 'reversible' | 'lossy' | 'auto';
  /** File path (for reversible mode) */
  filePath?: string;
  /** File content (for reversible mode) */
  content?: string;
  /** Exported symbols (for reversible mode) */
  exports?: string[];
  /** Tool call entries (for lossy mode) */
  toolCallEntries?: ToolCallEntry[];
}

/** Output of doc-compress tool */
export interface DocCompressOutput {
  /** Compacted reference string (reversible) */
  compacted?: string;
  /** Lossy summary */
  summary?: ToolCallSummary;
  /** Compression metadata */
  meta?: CompressionMeta;
  /** Error message */
  error?: string;
}

/**
 * Handle doc-compress MCP tool calls.
 *
 * Modes:
 * - reversible: Compact file into path+metadata reference
 * - lossy: Merge tool call history into statistics
 * - auto: Choose based on available input data
 */
export function handleDocCompress(input: DocCompressInput): DocCompressOutput {
  const effectiveMode = input.mode === 'auto' ? inferMode(input) : input.mode;

  switch (effectiveMode) {
    case 'reversible':
      return handleReversible(input);
    case 'lossy':
      return handleLossy(input);
    default:
      return { error: `Cannot determine compression mode` };
  }
}

function inferMode(input: DocCompressInput): 'reversible' | 'lossy' {
  if (input.content !== undefined && input.filePath) return 'reversible';
  if (input.toolCallEntries && input.toolCallEntries.length > 0) return 'lossy';
  return 'reversible';
}

function handleReversible(input: DocCompressInput): DocCompressOutput {
  if (!input.content || !input.filePath) {
    return { error: 'Reversible mode requires filePath and content' };
  }

  const result = compactReversible({
    filePath: input.filePath,
    content: input.content,
    metadata: {
      exports: input.exports ?? [],
      lineCount: input.content.split('\n').filter((l) => l.length > 0).length,
    },
  });

  return {
    compacted: result.compacted,
    meta: result.meta,
  };
}

function handleLossy(input: DocCompressInput): DocCompressOutput {
  const entries = input.toolCallEntries ?? [];
  const result = summarizeLossy(entries);

  return {
    summary: result.summary,
    meta: result.meta,
  };
}
