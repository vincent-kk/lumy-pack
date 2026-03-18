import { LineLoreError, LineLoreErrorCode } from '../errors.js';
import type { LineRange } from '../types/index.js';

export function parseLineRange(input: string): LineRange {
  const parts = input.split(',');

  if (parts.length > 2) {
    throw new LineLoreError(
      LineLoreErrorCode.INVALID_LINE,
      `Invalid line range format: "${input}". Expected "line" or "start,end".`,
      { input },
    );
  }

  const start = parseLineNumber(parts[0], input);
  const end = parts.length === 2 ? parseLineNumber(parts[1], input) : start;

  if (start > end) {
    throw new LineLoreError(
      LineLoreErrorCode.INVALID_LINE,
      `Invalid line range: start (${start}) must be <= end (${end}).`,
      { input, start, end },
    );
  }

  return { start, end };
}

function parseLineNumber(value: string, originalInput: string): number {
  const trimmed = value.trim();

  if (trimmed === '' || !/^\d+$/.test(trimmed)) {
    throw new LineLoreError(
      LineLoreErrorCode.INVALID_LINE,
      `Invalid line number: "${trimmed}". Must be a positive integer.`,
      { input: originalInput },
    );
  }

  const num = Number(trimmed);

  if (num <= 0) {
    throw new LineLoreError(
      LineLoreErrorCode.INVALID_LINE,
      `Invalid line number: ${num}. Must be a positive integer.`,
      { input: originalInput },
    );
  }

  return num;
}
