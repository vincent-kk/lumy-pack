import { describe, it, expect } from "vitest";
import { Dictionary } from "../../dictionary/dictionary.js";
import { veilTextFromSpans } from "../../transform/veil-from-spans.js";
import { veilTextFromDictionary } from "../../transform/veil-from-dictionary.js";
import { unveilText } from "../../transform/unveil.js";

describe("Round-trip: veilFromSpans -> unveil", () => {
  it("exact round-trip with tag mode", () => {
    const dict = Dictionary.create("tag");
    const text = "홍길동은 삼성전자에 다닌다";
    const veiled = veilTextFromSpans(
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
    const restored = unveilText(veiled.text, dict);
    expect(restored.text).toBe(text);
    expect(restored.tokenIntegrity).toBe(1.0);
  });

  it("exact round-trip with plain mode", () => {
    const dict = Dictionary.create("plain");
    const text = "서울에서 김철수를 만났다";
    const veiled = veilTextFromSpans(
      text,
      [
        {
          start: 0,
          end: 2,
          text: "서울",
          category: "LOC",
          method: "REGEX",
          confidence: 1.0,
        },
        {
          start: 5,
          end: 8,
          text: "김철수",
          category: "PER",
          method: "NER",
          confidence: 0.9,
        },
      ],
      dict,
    );
    const restored = unveilText(veiled.text, dict);
    expect(restored.text).toBe(text);
  });
});

describe("Round-trip: veilFromDictionary -> unveil", () => {
  it("exact round-trip with tag mode", () => {
    const dict = Dictionary.create("tag");
    dict.addEntity("홍길동", "PER", "NER", 0.95);
    dict.addEntity("삼성전자", "ORG", "REGEX", 1.0);
    const text = "홍길동은 삼성전자에 다닌다";
    const veiled = veilTextFromDictionary(text, dict);
    const restored = unveilText(veiled.text, dict);
    expect(restored.text).toBe(text);
    expect(restored.tokenIntegrity).toBe(1.0);
  });

  it("longest-match-first round-trip: 삼성전자 vs 삼성", () => {
    const dict = Dictionary.create("tag");
    dict.addEntity("삼성전자", "ORG", "REGEX", 1.0);
    dict.addEntity("삼성", "ORG", "REGEX", 1.0);
    const text = "삼성전자에서 일한다";
    const veiled = veilTextFromDictionary(text, dict);
    const restored = unveilText(veiled.text, dict);
    expect(restored.text).toBe(text);
  });
});
