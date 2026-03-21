import { describe, it, expect } from "vitest";
import { PATTERNS, applyPattern } from "../../detection/regex/patterns.js";

function findPattern(category: string) {
  const p = PATTERNS.find((p) => p.category === category);
  if (!p) throw new Error(`Pattern not found: ${category}`);
  return p;
}

function matches(category: string, text: string): string[] {
  return applyPattern(text, findPattern(category)).map((s) => s.text);
}

describe("CARD (카드번호)", () => {
  it("4111-1111-1111-1111 — Visa: 양성", () => {
    expect(matches("CARD", "4111-1111-1111-1111")).toHaveLength(1);
  });

  it("5500-0000-0000-0004 — MasterCard: 양성", () => {
    expect(matches("CARD", "5500-0000-0000-0004")).toHaveLength(1);
  });

  it("1234-5678-9012-3456 — 비표준 번호: 음성", () => {
    expect(matches("CARD", "1234-5678-9012-3456")).toHaveLength(0);
  });

  it("1234 — 너무 짧음: 음성", () => {
    expect(matches("CARD", "1234")).toHaveLength(0);
  });
});
