import type { DetectionSpan, DetectionMethod } from './types.js';

const METHOD_PRIORITY: Record<DetectionMethod, number> = {
  MANUAL: 1,
  REGEX: 2,
  NER: 3,
};

function getPriority(span: DetectionSpan): number {
  if (span.priority !== undefined) return span.priority;
  return METHOD_PRIORITY[span.method] ?? 99;
}

function overlaps(a: DetectionSpan, b: DetectionSpan): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * 3-엔진(MANUAL, REGEX, NER) 스팬을 병합합니다.
 *
 * 정렬 기준: start ASC, length DESC, priority ASC
 * 겹침 해결: 높은 우선순위(낮은 priority 값) 또는 더 긴 매칭이 이김
 */
export function mergeSpans(
  manual: DetectionSpan[],
  regex: DetectionSpan[],
  ner: DetectionSpan[],
): DetectionSpan[] {
  const all = [...manual, ...regex, ...ner];

  all.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    const lenA = a.end - a.start;
    const lenB = b.end - b.start;
    if (lenA !== lenB) return lenB - lenA; // 긴 것 먼저
    return getPriority(a) - getPriority(b); // 우선순위 낮은 숫자 먼저
  });

  const accepted: DetectionSpan[] = [];

  for (const span of all) {
    const spanPriority = getPriority(span);
    const spanLen = span.end - span.start;

    let dominated = false;
    let i = 0;
    while (i < accepted.length) {
      const existing = accepted[i];
      if (!overlaps(existing, span)) {
        i++;
        continue;
      }

      const existingPriority = getPriority(existing);
      const existingLen = existing.end - existing.start;

      if (spanPriority < existingPriority) {
        // 현재 스팬이 더 높은 우선순위 → 기존 교체
        accepted.splice(i, 1);
      } else if (spanPriority === existingPriority && spanLen > existingLen) {
        // 같은 우선순위에서 더 긴 매칭 → 기존 교체
        accepted.splice(i, 1);
      } else {
        // 기존이 더 좋음 → 현재 스킵
        dominated = true;
        break;
      }
    }

    if (!dominated) {
      accepted.push(span);
    }
  }

  // start 기준 오름차순 정렬 후 반환
  accepted.sort((a, b) => a.start - b.start);
  return accepted;
}
