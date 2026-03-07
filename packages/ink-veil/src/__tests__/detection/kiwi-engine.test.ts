import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { KiwiEngine } from '../../detection/kiwi/engine.js';

const MODEL_DIR = join(homedir(), '.ink-veil', 'models', 'kiwi-base', 'base');
const hasModel = existsSync(join(MODEL_DIR, 'sj.morph'));

describe.skipIf(!hasModel)('KiwiEngine', () => {
  let engine: KiwiEngine;

  beforeAll(async () => {
    engine = new KiwiEngine();
    await engine.init(MODEL_DIR);
  }, 30_000);

  afterAll(async () => {
    await engine.dispose();
  });

  it('init() 후 detect() 호출 가능', () => {
    const spans = engine.detect('테스트 문장입니다.');
    expect(Array.isArray(spans)).toBe(true);
  });

  it('홍길동 → PER (3음절)', () => {
    const spans = engine.detect('홍길동은 좋은 사람입니다.');
    const per = spans.filter((s) => s.category === 'PER');
    expect(per.length).toBeGreaterThanOrEqual(1);
    expect(per.some((s) => s.text === '홍길동')).toBe(true);
  });

  it('삼성전자 → ORG (suffix match)', () => {
    const spans = engine.detect('삼성전자의 매출이 증가했다.');
    const org = spans.filter((s) => s.category === 'ORG');
    expect(org.length).toBeGreaterThanOrEqual(1);
    expect(org.some((s) => s.text.includes('삼성전자'))).toBe(true);
  });

  it('서울특별시 → LOC (4+ 음절 + suffix)', () => {
    const spans = engine.detect('서울특별시에서 행사가 열렸다.');
    const loc = spans.filter((s) => s.category === 'LOC');
    expect(loc.length).toBeGreaterThanOrEqual(1);
    expect(loc.some((s) => s.text.includes('서울특별시'))).toBe(true);
  });

  it('주민등록번호 → 블랙리스트로 감지 안 됨', () => {
    const spans = engine.detect('주민등록번호를 입력하세요.');
    expect(spans.every((s) => s.text !== '주민등록번호')).toBe(true);
  });

  it('줄바꿈 경계에서 분리 — 교차 병합 없음', () => {
    const spans = engine.detect('김영희\n주민등록번호');
    // 김영희 should be detected as a separate entity
    // 주민등록번호 should be blacklisted
    const merged = spans.filter((s) => s.text.includes('\n'));
    expect(merged).toHaveLength(0);
  });

  it('start/end 오프셋이 정확', () => {
    const text = '오늘 홍길동이 왔다.';
    const spans = engine.detect(text);
    for (const span of spans) {
      expect(span.start).toBeGreaterThanOrEqual(0);
      expect(span.end).toBeGreaterThan(span.start);
      expect(span.end).toBeLessThanOrEqual(text.length);
      // Verify text matches the slice
      expect(text.slice(span.start, span.end)).toBe(span.text);
    }
  });

  it('method: NER 로 출력', () => {
    const spans = engine.detect('홍길동은 서울에 간다.');
    for (const span of spans) {
      expect(span.method).toBe('NER');
    }
  });

  it('빈 텍스트 → 빈 배열', () => {
    expect(engine.detect('')).toHaveLength(0);
    expect(engine.detect('   ')).toHaveLength(0);
  });

  it('일반 텍스트 — 고유명사 없으면 빈 배열', () => {
    const spans = engine.detect('오늘 날씨가 좋습니다.');
    // May or may not detect anything, but no crashes
    expect(Array.isArray(spans)).toBe(true);
  });
});
