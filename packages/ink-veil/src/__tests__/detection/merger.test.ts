import { describe, it, expect } from 'vitest';
import { mergeSpans } from '../../detection/merger.js';
import type { DetectionSpan } from '../../detection/types.js';

function span(
  start: number,
  end: number,
  category: string,
  method: 'MANUAL' | 'REGEX' | 'NER',
  priority?: number,
): DetectionSpan {
  return {
    start,
    end,
    text: `text[${start}:${end}]`,
    category,
    method,
    confidence: 1.0,
    priority,
  };
}

describe('mergeSpans()', () => {
  it('겹침 없는 스팬들은 모두 유지됨', () => {
    const regex = [span(0, 5, 'RRN', 'REGEX'), span(10, 15, 'EMAIL', 'REGEX')];
    const result = mergeSpans([], regex, []);
    expect(result).toHaveLength(2);
    expect(result[0].start).toBe(0);
    expect(result[1].start).toBe(10);
  });

  it('결과는 start 기준 오름차순 정렬', () => {
    const regex = [span(10, 15, 'EMAIL', 'REGEX'), span(0, 5, 'RRN', 'REGEX')];
    const result = mergeSpans([], regex, []);
    expect(result[0].start).toBe(0);
    expect(result[1].start).toBe(10);
  });

  it('MANUAL이 겹치는 REGEX보다 우선순위 높음', () => {
    const manual = [span(0, 10, 'PROJECT', 'MANUAL')];
    const regex = [span(3, 8, 'RRN', 'REGEX')];
    const result = mergeSpans(manual, regex, []);
    expect(result).toHaveLength(1);
    expect(result[0].method).toBe('MANUAL');
    expect(result[0].category).toBe('PROJECT');
  });

  it('REGEX가 겹치는 NER보다 우선순위 높음 (숫자/ID 카테고리)', () => {
    const regex = [span(0, 14, 'RRN', 'REGEX')];
    const ner = [span(0, 6, 'DATE', 'NER')];
    const result = mergeSpans([], regex, ner);
    expect(result).toHaveLength(1);
    expect(result[0].method).toBe('REGEX');
  });

  it('같은 우선순위에서 더 긴 매칭이 이김', () => {
    const a = span(0, 5, 'PHONE', 'REGEX');
    const b = span(0, 13, 'PHONE', 'REGEX');
    const result = mergeSpans([], [a, b], []);
    expect(result).toHaveLength(1);
    expect(result[0].end).toBe(13);
  });

  it('빈 입력 → 빈 결과', () => {
    expect(mergeSpans([], [], [])).toHaveLength(0);
  });

  it('명시적 priority 값이 method 기반 우선순위보다 우선함', () => {
    // priority=1(높음)인 NER vs priority=2(낮음)인 MANUAL
    const nerHighPrio = { ...span(0, 5, 'PER', 'NER'), priority: 1 };
    const manualLowPrio = { ...span(0, 5, 'PROJECT', 'MANUAL'), priority: 2 };
    const result = mergeSpans([manualLowPrio], [], [nerHighPrio]);
    expect(result).toHaveLength(1);
    expect(result[0].method).toBe('NER');
    expect(result[0].priority).toBe(1);
  });

  it('비겹치는 MANUAL + REGEX + NER 모두 유지', () => {
    const manual = [span(0, 3, 'PER', 'MANUAL')];
    const regex = [span(5, 19, 'RRN', 'REGEX')];
    const ner = [span(21, 25, 'ORG', 'NER')];
    const result = mergeSpans(manual, regex, ner);
    expect(result).toHaveLength(3);
  });

  it('겹치는 스팬 중 더 높은 우선순위로 교체 후 비겹치는 스팬과 공존', () => {
    const manual = [span(5, 15, 'PROJECT', 'MANUAL')]; // 우선순위 높음
    const regex = [span(0, 5, 'RRN', 'REGEX'), span(8, 12, 'PHONE', 'REGEX')]; // 뒤 것은 manual과 겹침
    const result = mergeSpans(manual, regex, []);
    // RRN(0-5)은 유지, MANUAL(5-15)은 유지, PHONE(8-12)은 MANUAL에 가려짐
    const categories = result.map((s) => s.category);
    expect(categories).toContain('RRN');
    expect(categories).toContain('PROJECT');
    expect(categories).not.toContain('PHONE');
  });
});
