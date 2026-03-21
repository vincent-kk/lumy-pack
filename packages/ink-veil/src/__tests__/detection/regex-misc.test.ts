import { describe, it, expect } from "vitest";
import { PATTERNS, applyPattern } from "../../detection/regex/patterns.js";

describe("DATE (날짜 패턴)", () => {
  const datePatterns = PATTERNS.filter((p) => p.category === "DATE");

  it("4개의 DATE 패턴이 존재", () => {
    expect(datePatterns).toHaveLength(4);
  });

  describe("DATE_KO (한국어)", () => {
    const pattern = datePatterns[0];

    it("2024년 3월 15일 — 양성", () => {
      expect(
        applyPattern("2024년 3월 15일", pattern).map((s) => s.text),
      ).toContain("2024년 3월 15일");
    });

    it("2024년 12월 1일 — 양성", () => {
      expect(
        applyPattern("2024년 12월 1일", pattern).map((s) => s.text),
      ).toContain("2024년 12월 1일");
    });

    it("2024년3월15일 (공백 없음) — 양성", () => {
      expect(
        applyPattern("2024년3월15일", pattern).map((s) => s.text),
      ).toContain("2024년3월15일");
    });
  });

  describe("DATE_ISO (YYYY-MM-DD)", () => {
    const pattern = datePatterns[1];

    it("2024-03-15 — 양성", () => {
      expect(applyPattern("2024-03-15", pattern).map((s) => s.text)).toContain(
        "2024-03-15",
      );
    });

    it("2024-12-31 — 양성", () => {
      expect(applyPattern("2024-12-31", pattern).map((s) => s.text)).toContain(
        "2024-12-31",
      );
    });

    it("2024-13-01 — 음성 (잘못된 월)", () => {
      expect(applyPattern("2024-13-01", pattern)).toHaveLength(0);
    });

    it("2024-00-15 — 음성 (잘못된 월)", () => {
      expect(applyPattern("2024-00-15", pattern)).toHaveLength(0);
    });

    it("ACCOUNT 패턴과 충돌 없음 (123-45-67890)", () => {
      expect(applyPattern("123-45-67890", pattern)).toHaveLength(0);
    });
  });

  describe("DATE_DOT (YYYY.MM.DD)", () => {
    const pattern = datePatterns[2];

    it("2024.03.15 — 양성", () => {
      expect(applyPattern("2024.03.15", pattern).map((s) => s.text)).toContain(
        "2024.03.15",
      );
    });

    it("2024.13.01 — 음성 (잘못된 월)", () => {
      expect(applyPattern("2024.13.01", pattern)).toHaveLength(0);
    });
  });

  describe("DATE_SLASH (MM/DD/YYYY)", () => {
    const pattern = datePatterns[3];

    it("03/15/2024 — 양성", () => {
      expect(applyPattern("03/15/2024", pattern).map((s) => s.text)).toContain(
        "03/15/2024",
      );
    });

    it("12/31/2024 — 양성", () => {
      expect(applyPattern("12/31/2024", pattern).map((s) => s.text)).toContain(
        "12/31/2024",
      );
    });

    it("13/15/2024 — 음성 (잘못된 월)", () => {
      expect(applyPattern("13/15/2024", pattern)).toHaveLength(0);
    });
  });
});
