import type { DetectionSpan } from '../types.js';

export interface RegexPattern {
  category: string;
  pattern: RegExp;
  confidence: number;
  priority: number;
}

/**
 * 한국어 PII 정규식 패턴 목록 (15개 이상)
 * priority: 낮을수록 높은 우선순위 (1=최고, 5=최저)
 */
export const PATTERNS: RegexPattern[] = [
  {
    // 주민등록번호: YYMMDD-XXXXXXX (7번째 자리 1-4)
    category: 'RRN',
    pattern: /\b(\d{6})-([1-4]\d{6})\b/g,
    confidence: 1.0,
    priority: 1,
  },
  {
    // 외국인등록번호: YYMMDD-XXXXXXX (7번째 자리 5-8)
    category: 'ARN',
    pattern: /\b(\d{6})-([5-8]\d{6})\b/g,
    confidence: 0.85,
    priority: 1,
  },
  {
    // 법인등록번호: YYMMDD-XXXXXXX (7번째 자리 9 또는 XXXXXXX 전체)
    category: 'CRN',
    pattern: /\b(\d{6})-([9]\d{6})\b/g,
    confidence: 0.7,
    priority: 2,
  },
  {
    // 사업자등록번호: XXX-XX-XXXXX
    category: 'BRN',
    pattern: /\b\d{3}-\d{2}-\d{5}\b/g,
    confidence: 0.95,
    priority: 1,
  },
  {
    // 운전면허번호: XX-XX-XXXXXX-XX (지역코드-연도-일련번호-검증)
    category: 'DL',
    pattern: /\b([가-힣]{2}|\d{2})-(\d{2})-(\d{6})-(\d{2})\b/g,
    confidence: 0.85,
    priority: 2,
  },
  {
    // 여권번호: M/H/P + 영문자숫자 조합 (8자리)
    category: 'PASSPORT',
    pattern: /\b[MHP][A-Z0-9]{8}\b/g,
    confidence: 0.8,
    priority: 2,
  },
  {
    // 휴대폰번호: 010/011/016/017/018/019-XXXX-XXXX
    category: 'PHONE',
    pattern: /\b(01[016789])-(\d{3,4})-(\d{4})\b/g,
    confidence: 1.0,
    priority: 1,
  },
  {
    // 유선전화: 지역번호(02,031,...)-XXXX-XXXX
    category: 'TEL',
    pattern: /\b(0[2-9]\d?)-(\d{3,4})-(\d{4})\b/g,
    confidence: 0.8,
    priority: 2,
  },
  {
    // 이메일 주소
    category: 'EMAIL',
    pattern: /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g,
    confidence: 0.99,
    priority: 1,
  },
  {
    // 신용카드번호: Visa/MC (16자리), Amex (15자리)
    // 하이픈 혹은 공백 구분자 허용
    category: 'CARD',
    pattern: /\b(?:4\d{3}|5[1-5]\d{2}|3[47]\d{2})[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{3,4}\b/g,
    confidence: 0.9,
    priority: 1,
  },
  {
    // 계좌번호: 하이픈으로 구분된 숫자 (최소 10자리)
    category: 'ACCOUNT',
    pattern: /\b\d{4}-\d{2,6}-\d{2,6}(?:-\d{1,3})?\b/g,
    confidence: 0.6,
    priority: 3,
  },
  {
    // IPv4 주소 (0-255 범위 검증)
    category: 'IP',
    pattern: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
    confidence: 0.85,
    priority: 2,
  },
  {
    // 일련번호: 영문+숫자 혼합 8-20자리
    category: 'SERIAL',
    pattern: /\b[A-Z]{2,4}-?[A-Z0-9]{4,16}\b/g,
    confidence: 0.5,
    priority: 4,
  },
  {
    // 우편번호: 5자리 (구 6자리 제외)
    category: 'ZIPCODE',
    pattern: /\b\d{5}\b(?!\d)/g,
    confidence: 0.6,
    priority: 4,
  },
  {
    // 차량번호: 한글 포함 차량 번호판
    category: 'VEHICLE',
    pattern: /\b\d{2,3}[가-힣]\d{4}\b/g,
    confidence: 0.85,
    priority: 2,
  },
  {
    // 건강보험증번호: XXXXXXXXXX (10자리 숫자)
    category: 'HEALTH_INS',
    pattern: /\b(?<!\d)\d{10}(?!\d)\b/g,
    confidence: 0.55,
    priority: 4,
  },
];

export function applyPattern(text: string, regexPattern: RegexPattern): DetectionSpan[] {
  const spans: DetectionSpan[] = [];
  const pattern = new RegExp(regexPattern.pattern.source, regexPattern.pattern.flags);

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    spans.push({
      start: match.index,
      end: match.index + match[0].length,
      text: match[0],
      category: regexPattern.category,
      method: 'REGEX',
      confidence: regexPattern.confidence,
      priority: regexPattern.priority,
    });
  }
  return spans;
}
