import { describe, it, expect, vi } from "vitest";
import { DetectionPipeline } from "../../detection/index.js";
import type { DictionaryLike } from "../../detection/index.js";

describe("DetectionPipeline", () => {
  it("NFC 정규화 후 감지", async () => {
    const pipeline = new DetectionPipeline({ noNer: true });
    const text = "user@example.com";
    const spans = await pipeline.detect(text);
    expect(spans.some((s) => s.category === "EMAIL")).toBe(true);
  });

  it("REGEX 엔진이 RRN 감지", async () => {
    const pipeline = new DetectionPipeline({ noNer: true });
    const spans = await pipeline.detect("주민번호: 901231-1234567");
    expect(spans.some((s) => s.category === "RRN")).toBe(true);
  });

  it("MANUAL 규칙이 문자열 패턴 감지", async () => {
    const pipeline = new DetectionPipeline({
      manual: [{ pattern: "Project-Alpha", category: "PROJECT" }],
      noNer: true,
    });
    const spans = await pipeline.detect(
      "이 문서는 Project-Alpha에 관한 것입니다.",
    );
    expect(spans.some((s) => s.category === "PROJECT")).toBe(true);
  });

  it("MANUAL 규칙이 regex 패턴 감지", async () => {
    const pipeline = new DetectionPipeline({
      manual: [{ pattern: /INV-\d{8}/g, category: "INVOICE" }],
      noNer: true,
    });
    const spans = await pipeline.detect("인보이스 INV-20240101 처리");
    expect(spans.some((s) => s.category === "INVOICE")).toBe(true);
  });

  it("dictionary.addEntity()가 각 스팬에 대해 호출됨", async () => {
    const pipeline = new DetectionPipeline({ noNer: true });
    const dict: DictionaryLike = {
      addEntity: vi.fn().mockReturnValue("TOKEN_001"),
    };
    await pipeline.detect("user@example.com 010-1234-5678", dict);
    expect(dict.addEntity).toHaveBeenCalledWith("user@example.com", "EMAIL");
    expect(dict.addEntity).toHaveBeenCalledWith("010-1234-5678", "PHONE");
  });

  it("결과 스팬이 start 기준 정렬됨", async () => {
    const pipeline = new DetectionPipeline({ noNer: true });
    const spans = await pipeline.detect(
      "010-1234-5678 그리고 user@example.com",
    );
    for (let i = 1; i < spans.length; i++) {
      expect(spans[i].start).toBeGreaterThanOrEqual(spans[i - 1].start);
    }
  });

  it("빈 텍스트 → 빈 배열", async () => {
    const pipeline = new DetectionPipeline({ noNer: true });
    expect(await pipeline.detect("")).toHaveLength(0);
  });

  describe("userWords (particle-aware matching)", () => {
    it("조사가 붙은 단어를 매칭하되 span은 원형만 포함", async () => {
      const pipeline = new DetectionPipeline({
        userWords: [{ text: "삼성전자", category: "ORG" }],
        noNer: true,
      });
      const spans = await pipeline.detect("삼성전자의 매출이 증가했다.");
      const matched = spans.filter((s) => s.category === "ORG");

      expect(matched).toHaveLength(1);
      expect(matched[0].text).toBe("삼성전자");
      expect(matched[0].end - matched[0].start).toBe(4);
      expect(matched[0].method).toBe("MANUAL");
      expect(matched[0].confidence).toBe(1.0);
      expect(matched[0].priority).toBe(1);
    });

    it("여러 조사에 대해 모두 매칭", async () => {
      const pipeline = new DetectionPipeline({
        userWords: [{ text: "삼성전자" }],
        noNer: true,
      });

      for (const suffix of ["의", "가", "에서", "를", "은", "와", "로"]) {
        const spans = await pipeline.detect(`삼성전자${suffix} 근무`);
        const matched = spans.filter((s) => s.text === "삼성전자");
        expect(matched.length).toBeGreaterThanOrEqual(1);
        expect(matched[0].text).toBe("삼성전자");
      }
    });

    it("조사가 아닌 글자가 이어지면 매칭하지 않음", async () => {
      const pipeline = new DetectionPipeline({
        userWords: [{ text: "삼성전자" }],
        noNer: true,
      });
      const spans = await pipeline.detect("삼성전자회의에 참석");
      const matched = spans.filter((s) => s.text === "삼성전자");
      expect(matched).toHaveLength(0);
    });

    it("단어 뒤가 공백이면 매칭", async () => {
      const pipeline = new DetectionPipeline({
        userWords: [{ text: "홍길동" }],
        noNer: true,
      });
      const spans = await pipeline.detect("홍길동 입니다");
      expect(spans.filter((s) => s.text === "홍길동")).toHaveLength(1);
    });

    it("단어가 텍스트 끝이면 매칭", async () => {
      const pipeline = new DetectionPipeline({
        userWords: [{ text: "홍길동" }],
        noNer: true,
      });
      const spans = await pipeline.detect("이름은 홍길동");
      expect(spans.filter((s) => s.text === "홍길동")).toHaveLength(1);
    });

    it("기본 category는 CUSTOM", async () => {
      const pipeline = new DetectionPipeline({
        userWords: [{ text: "홍길동" }],
        noNer: true,
      });
      const spans = await pipeline.detect("홍길동의 이메일");
      const matched = spans.filter((s) => s.text === "홍길동");
      expect(matched[0].category).toBe("CUSTOM");
    });

    it("기존 ManualRule과 함께 동작", async () => {
      const pipeline = new DetectionPipeline({
        manual: [{ pattern: "Project-X", category: "PROJECT" }],
        userWords: [{ text: "삼성전자", category: "ORG" }],
        noNer: true,
      });
      const spans = await pipeline.detect("삼성전자의 Project-X 보고서");
      expect(
        spans.some((s) => s.category === "ORG" && s.text === "삼성전자"),
      ).toBe(true);
      expect(
        spans.some((s) => s.category === "PROJECT" && s.text === "Project-X"),
      ).toBe(true);
    });
  });
});
