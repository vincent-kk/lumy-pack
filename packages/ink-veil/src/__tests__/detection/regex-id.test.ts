import { describe, it, expect } from 'vitest';
import { PATTERNS, applyPattern } from '../../detection/regex/patterns.js';

function findPattern(category: string) {
  const p = PATTERNS.find((p) => p.category === category);
  if (!p) throw new Error(`Pattern not found: ${category}`);
  return p;
}

function matches(category: string, text: string): string[] {
  return applyPattern(text, findPattern(category)).map((s) => s.text);
}

describe('RRN (주민등록번호)', () => {
  it('901231-1234567 — 양성 매칭', () => {
    expect(matches('RRN', '901231-1234567')).toContain('901231-1234567');
  });

  it('850101-2345678 — 양성 매칭', () => {
    expect(matches('RRN', '850101-2345678')).toContain('850101-2345678');
  });

  it('000000-0000000 — 7번째 자리 0: 음성', () => {
    expect(matches('RRN', '000000-0000000')).toHaveLength(0);
  });

  it('901231-9234567 — 7번째 자리 9(ARN): 음성 for RRN', () => {
    expect(matches('RRN', '901231-9234567')).toHaveLength(0);
  });
});

describe('ARN (외국인등록번호)', () => {
  it('901231-5234567 — 7번째 자리 5: 양성', () => {
    expect(matches('ARN', '901231-5234567')).toContain('901231-5234567');
  });

  it('801015-8123456 — 7번째 자리 8: 양성', () => {
    expect(matches('ARN', '801015-8123456')).toContain('801015-8123456');
  });

  it('901231-1234567 — 7번째 자리 1(RRN): 음성 for ARN', () => {
    expect(matches('ARN', '901231-1234567')).toHaveLength(0);
  });

  it('abcdef-5123456 — 숫자 아님: 음성', () => {
    expect(matches('ARN', 'abcdef-5123456')).toHaveLength(0);
  });
});

describe('BRN (사업자등록번호)', () => {
  it('123-45-67890 — 양성 매칭', () => {
    expect(matches('BRN', '123-45-67890')).toContain('123-45-67890');
  });

  it('999-88-12345 — 양성 매칭', () => {
    expect(matches('BRN', '999-88-12345')).toContain('999-88-12345');
  });

  it('12-345-67890 — 잘못된 형식: 음성', () => {
    expect(matches('BRN', '12-345-67890')).toHaveLength(0);
  });

  it('123456789 — 하이픈 없음: 음성', () => {
    expect(matches('BRN', '123456789')).toHaveLength(0);
  });
});
