import { filter, forEach, isTruthy, map } from '@winglet/common-utils';

import { gitExec } from '../../../git/executor.js';
import type { CosmeticReason, GitExecOptions } from '../../../types/index.js';

export interface CosmeticCheckResult {
  isCosmetic: boolean;
  reason?: CosmeticReason;
}

export function isCosmeticDiff(diff: string): CosmeticCheckResult {
  const hunks = extractHunks(diff);
  if (hunks.length === 0) return { isCosmetic: false };

  // Check import reorder first (more specific than whitespace)
  if (isImportReorder(hunks)) {
    return { isCosmetic: true, reason: 'import-order' };
  }

  if (isWhitespaceOnly(hunks)) {
    return { isCosmetic: true, reason: 'whitespace' };
  }

  if (isFormattingOnly(hunks)) {
    return { isCosmetic: true, reason: 'formatting' };
  }

  return { isCosmetic: false };
}

export async function getCosmeticDiff(
  commitSha: string,
  filePath: string,
  options?: GitExecOptions,
): Promise<string> {
  const result = await gitExec(
    ['diff', `${commitSha}^..${commitSha}`, '--', filePath],
    options,
  );
  return result.stdout;
}

interface DiffHunk {
  removed: string[];
  added: string[];
}

function extractHunks(diff: string): DiffHunk[] {
  const lines = diff.split('\n');
  const hunks: DiffHunk[] = [];
  let current: DiffHunk | null = null;

  for (const line of lines) {
    if (line.startsWith('@@')) {
      if (current) hunks.push(current);
      current = { removed: [], added: [] };
      continue;
    }

    if (!current) continue;

    if (line.startsWith('-') && !line.startsWith('---')) {
      current.removed.push(line.slice(1));
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      current.added.push(line.slice(1));
    }
  }

  if (current) hunks.push(current);
  return hunks;
}

function normalize(line: string): string {
  return line.replace(/\s+/g, '').trim();
}

function isWhitespaceOnly(hunks: DiffHunk[]): boolean {
  return hunks.every((hunk) => {
    const removedNorm: string[] = [];
    forEach(hunk.removed, (line) => {
      const n = normalize(line);
      if (isTruthy(n)) removedNorm.push(n);
    });
    removedNorm.sort();

    const addedNorm: string[] = [];
    forEach(hunk.added, (line) => {
      const n = normalize(line);
      if (isTruthy(n)) addedNorm.push(n);
    });
    addedNorm.sort();

    if (removedNorm.length !== addedNorm.length) return false;
    return removedNorm.every((line, idx) => line === addedNorm[idx]);
  });
}

function isImportReorder(hunks: DiffHunk[]): boolean {
  return hunks.every((hunk) => {
    const removedImports = filter(hunk.removed, isImportLine);
    const addedImports = filter(hunk.added, isImportLine);

    if (removedImports.length === 0) return false;
    if (
      removedImports.length !==
      filter(hunk.removed, (l) => isTruthy(l.trim())).length
    )
      return false;
    if (
      addedImports.length !==
      filter(hunk.added, (l) => isTruthy(l.trim())).length
    )
      return false;

    const removedSorted = map(removedImports, normalize).sort();
    const addedSorted = map(addedImports, normalize).sort();

    if (removedSorted.length !== addedSorted.length) return false;
    return removedSorted.every((line, idx) => line === addedSorted[idx]);
  });
}

function isImportLine(line: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed.startsWith('import ') ||
    trimmed.startsWith('from ') ||
    trimmed.startsWith('require(') ||
    (trimmed.startsWith('const ') && trimmed.includes('require('))
  );
}

function isFormattingOnly(hunks: DiffHunk[]): boolean {
  return hunks.every((hunk) => {
    // Compare all alphanumeric tokens as a single joined set
    const removedTokens = extractAlphanumericTokens(hunk.removed.join(' '));
    const addedTokens = extractAlphanumericTokens(hunk.added.join(' '));
    return removedTokens === addedTokens;
  });
}

function extractAlphanumericTokens(line: string): string {
  return (line.match(/[a-zA-Z0-9_]+/g) ?? []).join(' ');
}
