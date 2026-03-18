import { describe, expect, it } from 'vitest';

import type { ContentHash } from '@/types/index.js';

import {
  compareSymbolMaps,
  findMatchAcrossFiles,
} from '../structure-comparator.js';

function hash(exact: string, structural?: string): ContentHash {
  return { exact, structural: structural ?? exact };
}

describe('compareSymbolMaps', () => {
  it('detects identical symbols', () => {
    const current = new Map([['foo', hash('aaa')]]);
    const parent = new Map([['foo', hash('aaa')]]);

    const results = compareSymbolMaps(current, parent);
    expect(results[0].change).toBe('identical');
    expect(results[0].confidence).toBe('exact');
  });

  it('detects function rename (different name, same exact hash)', () => {
    const current = new Map([['calculateTotal', hash('aaa')]]);
    const parent = new Map([['calcTotal', hash('aaa')]]);

    const results = compareSymbolMaps(current, parent);
    expect(results[0].change).toBe('rename');
    expect(results[0].fromName).toBe('calcTotal');
    expect(results[0].toName).toBe('calculateTotal');
    expect(results[0].confidence).toBe('exact');
  });

  it('detects structural match (same name, same structural hash)', () => {
    const current = new Map([['foo', hash('bbb', 'shared')]]);
    const parent = new Map([['foo', hash('ccc', 'shared')]]);

    const results = compareSymbolMaps(current, parent);
    expect(results[0].change).toBe('modified');
    expect(results[0].confidence).toBe('structural');
  });

  it('reports new when no match found', () => {
    const current = new Map([['newFunc', hash('xxx')]]);
    const parent = new Map([['other', hash('yyy')]]);

    const results = compareSymbolMaps(current, parent);
    expect(results[0].change).toBe('new');
  });

  it('reports modified with heuristic for completely different hashes', () => {
    const current = new Map([['foo', hash('aaa', 'aaa')]]);
    const parent = new Map([['foo', hash('bbb', 'bbb')]]);

    const results = compareSymbolMaps(current, parent);
    expect(results[0].change).toBe('modified');
    expect(results[0].confidence).toBe('heuristic');
  });
});

describe('findMatchAcrossFiles', () => {
  it('finds matching symbol in another file', () => {
    const target = hash('aaa');
    const fileMaps = new Map([
      ['src/utils.ts', new Map([['helper', hash('aaa')]])],
    ]);

    const result = findMatchAcrossFiles(target, fileMaps);
    expect(result).not.toBeNull();
    expect(result!.change).toBe('move');
    expect(result!.fromFile).toBe('src/utils.ts');
    expect(result!.confidence).toBe('exact');
  });

  it('returns null when no match found', () => {
    const target = hash('xxx');
    const fileMaps = new Map([
      ['src/utils.ts', new Map([['helper', hash('yyy')]])],
    ]);

    const result = findMatchAcrossFiles(target, fileMaps);
    expect(result).toBeNull();
  });

  it('finds structural match across files', () => {
    const target = hash('xxx', 'shared');
    const fileMaps = new Map([
      ['src/utils.ts', new Map([['helper', hash('yyy', 'shared')]])],
    ]);

    const result = findMatchAcrossFiles(target, fileMaps);
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe('structural');
  });
});
