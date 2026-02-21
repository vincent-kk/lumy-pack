import type { CompressionMeta } from '../types/documents.js';

/** Input for reversible compaction */
export interface CompactInput {
  /** Original file path */
  filePath: string;
  /** Original file content */
  content: string;
  /** Extracted metadata */
  metadata: {
    exports: string[];
    lineCount: number;
  };
}

/** Result of reversible compaction */
export interface CompactResult {
  /** Compacted string representation */
  compacted: string;
  /** Whether original is recoverable */
  recoverable: boolean;
  /** Original line count */
  originalLines: number;
  /** Compacted line count */
  compactedLines: number;
  /** Compression metadata */
  meta: CompressionMeta;
}

/** Parsed data from a compacted reference */
export interface RestoredReference {
  /** File path */
  filePath: string;
  /** Exported symbols */
  exports: string[];
}

/**
 * Compact file content into a reversible reference.
 * Preserves only file path and metadata — the original file
 * on disk remains untouched, allowing full restoration.
 */
export function compactReversible(input: CompactInput): CompactResult {
  const { filePath, content, metadata } = input;
  const originalLines = content.length === 0 ? 0 : content.split('\n').filter((l) => l.length > 0).length;
  const exportsStr = metadata.exports.length > 0
    ? metadata.exports.join(', ')
    : '(none)';

  const compacted = [
    `[REF] ${filePath}`,
    `[EXPORTS] ${exportsStr}`,
    `[LINES] ${metadata.lineCount}`,
  ].join('\n');

  const compactedLines = 3;

  return {
    compacted,
    recoverable: true,
    originalLines,
    compactedLines,
    meta: {
      method: 'reversible',
      originalLines,
      compressedLines: compactedLines,
      timestamp: new Date().toISOString(),
      recoverable: true,
    },
  };
}

/**
 * Parse a compacted reference string back into structured data.
 * Actual file content must be re-read from disk.
 */
export function restoreFromCompacted(compacted: string): RestoredReference {
  const lines = compacted.split('\n');

  let filePath = '';
  let exports: string[] = [];

  for (const line of lines) {
    if (line.startsWith('[REF] ')) {
      filePath = line.slice(6).trim();
    } else if (line.startsWith('[EXPORTS] ')) {
      const raw = line.slice(10).trim();
      exports = raw === '(none)' ? [] : raw.split(', ').map((s) => s.trim());
    }
  }

  return { filePath, exports };
}
