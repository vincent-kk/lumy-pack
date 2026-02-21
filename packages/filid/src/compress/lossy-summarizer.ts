import type { CompressionMeta } from '../types/documents.js';

/** Tool call history entry */
export interface ToolCallEntry {
  tool: string;
  path: string;
  timestamp: string;
}

/** Summary of merged tool call history */
export interface ToolCallSummary {
  totalEntries: number;
  toolCounts: Record<string, number>;
  uniqueFiles: string[];
  timeRange: {
    earliest: string;
    latest: string;
  };
}

/** Result of lossy summarization */
export interface LossySummaryResult {
  summary: ToolCallSummary;
  recoverable: boolean;
  meta: CompressionMeta;
}

/**
 * Perform lossy summarization of tool call history entries.
 * Merges multiple entries into aggregated statistics.
 * Original individual entries are discarded (non-recoverable).
 */
export function summarizeLossy(entries: ToolCallEntry[]): LossySummaryResult {
  if (entries.length === 0) {
    return {
      summary: {
        totalEntries: 0,
        toolCounts: {},
        uniqueFiles: [],
        timeRange: { earliest: '', latest: '' },
      },
      recoverable: false,
      meta: {
        method: 'lossy',
        originalLines: 0,
        compressedLines: 0,
        timestamp: new Date().toISOString(),
        recoverable: false,
      },
    };
  }

  // Count by tool name
  const toolCounts: Record<string, number> = {};
  for (const entry of entries) {
    toolCounts[entry.tool] = (toolCounts[entry.tool] ?? 0) + 1;
  }

  // Unique files
  const uniqueFiles = [...new Set(entries.map((e) => e.path))];

  // Time range
  const timestamps = entries.map((e) => e.timestamp).sort();
  const earliest = timestamps[0];
  const latest = timestamps[timestamps.length - 1];

  const summary: ToolCallSummary = {
    totalEntries: entries.length,
    toolCounts,
    uniqueFiles,
    timeRange: { earliest, latest },
  };

  return {
    summary,
    recoverable: false,
    meta: {
      method: 'lossy',
      originalLines: entries.length,
      compressedLines: 1,
      timestamp: new Date().toISOString(),
      recoverable: false,
    },
  };
}
