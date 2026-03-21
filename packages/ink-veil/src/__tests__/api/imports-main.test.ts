import { describe, it, expect } from "vitest";

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
} from "../../index.js";

describe("Main entry point imports", () => {
  it("InkVeil class is exported", () => {
    expect(InkVeil).toBeDefined();
    expect(typeof InkVeil.create).toBe("function");
  });

  it("Dictionary class is exported", () => {
    expect(Dictionary).toBeDefined();
    const dict = Dictionary.create();
    expect(dict).toBeInstanceOf(Dictionary);
  });

  it("VERSION is exported", () => {
    expect(typeof VERSION).toBe("string");
  });

  it("ErrorCode enum is exported", () => {
    expect(ErrorCode.SUCCESS).toBe(0);
    expect(ErrorCode.GENERAL_ERROR).toBe(1);
    expect(ErrorCode.FILE_NOT_FOUND).toBe(3);
  });

  it("Error classes are exported", () => {
    expect(InkVeilError).toBeDefined();
    expect(FileNotFoundError).toBeDefined();
    expect(UnsupportedFormatError).toBeDefined();
    expect(DictionaryError).toBeDefined();
    expect(NERModelError).toBeDefined();
    expect(VerificationError).toBeDefined();
  });

  it("Result helpers ok/err are exported", () => {
    const success = ok(42);
    expect(success.ok).toBe(true);
    const failure = err(new Error("fail"));
    expect(failure.ok).toBe(false);
  });

  it("DetectionPipeline is exported", () => {
    expect(DetectionPipeline).toBeDefined();
    const pipeline = new DetectionPipeline();
    expect(typeof pipeline.detect).toBe("function");
  });

  it("RegexEngine is exported", () => {
    expect(RegexEngine).toBeDefined();
  });

  it("Transform functions are exported", () => {
    expect(typeof veilTextFromSpans).toBe("function");
    expect(typeof veilTextFromDictionary).toBe("function");
    expect(typeof unveilText).toBe("function");
    expect(typeof insertSignature).toBe("function");
    expect(typeof detectSignature).toBe("function");
    expect(typeof removeSignature).toBe("function");
  });

  it("Verification functions are exported", () => {
    expect(typeof verify).toBe("function");
    expect(typeof sha256).toBe("function");
  });

  it("Document functions are exported", () => {
    expect(typeof getParser).toBe("function");
  });

  it("Dictionary I/O functions are exported", () => {
    expect(typeof saveDictionary).toBe("function");
    expect(typeof loadDictionary).toBe("function");
  });

  it("compositeKey and TokenGenerator are exported", () => {
    expect(typeof compositeKey).toBe("function");
    expect(compositeKey("홍길동", "PER")).toBe("홍길동::PER");
    expect(TokenGenerator).toBeDefined();
  });

  it("normalizeNFC and stripTrailingParticle are exported", () => {
    expect(typeof normalizeNFC).toBe("function");
    expect(typeof stripTrailingParticle).toBe("function");
  });

  it("mergeSpans is exported", () => {
    expect(typeof mergeSpans).toBe("function");
  });
});
