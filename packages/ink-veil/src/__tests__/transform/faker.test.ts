import { describe, it, expect, vi } from 'vitest';
import { faker } from '@faker-js/faker';
import { Dictionary } from '../../dictionary/dictionary.js';
import {
  generateFakerToken,
  veilTextFaker,
  unveilTextFaker,
  addFakerEntity,
} from '../../transform/faker.js';

describe('generateFakerToken()', () => {
  it('generates a non-empty string for PER category', () => {
    const dict = Dictionary.create('faker');
    const token = generateFakerToken('PER', dict);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
  });

  it('generates different values for different calls (probabilistic)', () => {
    const dict = Dictionary.create('faker');
    const tokens = new Set<string>();
    for (let i = 0; i < 10; i++) {
      tokens.add(generateFakerToken('PER', dict));
    }
    // At least 2 distinct values out of 10 (practically always true)
    expect(tokens.size).toBeGreaterThan(1);
  });

  it('avoids collision with existing faker tokens in dictionary', () => {
    const dict = Dictionary.create('faker');
    // Manually pre-populate with a known fake value
    const entry = dict.addEntity('홍길동', 'PER', 'MANUAL', 1.0);
    (entry as { token: string }).token = '김철수';

    // Now mock faker to always return '김철수' first, then '이영희'
    const spy = vi.spyOn(faker.person, 'fullName')
      .mockReturnValueOnce('김철수')   // collision on first attempt
      .mockReturnValue('이영희');       // non-colliding on second attempt

    const token = generateFakerToken('PER', dict);
    expect(token).toBe('이영희');
    spy.mockRestore();
  });

  it('handles unknown categories with fallback generator', () => {
    const dict = Dictionary.create('faker');
    const token = generateFakerToken('UNKNOWN_CATEGORY', dict);
    expect(token.length).toBeGreaterThan(0);
  });
});

describe('addFakerEntity()', () => {
  it('adds entity with fake token (홍길동 → realistic name)', () => {
    const dict = Dictionary.create('faker');
    const entry = addFakerEntity('홍길동', 'PER', 'MANUAL', 1.0, dict);

    expect(entry.original).toBe('홍길동');
    expect(entry.category).toBe('PER');
    // faker token is a realistic name, not the plain token ID
    expect(entry.token).not.toBe(entry.tokenPlain);
    expect(entry.token.length).toBeGreaterThan(0);
  });

  it('is idempotent — same entity returns same entry', () => {
    const dict = Dictionary.create('faker');
    const entry1 = addFakerEntity('홍길동', 'PER', 'MANUAL', 1.0, dict);
    const entry2 = addFakerEntity('홍길동', 'PER', 'MANUAL', 1.0, dict);

    expect(entry1).toBe(entry2);
    expect(dict.size).toBe(1);
  });

  it('no collision between multiple entities', () => {
    const dict = Dictionary.create('faker');
    addFakerEntity('홍길동', 'PER', 'MANUAL', 1.0, dict);
    addFakerEntity('김영수', 'PER', 'MANUAL', 1.0, dict);
    addFakerEntity('박지영', 'PER', 'MANUAL', 1.0, dict);

    const tokens = Array.from(dict.entries()).map((e) => e.token);
    const uniqueTokens = new Set(tokens);
    expect(uniqueTokens.size).toBe(tokens.length);
  });
});

describe('veilTextFaker()', () => {
  it('replaces entity with faker token in text', () => {
    const dict = Dictionary.create('faker');
    const entry = dict.addEntity('홍길동', 'PER', 'MANUAL', 1.0);
    (entry as { token: string }).token = '김철수';

    const result = veilTextFaker('홍길동은 삼성전자에 다닌다', dict);
    expect(result).toContain('김철수');
    expect(result).not.toContain('홍길동');
  });

  it('replaces multiple occurrences', () => {
    const dict = Dictionary.create('faker');
    const entry = dict.addEntity('홍길동', 'PER', 'MANUAL', 1.0);
    (entry as { token: string }).token = '김철수';

    const result = veilTextFaker('홍길동과 홍길동이 만났다', dict);
    expect(result.split('김철수').length - 1).toBe(2);
    expect(result).not.toContain('홍길동');
  });

  it('uses longest-match-first to prevent partial replacement', () => {
    const dict = Dictionary.create('faker');
    const e1 = dict.addEntity('삼성전자', 'ORG', 'MANUAL', 1.0);
    (e1 as { token: string }).token = 'A사';
    const e2 = dict.addEntity('삼성', 'ORG', 'MANUAL', 1.0);
    (e2 as { token: string }).token = 'B사';

    const result = veilTextFaker('삼성전자 발표', dict);
    // '삼성전자' should match first, not '삼성'
    expect(result).toContain('A사');
    expect(result).not.toContain('B사전자');
  });
});

describe('unveilTextFaker()', () => {
  it('restores original text from faker token', () => {
    const dict = Dictionary.create('faker');
    const entry = dict.addEntity('홍길동', 'PER', 'MANUAL', 1.0);
    (entry as { token: string }).token = '김철수';

    const veiled = '김철수은 삼성전자에 다닌다';
    const restored = unveilTextFaker(veiled, dict);
    expect(restored).toContain('홍길동');
    expect(restored).not.toContain('김철수');
  });

  it('round-trip: veil → unveil returns original text', () => {
    const dict = Dictionary.create('faker');
    addFakerEntity('홍길동', 'PER', 'MANUAL', 1.0, dict);

    const original = '홍길동은 회의에 참석했다';
    const veiled = veilTextFaker(original, dict);
    const restored = unveilTextFaker(veiled, dict);

    expect(restored).toBe(original);
  });

  it('reverse lookup: dictionary.lookup finds original from plain token', () => {
    const dict = Dictionary.create('faker');
    const entry = addFakerEntity('홍길동', 'PER', 'MANUAL', 1.0, dict);

    // tokenPlain is the ID (e.g. "PER_001"), used for reverse lookup
    const found = dict.reverseLookup(entry.tokenPlain);
    expect(found).toBeDefined();
    expect(found!.original).toBe('홍길동');
  });
});
