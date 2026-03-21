import { describe, it, expect } from "vitest";
import { PATTERNS } from "../../detection/regex/patterns.js";
import { RegexEngine } from "../../detection/regex/engine.js";

describe("RegexEngine integration", () => {
  const engine = new RegexEngine();

  it("텍스트에서 여러 PII 검출", () => {
    const text =
      "홍길동의 주민번호는 901231-1234567이고 이메일은 user@example.com입니다.";
    const spans = engine.detect(text);
    const categories = spans.map((s) => s.category);
    expect(categories).toContain("RRN");
    expect(categories).toContain("EMAIL");
  });

  it("카테고리 필터링 동작", () => {
    const text = "010-1234-5678, user@example.com, 901231-1234567";
    const spans = engine.detect(text, {
      categories: ["PHONE"],
      priorityOrder: ["REGEX"],
    });
    expect(spans.every((s) => s.category === "PHONE")).toBe(true);
  });

  it("매칭 없으면 빈 배열 반환", () => {
    const text = "일반적인 텍스트 내용입니다.";
    const spans = engine.detect(text, {
      categories: ["RRN"],
      priorityOrder: ["REGEX"],
    });
    expect(spans).toHaveLength(0);
  });

  it("모든 DetectionSpan 필드 포함", () => {
    const text = "010-1234-5678";
    const spans = engine.detect(text, {
      categories: ["PHONE"],
      priorityOrder: ["REGEX"],
    });
    expect(spans).toHaveLength(1);
    const span = spans[0];
    expect(span).toHaveProperty("start");
    expect(span).toHaveProperty("end");
    expect(span).toHaveProperty("text");
    expect(span).toHaveProperty("category");
    expect(span).toHaveProperty("method", "REGEX");
    expect(span).toHaveProperty("confidence");
  });
});

describe("패턴 메타데이터", () => {
  it("15개 이상의 패턴 정의됨", () => {
    expect(PATTERNS.length).toBeGreaterThanOrEqual(15);
  });

  it("모든 패턴에 category, confidence, priority 포함", () => {
    for (const p of PATTERNS) {
      expect(p.category).toBeTruthy();
      expect(p.confidence).toBeGreaterThan(0);
      expect(p.priority).toBeGreaterThan(0);
    }
  });
});
