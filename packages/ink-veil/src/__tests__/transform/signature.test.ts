import { describe, it, expect } from "vitest";
import {
  insertSignature,
  detectSignature,
  removeSignature,
} from "../../transform/signature.js";

describe("Signature", () => {
  it("inserts and detects signature", () => {
    const text = "Hello world";
    const signed = insertSignature(text);
    expect(detectSignature(signed)).toBe(true);
  });

  it("unsigned text fails detection", () => {
    expect(detectSignature("Hello world")).toBe(false);
  });

  it("removeSignature restores original text", () => {
    const text = "Hello world";
    const signed = insertSignature(text);
    const removed = removeSignature(signed);
    expect(removed).toBe(text);
  });

  it("handles empty string", () => {
    const signed = insertSignature("");
    expect(signed).toBe("");
  });

  it("signature does not alter visible content", () => {
    const text = "Hello world";
    const signed = insertSignature(text);
    // Strip zero-width chars and marker
    const visible = signed.replace(/[\u200C\u200D\u2060]/g, "");
    expect(visible).toBe(text);
  });
});
