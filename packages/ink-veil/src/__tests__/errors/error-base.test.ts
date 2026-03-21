import { describe, it, expect } from "vitest";
import { ErrorCode, InkVeilError } from "../../errors/types.js";

describe("InkVeilError base class", () => {
  it("is instance of Error", () => {
    const e = new InkVeilError(ErrorCode.GENERAL_ERROR, "test");
    expect(e).toBeInstanceOf(Error);
  });

  it("is instance of InkVeilError", () => {
    const e = new InkVeilError(ErrorCode.GENERAL_ERROR, "test");
    expect(e).toBeInstanceOf(InkVeilError);
  });

  it("carries correct code", () => {
    const e = new InkVeilError(ErrorCode.GENERAL_ERROR, "test");
    expect(e.code).toBe(ErrorCode.GENERAL_ERROR);
  });

  it("carries message", () => {
    const e = new InkVeilError(ErrorCode.GENERAL_ERROR, "my message");
    expect(e.message).toBe("my message");
  });

  it("context passes through correctly", () => {
    const ctx = { key: "value", num: 42 };
    const e = new InkVeilError(ErrorCode.GENERAL_ERROR, "test", ctx);
    expect(e.context).toEqual(ctx);
  });

  it("context is undefined when not provided", () => {
    const e = new InkVeilError(ErrorCode.GENERAL_ERROR, "test");
    expect(e.context).toBeUndefined();
  });
});
