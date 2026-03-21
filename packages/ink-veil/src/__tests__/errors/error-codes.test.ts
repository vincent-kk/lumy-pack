import { describe, it, expect } from "vitest";
import { ErrorCode } from "../../errors/types.js";

describe("ErrorCode enum", () => {
  it("SUCCESS === 0", () => expect(ErrorCode.SUCCESS).toBe(0));
  it("GENERAL_ERROR === 1", () => expect(ErrorCode.GENERAL_ERROR).toBe(1));
  it("INVALID_ARGUMENTS === 2", () =>
    expect(ErrorCode.INVALID_ARGUMENTS).toBe(2));
  it("FILE_NOT_FOUND === 3", () => expect(ErrorCode.FILE_NOT_FOUND).toBe(3));
  it("UNSUPPORTED_FORMAT === 4", () =>
    expect(ErrorCode.UNSUPPORTED_FORMAT).toBe(4));
  it("DICTIONARY_ERROR === 5", () =>
    expect(ErrorCode.DICTIONARY_ERROR).toBe(5));
  it("NER_MODEL_FAILED === 6", () =>
    expect(ErrorCode.NER_MODEL_FAILED).toBe(6));
  it("VERIFICATION_FAILED === 7", () =>
    expect(ErrorCode.VERIFICATION_FAILED).toBe(7));
  it("TOKEN_INTEGRITY_BELOW_THRESHOLD === 8", () =>
    expect(ErrorCode.TOKEN_INTEGRITY_BELOW_THRESHOLD).toBe(8));
});
