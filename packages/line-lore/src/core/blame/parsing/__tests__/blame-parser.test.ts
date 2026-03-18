import { describe, expect, it } from 'vitest';

import { parsePorcelainOutput } from '../blame-parser.js';

const BASIC_PORCELAIN = `abc1234567890123456789012345678901234567 10 10 1
author John Doe
author-mail <john@example.com>
author-time 1700000000
author-tz +0000
committer John Doe
committer-mail <john@example.com>
committer-time 1700000000
committer-tz +0000
summary Initial commit
filename src/index.ts
\tconst x = 42;`;

const RENAME_PORCELAIN = `def4567890123456789012345678901234567890 5 10 1
author Jane Doe
author-mail <jane@example.com>
author-time 1700100000
author-tz +0000
committer Jane Doe
committer-mail <jane@example.com>
committer-time 1700100000
committer-tz +0000
summary Rename file
previous abc1234567890123456789012345678901234567 src/old-name.ts
filename src/new-name.ts
\texport function hello() {}`;

const BOUNDARY_PORCELAIN = `^bc1234567890123456789012345678901234567 1 1 1
author Root
author-mail <root@example.com>
author-time 1600000000
author-tz +0000
committer Root
committer-mail <root@example.com>
committer-time 1600000000
committer-tz +0000
summary Root commit
boundary
filename README.md
\t# Hello`;

describe('parsePorcelainOutput', () => {
  it('parses basic porcelain output', () => {
    const results = parsePorcelainOutput(BASIC_PORCELAIN);
    expect(results).toHaveLength(1);
    expect(results[0].commitHash).toBe(
      'abc1234567890123456789012345678901234567',
    );
    expect(results[0].author).toBe('John Doe');
    expect(results[0].authorEmail).toBe('john@example.com');
    expect(results[0].lineContent).toBe('const x = 42;');
  });

  it('converts author-time to ISO 8601 date', () => {
    const results = parsePorcelainOutput(BASIC_PORCELAIN);
    expect(results[0].date).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('detects file renames via previous header', () => {
    const results = parsePorcelainOutput(RENAME_PORCELAIN);
    expect(results).toHaveLength(1);
    expect(results[0].originalFile).toBe('src/old-name.ts');
  });

  it('handles boundary commits (^ prefix)', () => {
    const results = parsePorcelainOutput(BOUNDARY_PORCELAIN);
    expect(results).toHaveLength(1);
    expect(results[0].commitHash).toHaveLength(40);
    expect(results[0].lineContent).toBe('# Hello');
  });

  it('parses multiple blame entries', () => {
    const multi = `${BASIC_PORCELAIN}\n${RENAME_PORCELAIN}`;
    const results = parsePorcelainOutput(multi);
    expect(results).toHaveLength(2);
  });

  it('returns empty array for empty input', () => {
    expect(parsePorcelainOutput('')).toEqual([]);
  });
});
