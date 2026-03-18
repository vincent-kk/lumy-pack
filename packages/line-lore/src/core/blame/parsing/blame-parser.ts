import type { BlameResult } from '../../../types/index.js';

export function parsePorcelainOutput(output: string): BlameResult[] {
  const results: BlameResult[] = [];
  const lines = output.split('\n');
  let i = 0;

  while (i < lines.length) {
    const headerLine = lines[i];
    if (!headerLine || headerLine.trim() === '') {
      i++;
      continue;
    }

    const headerMatch =
      /^([0-9a-f]{40}|[\^][0-9a-f]{39})\s+(\d+)\s+(\d+)(?:\s+(\d+))?$/.exec(
        headerLine,
      );
    if (!headerMatch) {
      i++;
      continue;
    }

    let commitHash = headerMatch[1];
    const originalLine = parseInt(headerMatch[2], 10);
    const isBoundary = commitHash.startsWith('^');
    if (isBoundary) {
      commitHash = commitHash.slice(1).padStart(40, '0');
    }

    const headers: Record<string, string> = {};
    i++;

    while (i < lines.length && !lines[i].startsWith('\t')) {
      const line = lines[i];
      const spaceIdx = line.indexOf(' ');
      if (spaceIdx > 0) {
        const key = line.slice(0, spaceIdx);
        const value = line.slice(spaceIdx + 1);
        headers[key] = value;
      }
      i++;
    }

    let lineContent = '';
    if (i < lines.length && lines[i].startsWith('\t')) {
      lineContent = lines[i].slice(1);
      i++;
    }

    const authorTime = headers['author-time'];
    const date = authorTime
      ? new Date(parseInt(authorTime, 10) * 1000).toISOString()
      : '';

    const authorEmail = headers['author-mail'] ?? '';
    const cleanEmail = authorEmail.replace(/^<|>$/g, '');

    const currentFilename = headers['filename'];
    const previousHeader = headers['previous'];
    let originalFile: string | undefined;
    if (previousHeader) {
      const prevParts = previousHeader.split(' ');
      if (prevParts.length >= 2) {
        const prevFilename = prevParts.slice(1).join(' ');
        if (currentFilename && prevFilename !== currentFilename) {
          originalFile = prevFilename;
        }
      }
    }

    results.push({
      commitHash,
      author: headers['author'] ?? '',
      authorEmail: cleanEmail,
      date,
      lineContent,
      originalFile,
      originalLine: originalFile ? originalLine : undefined,
    });
  }

  return results;
}
