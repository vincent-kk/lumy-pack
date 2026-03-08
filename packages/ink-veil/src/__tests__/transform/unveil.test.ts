import { describe, it, expect } from 'vitest';
import { Dictionary } from '../../dictionary/dictionary.js';
import { unveilText } from '../../transform/unveil.js';

function makeDictWithEntry(original: string, category: string) {
  const dict = Dictionary.create('tag');
  dict.addEntity(original, category, 'NER', 0.95);
  return dict;
}

describe('unveilText - Stage 1 (strict XML)', () => {
  it('restores exact XML tag token', () => {
    const dict = makeDictWithEntry('홍길동', 'PER');
    const entry = dict.lookup('홍길동', 'PER')!;
    const result = unveilText(entry.token, dict);
    expect(result.text).toBe('홍길동');
    expect(result.matchedTokens).toContain('PER_001');
    expect(result.tokenIntegrity).toBe(1.0);
  });
});

describe('unveilText - Stage 2 (loose XML)', () => {
  it('restores single-quoted XML token', () => {
    const dict = makeDictWithEntry('홍길동', 'PER');
    const looseToken = `<iv-per id='001'>PER_001</iv-per>`;
    const result = unveilText(looseToken, dict);
    expect(result.text).toBe('홍길동');
    expect(result.modifiedTokens).toContain('PER_001');
  });

  it('restores XML with extra whitespace', () => {
    const dict = makeDictWithEntry('홍길동', 'PER');
    const looseToken = `<iv-per id="001"> PER_001 </iv-per>`;
    const result = unveilText(looseToken, dict);
    expect(result.text).toBe('홍길동');
    expect(result.modifiedTokens).toContain('PER_001');
  });
});

describe('unveilText - Stage 3 (plain token)', () => {
  it('restores bare plain token', () => {
    const dict = makeDictWithEntry('홍길동', 'PER');
    const result = unveilText('PER_001', dict);
    expect(result.text).toBe('홍길동');
    expect(result.modifiedTokens).toContain('PER_001');
  });

  it('restores bracket format {{PER_001}}', () => {
    const dict = makeDictWithEntry('홍길동', 'PER');
    const result = unveilText('{{PER_001}}', dict);
    expect(result.text).toBe('홍길동');
    expect(result.modifiedTokens).toContain('PER_001');
  });

  it('dynamic category: custom category token matched', () => {
    const dict = Dictionary.create('plain');
    dict.addEntity('Project-Alpha', 'PROJECT', 'MANUAL', 1.0);
    const result = unveilText('PROJECT_001', dict);
    expect(result.text).toBe('Project-Alpha');
  });
});

describe('unveilText - unmatched tokens', () => {
  it('hallucinated token goes to unmatchedTokens', () => {
    const dict = makeDictWithEntry('홍길동', 'PER');
    const result = unveilText('PER_099', dict);
    expect(result.unmatchedTokens).toContain('PER_099');
    expect(result.tokenIntegrity).toBe(0);
  });
});

describe('unveilText - tokenIntegrity', () => {
  it('1.0 when all tokens matched via stage 1', () => {
    const dict = makeDictWithEntry('홍길동', 'PER');
    const entry = dict.lookup('홍길동', 'PER')!;
    const result = unveilText(entry.token, dict);
    expect(result.tokenIntegrity).toBe(1.0);
  });

  it('1.0 when no tokens in text', () => {
    const dict = makeDictWithEntry('홍길동', 'PER');
    const result = unveilText('no tokens here', dict);
    expect(result.tokenIntegrity).toBe(1.0);
  });
});
