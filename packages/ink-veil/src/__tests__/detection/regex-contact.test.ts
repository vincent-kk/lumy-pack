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

describe('PHONE (휴대폰번호)', () => {
  it('010-1234-5678 — 양성 매칭', () => {
    expect(matches('PHONE', '010-1234-5678')).toContain('010-1234-5678');
  });

  it('011-987-6543 — 구형 011 번호: 양성', () => {
    expect(matches('PHONE', '011-987-6543')).toContain('011-987-6543');
  });

  it('123-456-7890 — 비한국 형식: 음성', () => {
    expect(matches('PHONE', '123-456-7890')).toHaveLength(0);
  });

  it('02-1234-5678 — 유선전화(02): 음성 for PHONE', () => {
    expect(matches('PHONE', '02-1234-5678')).toHaveLength(0);
  });
});

describe('TEL (유선전화)', () => {
  it('02-1234-5678 — 서울 유선전화: 양성', () => {
    expect(matches('TEL', '02-1234-5678')).toContain('02-1234-5678');
  });

  it('031-987-6543 — 경기도 유선전화: 양성', () => {
    expect(matches('TEL', '031-987-6543')).toContain('031-987-6543');
  });

  it('010-1234-5678 — 휴대폰: 음성 for TEL', () => {
    expect(matches('TEL', '010-1234-5678')).toHaveLength(0);
  });

  it('1-800-555-1234 — 미국 전화번호: 음성', () => {
    expect(matches('TEL', '1-800-555-1234')).toHaveLength(0);
  });
});

describe('EMAIL (이메일)', () => {
  it('user@example.com — 양성 매칭', () => {
    expect(matches('EMAIL', 'user@example.com')).toContain('user@example.com');
  });

  it('test.user+tag@sub.domain.co.kr — 복잡한 이메일: 양성', () => {
    expect(matches('EMAIL', 'test.user+tag@sub.domain.co.kr')).toContain('test.user+tag@sub.domain.co.kr');
  });

  it('@incomplete — @ 앞 없음: 음성', () => {
    expect(matches('EMAIL', '@incomplete')).toHaveLength(0);
  });

  it('notanemail — @ 없음: 음성', () => {
    expect(matches('EMAIL', 'notanemail')).toHaveLength(0);
  });
});
