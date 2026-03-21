import { describe, it, expect } from "vitest";
import { Dictionary } from "../../dictionary/dictionary.js";
import { veilTextFromSpans } from "../../transform/veil-from-spans.js";

describe("veilTextFromSpans", () => {
  it("replaces a single span with its token", () => {
    const dict = Dictionary.create("plain");
    const result = veilTextFromSpans(
      "홍길동이 왔다",
      [
        {
          start: 0,
          end: 3,
          text: "홍길동",
          category: "PER",
          method: "NER",
          confidence: 0.95,
        },
      ],
      dict,
    );
    expect(result.text).toBe("PER_001이 왔다");
    expect(result.substitutions).toBe(1);
  });

  it("replaces multiple non-overlapping spans", () => {
    const dict = Dictionary.create("plain");
    const text = "홍길동은 삼성전자에 다닌다";
    const result = veilTextFromSpans(
      text,
      [
        {
          start: 0,
          end: 3,
          text: "홍길동",
          category: "PER",
          method: "NER",
          confidence: 0.95,
        },
        {
          start: 5,
          end: 9,
          text: "삼성전자",
          category: "ORG",
          method: "REGEX",
          confidence: 1.0,
        },
      ],
      dict,
    );
    expect(result.text).toContain("PER_001");
    expect(result.text).toContain("ORG_001");
    expect(result.substitutions).toBe(2);
  });

  it("returns original text when no spans", () => {
    const dict = Dictionary.create();
    const result = veilTextFromSpans("no entities", [], dict);
    expect(result.text).toBe("no entities");
    expect(result.substitutions).toBe(0);
  });

  it("correct offset substitution for multi-byte Korean characters", () => {
    const dict = Dictionary.create("plain");
    const text = "A 홍길동 B";
    const result = veilTextFromSpans(
      text,
      [
        {
          start: 2,
          end: 5,
          text: "홍길동",
          category: "PER",
          method: "MANUAL",
          confidence: 1.0,
        },
      ],
      dict,
    );
    expect(result.text).toBe("A PER_001 B");
  });

  it("adds entity to dictionary", () => {
    const dict = Dictionary.create("plain");
    veilTextFromSpans(
      "홍길동",
      [
        {
          start: 0,
          end: 3,
          text: "홍길동",
          category: "PER",
          method: "NER",
          confidence: 0.9,
        },
      ],
      dict,
    );
    expect(dict.lookup("홍길동", "PER")).toBeDefined();
  });
});
