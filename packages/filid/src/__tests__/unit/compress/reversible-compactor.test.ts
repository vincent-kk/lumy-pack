import { describe, expect, it } from 'vitest';

import {
  compactReversible,
  restoreFromCompacted,
} from '../../../compress/reversible-compactor.js';

describe('reversible-compactor', () => {
  it('should compact content to file path + metadata reference', () => {
    const result = compactReversible({
      filePath: '/app/auth/login.ts',
      content: 'export function login() {\n  // 50 lines of code\n}\n',
      metadata: { exports: ['login'], lineCount: 50 },
    });
    expect(result.compacted).toContain('/app/auth/login.ts');
    expect(result.compacted).toContain('login');
    expect(result.recoverable).toBe(true);
    expect(result.originalLines).toBe(3);
  });

  it('should produce significantly shorter output than input', () => {
    const longContent = Array.from(
      { length: 100 },
      (_, i) => `// line ${i}`,
    ).join('\n');
    const result = compactReversible({
      filePath: '/app/big-module.ts',
      content: longContent,
      metadata: { exports: ['main'], lineCount: 100 },
    });
    expect(result.compactedLines).toBeLessThan(result.originalLines);
  });

  it('should include compression meta with method "reversible"', () => {
    const result = compactReversible({
      filePath: '/app/x.ts',
      content: 'const x = 1;\n',
      metadata: { exports: ['x'], lineCount: 1 },
    });
    expect(result.meta.method).toBe('reversible');
    expect(result.meta.recoverable).toBe(true);
    expect(result.meta.originalLines).toBeGreaterThan(0);
    expect(result.meta.compressedLines).toBeGreaterThan(0);
  });

  it('should allow restoration from compacted output', () => {
    const original = {
      filePath: '/app/auth/login.ts',
      content: 'export function login() { return true; }\n',
      metadata: { exports: ['login'], lineCount: 1 },
    };
    const compacted = compactReversible(original);
    const restored = restoreFromCompacted(compacted.compacted);
    expect(restored.filePath).toBe('/app/auth/login.ts');
    expect(restored.exports).toContain('login');
  });

  it('should handle empty metadata gracefully', () => {
    const result = compactReversible({
      filePath: '/app/empty.ts',
      content: '',
      metadata: { exports: [], lineCount: 0 },
    });
    expect(result.recoverable).toBe(true);
    expect(result.compacted).toContain('/app/empty.ts');
  });
});
