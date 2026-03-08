import { describe, it, expect } from 'vitest';

import {
  InkVeil,
  Dictionary,
} from '../../index.js';

// Transform subpath imports (must not pull in heavy deps)
import {
  Dictionary as DictionaryFromTransform,
  veilTextFromDictionary as veilFromTransform,
  unveilText as unveilFromTransform,
  insertSignature as insertSigFromTransform,
  detectSignature as detectSigFromTransform,
} from '../../transform/index.js';

describe('Transform subpath imports', () => {
  it('Dictionary from transform subpath works', () => {
    expect(DictionaryFromTransform).toBeDefined();
    const dict = DictionaryFromTransform.create('tag');
    dict.addEntity('홍길동', 'PER', 'NER', 0.95);
    expect(dict.size).toBe(1);
  });

  it('veilTextFromDictionary from transform subpath works', () => {
    const dict = DictionaryFromTransform.create('plain');
    dict.addEntity('홍길동', 'PER', 'NER', 0.95);
    const result = veilFromTransform('홍길동이다', dict);
    expect(result.text).toBe('PER_001이다');
  });

  it('unveilText from transform subpath works', () => {
    const dict = DictionaryFromTransform.create('tag');
    dict.addEntity('홍길동', 'PER', 'NER', 0.95);
    const entry = dict.lookup('홍길동', 'PER')!;
    const result = unveilFromTransform(entry.token, dict);
    expect(result.text).toBe('홍길동');
  });

  it('signature functions from transform subpath work', () => {
    expect(typeof insertSigFromTransform).toBe('function');
    expect(typeof detectSigFromTransform).toBe('function');
    const signed = insertSigFromTransform('hello');
    expect(detectSigFromTransform(signed)).toBe(true);
  });
});

describe('InkVeil.create() factory', () => {
  it('creates instance with default options', async () => {
    const iv = await InkVeil.create();
    expect(iv).toBeInstanceOf(InkVeil);
    expect(iv.dictionary).toBeInstanceOf(Dictionary);
  });

  it('creates instance with custom tokenMode', async () => {
    const iv = await InkVeil.create({ tokenMode: 'plain' });
    expect(iv.dictionary.tokenMode).toBe('plain');
  });

  it('detect() returns spans', async () => {
    const iv = await InkVeil.create();
    const spans = await iv.detect('주민번호: 901231-1234567');
    expect(Array.isArray(spans)).toBe(true);
  });

  it('veilText() + unveilText() round-trip', async () => {
    const iv = await InkVeil.create({ tokenMode: 'tag' });
    iv.dictionary.addEntity('홍길동', 'PER', 'NER', 0.95);
    const veiled = iv.veilFromDictionary('홍길동이다');
    expect(veiled.text).not.toBe('홍길동이다');
    const restored = iv.unveilText(veiled.text);
    expect(restored.text).toBe('홍길동이다');
  });
});
