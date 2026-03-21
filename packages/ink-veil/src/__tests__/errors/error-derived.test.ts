import { describe, it, expect } from "vitest";
import {
  ErrorCode,
  InkVeilError,
  FileNotFoundError,
  UnsupportedFormatError,
  DictionaryError,
  NERModelError,
  VerificationError,
} from "../../errors/types.js";

describe("FileNotFoundError", () => {
  it("has correct code", () => {
    const e = new FileNotFoundError("/path/to/file.txt");
    expect(e.code).toBe(ErrorCode.FILE_NOT_FOUND);
  });

  it("is instance of InkVeilError", () => {
    const e = new FileNotFoundError("/path/to/file.txt");
    expect(e).toBeInstanceOf(InkVeilError);
  });

  it("includes path in message", () => {
    const e = new FileNotFoundError("/path/to/file.txt");
    expect(e.message).toContain("/path/to/file.txt");
  });

  it("context.path matches provided path", () => {
    const e = new FileNotFoundError("/path/to/file.txt");
    expect(e.context?.path).toBe("/path/to/file.txt");
  });

  it("name is FileNotFoundError", () => {
    const e = new FileNotFoundError("/path/to/file.txt");
    expect(e.name).toBe("FileNotFoundError");
  });
});

describe("UnsupportedFormatError", () => {
  it("has correct code", () => {
    const e = new UnsupportedFormatError(".xyz");
    expect(e.code).toBe(ErrorCode.UNSUPPORTED_FORMAT);
  });

  it("is instance of InkVeilError", () => {
    const e = new UnsupportedFormatError(".xyz");
    expect(e).toBeInstanceOf(InkVeilError);
  });

  it("context.format matches provided format", () => {
    const e = new UnsupportedFormatError(".xyz");
    expect(e.context?.format).toBe(".xyz");
  });
});

describe("DictionaryError", () => {
  it("has correct code", () => {
    const e = new DictionaryError("corrupt dictionary");
    expect(e.code).toBe(ErrorCode.DICTIONARY_ERROR);
  });

  it("is instance of InkVeilError", () => {
    const e = new DictionaryError("corrupt dictionary");
    expect(e).toBeInstanceOf(InkVeilError);
  });

  it("context passes through", () => {
    const ctx = { file: "dict.json", version: "1.0" };
    const e = new DictionaryError("version mismatch", ctx);
    expect(e.context).toEqual(ctx);
  });
});

describe("NERModelError", () => {
  it("has correct code", () => {
    const e = new NERModelError("model load failed");
    expect(e.code).toBe(ErrorCode.NER_MODEL_FAILED);
  });

  it("is instance of InkVeilError", () => {
    const e = new NERModelError("model load failed");
    expect(e).toBeInstanceOf(InkVeilError);
  });

  it("context passes through", () => {
    const ctx = { model: "kiwi-base", checksum: "mismatch" };
    const e = new NERModelError("checksum failed", ctx);
    expect(e.context).toEqual(ctx);
  });
});

describe("VerificationError", () => {
  it("has correct code", () => {
    const e = new VerificationError("sha256 mismatch");
    expect(e.code).toBe(ErrorCode.VERIFICATION_FAILED);
  });

  it("is instance of InkVeilError", () => {
    const e = new VerificationError("sha256 mismatch");
    expect(e).toBeInstanceOf(InkVeilError);
  });

  it("context passes through", () => {
    const ctx = { expected: "abc", actual: "def" };
    const e = new VerificationError("hash mismatch", ctx);
    expect(e.context).toEqual(ctx);
  });
});
