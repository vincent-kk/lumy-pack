import { describe, expect, it } from 'vitest';

import { formatMatch } from '../../../ast/ast-grep-shared.js';

// ─── formatMatch ────────────────────────────────────────────────────────────

describe('formatMatch', () => {
  const fileContent = [
    'line 1',
    'line 2',
    'const foo = 1;',
    'line 4',
    'line 5',
    'line 6',
    'line 7',
  ].join('\n');

  it('includes the file path and start line in the header', () => {
    const result = formatMatch(
      '/path/to/file.ts',
      'const foo = 1;',
      3,
      3,
      0,
      fileContent,
    );
    expect(result).toContain('/path/to/file.ts:3');
  });

  it('marks matched lines with ">" prefix', () => {
    const result = formatMatch(
      '/path/to/file.ts',
      'const foo = 1;',
      3,
      3,
      0,
      fileContent,
    );
    expect(result).toMatch(/^>\s+3:/m);
  });

  it('marks non-matched context lines with " " prefix', () => {
    const result = formatMatch(
      '/path/to/file.ts',
      'const foo = 1;',
      3,
      3,
      1,
      fileContent,
    );
    // Line 2 (before match) should not have ">"
    expect(result).toMatch(/^ \s+2:/m);
    // Line 4 (after match) should not have ">"
    expect(result).toMatch(/^ \s+4:/m);
  });

  it('shows context lines before and after the match', () => {
    const result = formatMatch(
      '/path/to/file.ts',
      'const foo = 1;',
      3,
      3,
      2,
      fileContent,
    );
    // context=2 → lines 1..5 should be present
    expect(result).toContain('line 1');
    expect(result).toContain('line 5');
  });

  it('does not exceed file boundaries when context is large', () => {
    const result = formatMatch(
      '/path/to/file.ts',
      'line 1',
      1,
      1,
      10,
      fileContent,
    );
    // Should not throw; just show what is available
    expect(result).toContain('line 1');
  });

  it('includes match content on the matched line', () => {
    const result = formatMatch(
      '/path/to/file.ts',
      'const foo = 1;',
      3,
      3,
      0,
      fileContent,
    );
    expect(result).toContain('const foo = 1;');
  });

  it('formats multi-line matches with all match lines marked ">"', () => {
    const multiContent = 'a\nb\nc\nd\ne';
    // Lines 2-3 are the match (1-indexed)
    const result = formatMatch('/file.ts', 'b\nc', 2, 3, 0, multiContent);
    expect(result).toMatch(/^>\s+2:/m);
    expect(result).toMatch(/^>\s+3:/m);
    expect(result).not.toMatch(/^>\s+1:/m);
    expect(result).not.toMatch(/^>\s+4:/m);
  });

  it('pads line numbers to 4 characters', () => {
    const result = formatMatch('/f.ts', 'line 1', 1, 1, 0, fileContent);
    // Line number 1 should be right-padded to 4 chars: "   1"
    expect(result).toMatch(/\s{3}1:/);
  });
});
