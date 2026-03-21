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

describe("IP (IPv4 주소)", () => {
  it("192.168.1.1 — 양성 매칭", () => {
    expect(matches("IP", "192.168.1.1")).toContain("192.168.1.1");
  });

  it("255.255.255.0 — 서브넷 마스크: 양성", () => {
    expect(matches("IP", "255.255.255.0")).toContain("255.255.255.0");
  });

  it("256.1.1.1 — 범위 초과: 음성", () => {
    expect(matches("IP", "256.1.1.1")).toHaveLength(0);
  });

  it("192.168.1 — 불완전한 IP: 음성", () => {
    expect(matches("IP", "192.168.1")).toHaveLength(0);
  });
});

describe("PASSPORT (여권번호)", () => {
  it("M12345678 — M으로 시작: 양성", () => {
    expect(matches("PASSPORT", "M12345678")).toContain("M12345678");
  });

  it("HF1234567 — H + 영문숫자: 양성", () => {
    expect(matches("PASSPORT", "HF1234567")).toContain("HF1234567");
  });

  it("A12345678 — 잘못된 시작 문자: 음성", () => {
    expect(matches("PASSPORT", "A12345678")).toHaveLength(0);
  });

  it("M1234 — 너무 짧음: 음성", () => {
    expect(matches("PASSPORT", "M1234")).toHaveLength(0);
  });
});

describe("VEHICLE (차량번호)", () => {
  it("12가1234 — 양성 매칭", () => {
    expect(matches("VEHICLE", "12가1234")).toContain("12가1234");
  });

  it("123나5678 — 3자리 지역코드: 양성", () => {
    expect(matches("VEHICLE", "123나5678")).toContain("123나5678");
  });

  it("AB가1234 — 영문 앞자리: 음성", () => {
    expect(matches("VEHICLE", "AB가1234")).toHaveLength(0);
  });

  it("12가12 — 뒷자리 부족: 음성", () => {
    expect(matches("VEHICLE", "12가12")).toHaveLength(0);
  });
});
