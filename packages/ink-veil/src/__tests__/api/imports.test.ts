import { describe, it, expect } from 'vitest';

// Main entry point imports
import {
  InkVeil,
  Dictionary,
  VERSION,
  ErrorCode,
  InkVeilError,
  FileNotFoundError,
  UnsupportedFormatError,
  DictionaryError,
  NERModelError,
  VerificationError,
  ok,
  err,
  DetectionPipeline,
  RegexEngine,
  normalizeNFC,
  stripTrailingParticle,
  mergeSpans,
  veilTextFromSpans,
  veilTextFromDictionary,
  unveilText,
  insertSignature,
  detectSignature,
  removeSignature,
  verify,
  sha256,
  getParser,
  saveDictionary,
  loadDictionary,
  compositeKey,
  TokenGenerator,
} from '../../index.js';

// Transform subpath imports (must not pull in onnxruntime)
import {
  Dictionary as DictionaryFromTransform,
  veilTextFromDictionary as veilFromTransform,
  unveilText as unveilFromTransform,
  insertSignature as insertSigFromTransform,
  detectSignature as detectSigFromTransform,
} from '../../transform/index.js';

describe('Main entry point imports', () => {
  it('InkVeil class is exported', () => {
    expect(InkVeil).toBeDefined();
    expect(typeof InkVeil.create).toBe('function');
  });

  it('Dictionary class is exported', () => {
    expect(Dictionary).toBeDefined();
    const dict = Dictionary.create();
    expect(dict).toBeInstanceOf(Dictionary);
  });

  it('VERSION is exported', () => {
    expect(typeof VERSION).toBe('string');
  });

  it('ErrorCode enum is exported', () => {
    expect(ErrorCode.SUCCESS).toBe(0);
    expect(ErrorCode.GENERAL_ERROR).toBe(1);
    expect(ErrorCode.FILE_NOT_FOUND).toBe(3);
  });

  it('Error classes are exported', () => {
    expect(InkVeilError).toBeDefined();
    expect(FileNotFoundError).toBeDefined();
    expect(UnsupportedFormatError).toBeDefined();
    expect(DictionaryError).toBeDefined();
    expect(NERModelError).toBeDefined();
    expect(VerificationError).toBeDefined();
  });

  it('Result helpers ok/err are exported', () => {
    const success = ok(42);
    expect(success.ok).toBe(true);
    const failure = err(new Error('fail'));
    expect(failure.ok).toBe(false);
  });

  it('DetectionPipeline is exported', () => {
    expect(DetectionPipeline).toBeDefined();
    const pipeline = new DetectionPipeline();
    expect(typeof pipeline.detect).toBe('function');
  });

  it('RegexEngine is exported', () => {
    expect(RegexEngine).toBeDefined();
  });

  it('Transform functions are exported', () => {
    expect(typeof veilTextFromSpans).toBe('function');
    expect(typeof veilTextFromDictionary).toBe('function');
    expect(typeof unveilText).toBe('function');
    expect(typeof insertSignature).toBe('function');
    expect(typeof detectSignature).toBe('function');
    expect(typeof removeSignature).toBe('function');
  });

  it('Verification functions are exported', () => {
    expect(typeof verify).toBe('function');
    expect(typeof sha256).toBe('function');
  });

  it('Document functions are exported', () => {
    expect(typeof getParser).toBe('function');
  });

  it('Dictionary I/O functions are exported', () => {
    expect(typeof saveDictionary).toBe('function');
    expect(typeof loadDictionary).toBe('function');
  });

  it('compositeKey and TokenGenerator are exported', () => {
    expect(typeof compositeKey).toBe('function');
    expect(compositeKey('홍길동', 'PER')).toBe('홍길동::PER');
    expect(TokenGenerator).toBeDefined();
  });

  it('normalizeNFC and stripTrailingParticle are exported', () => {
    expect(typeof normalizeNFC).toBe('function');
    expect(typeof stripTrailingParticle).toBe('function');
  });

  it('mergeSpans is exported', () => {
    expect(typeof mergeSpans).toBe('function');
  });
});

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
    // RRN 패턴 감지
    const spans = await iv.detect('주민번호: 901231-1234567');
    expect(Array.isArray(spans)).toBe(true);
  });

  it('veilText() + unveilText() round-trip', async () => {
    const iv = await InkVeil.create({ tokenMode: 'tag' });
    // Dictionary에 엔티티 추가 후 veilFromDictionary로 테스트
    iv.dictionary.addEntity('홍길동', 'PER', 'NER', 0.95);
    const veiled = iv.veilFromDictionary('홍길동이다');
    expect(veiled.text).not.toBe('홍길동이다');
    const restored = iv.unveilText(veiled.text);
    expect(restored.text).toBe('홍길동이다');
  });
});
