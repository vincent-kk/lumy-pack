import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DetectionPipeline } from '../../detection/index.js';
import type { DetectionSpan } from '../../detection/types.js';

/**
 * Accuracy regression test for chunked detection.
 * Compares detectChunked() results against detect() baseline.
 * Gate: F1 >= 0.95 for all samples.
 */

interface AccuracyResult {
  precision: number;
  recall: number;
  f1: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
}

function calculateF1(expected: DetectionSpan[], actual: DetectionSpan[]): AccuracyResult {
  const expectedSet = new Set(expected.map((s) => `${s.start}:${s.end}:${s.text}`));
  const actualSet = new Set(actual.map((s) => `${s.start}:${s.end}:${s.text}`));

  let truePositives = 0;
  for (const key of actualSet) {
    if (expectedSet.has(key)) truePositives++;
  }

  const falsePositives = actualSet.size - truePositives;
  const falseNegatives = expectedSet.size - truePositives;

  const precision = actualSet.size === 0 ? 1.0 : truePositives / actualSet.size;
  const recall = expectedSet.size === 0 ? 1.0 : truePositives / expectedSet.size;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

  return { precision, recall, f1, truePositives, falsePositives, falseNegatives };
}

// 20+ Korean PII samples for accuracy testing
const koreanPiiSamples = [
  { name: '이름 (2글자)', text: '김철수는 오늘 회의에 참석했습니다.' },
  { name: '이름 (3글자)', text: '홍길동에게 연락 바랍니다.' },
  { name: '주민등록번호', text: '주민번호는 900101-1234567입니다.' },
  { name: '주민등록번호 (하이픈 없음)', text: '주민번호 9001011234567로 확인했습니다.' },
  { name: '전화번호 (010)', text: '연락처: 010-1234-5678로 전화주세요.' },
  { name: '전화번호 (02)', text: '사무실 번호 02-123-4567입니다.' },
  { name: '전화번호 (031)', text: '경기도 지역 031-456-7890번.' },
  { name: '이메일', text: 'admin@example.com으로 문의하세요.' },
  { name: '이메일 (복잡)', text: '이메일: user.name+tag@company.co.kr로 보내주세요.' },
  { name: '도로명주소', text: '서울특별시 강남구 테헤란로 152에 위치합니다.' },
  { name: '지번주소', text: '주소: 서울시 강남구 역삼동 123-45번지' },
  { name: '계좌번호', text: '국민은행 123-456789-01-001로 입금해주세요.' },
  { name: '여권번호', text: '여권번호 M12345678로 신청했습니다.' },
  { name: '운전면허번호', text: '면허번호: 11-23-456789-01' },
  { name: '카드번호', text: '카드번호는 1234-5678-9012-3456입니다.' },
  { name: '복합 (이름+전화)', text: '김영희의 번호는 010-9876-5432이며, 이메일은 kim@test.com입니다.' },
  { name: '복합 (주소+주민)', text: '서울시 마포구 합정동에 거주하는 박지수(890203-2345678)씨.' },
  { name: '복합 (다수 이메일)', text: 'admin@foo.com과 user@bar.org에 동시 발송합니다.' },
  { name: '복합 (전화+계좌)', text: '010-1111-2222로 연락 후 우리은행 1002-123-456789로 송금.' },
  { name: '긴 문장', text: '2024년 1월 15일, 서울특별시 서초구에 거주하는 이민호(950315-1234567)씨는 010-5555-6666으로 연락 가능하며, minholee@gmail.com으로도 문의할 수 있습니다.' },
  { name: '짧은 텍스트', text: '010-1234-5678' },
  { name: 'PII 없음', text: '오늘 날씨가 참 좋습니다.' },
  { name: '영문 혼합', text: 'John의 번호는 010-3333-4444이고, john@example.com입니다.' },
  { name: '다수 엔티티', text: '홍길동(010-1234-5678, hong@test.com), 김철수(010-8765-4321, kim@test.com) 참석' },
];

describe('chunking accuracy regression', () => {
  let pipeline: DetectionPipeline;

  beforeAll(() => {
    pipeline = new DetectionPipeline({ noNer: true }); // regex-only for deterministic results
  });

  afterAll(async () => {
    await pipeline.dispose();
  });

  it('F1 scorer calculates correctly for perfect match', () => {
    const spans: DetectionSpan[] = [
      { start: 0, end: 3, text: 'abc', category: 'PER', method: 'REGEX', confidence: 1.0 },
    ];
    const result = calculateF1(spans, spans);
    expect(result.f1).toBe(1.0);
    expect(result.truePositives).toBe(1);
  });

  it('F1 scorer calculates correctly for no match', () => {
    const expected: DetectionSpan[] = [
      { start: 0, end: 3, text: 'abc', category: 'PER', method: 'REGEX', confidence: 1.0 },
    ];
    const actual: DetectionSpan[] = [
      { start: 5, end: 8, text: 'xyz', category: 'PER', method: 'REGEX', confidence: 1.0 },
    ];
    const result = calculateF1(expected, actual);
    expect(result.f1).toBe(0);
  });

  it('F1 scorer handles empty spans', () => {
    const result = calculateF1([], []);
    expect(result.f1).toBe(1.0);
  });

  // detectChunked with small chunkSize should produce same results as detect for small texts
  it('detectChunked produces identical results to detect for small texts', async () => {
    for (const sample of koreanPiiSamples) {
      const baseline = await pipeline.detect(sample.text);
      const chunked = await pipeline.detectChunked(sample.text, { chunkSize: 65536 });
      const result = calculateF1(baseline, chunked);
      expect(result.f1, `F1 failed for: ${sample.name}`).toBe(1.0);
    }
  });

  // Test with very small chunkSize to force chunking
  for (const sample of koreanPiiSamples) {
    it(`maintains F1 >= 0.95 with small chunks for: ${sample.name}`, async () => {
      const baseline = await pipeline.detect(sample.text);
      // Use small chunkSize (128) with large overlap (64) to force chunking on even short texts
      const chunked = await pipeline.detectChunked(sample.text, { chunkSize: 128, overlap: 64 });
      const result = calculateF1(baseline, chunked);

      if (baseline.length > 0) {
        expect(result.f1, `F1 score ${result.f1.toFixed(3)} < 0.95 for: ${sample.name}`).toBeGreaterThanOrEqual(0.95);
      }
    });
  }

  // Test with a large generated text
  it('handles large text with repeated PII patterns', async () => {
    const segment = '홍길동의 번호는 010-1234-5678이고 이메일은 test@example.com입니다. ';
    const largeText = segment.repeat(100);

    const baseline = await pipeline.detect(largeText);
    const chunked = await pipeline.detectChunked(largeText, { chunkSize: 512, overlap: 64 });
    const result = calculateF1(baseline, chunked);

    expect(result.f1, `Large text F1: ${result.f1.toFixed(3)}`).toBeGreaterThanOrEqual(0.95);
  });
});
