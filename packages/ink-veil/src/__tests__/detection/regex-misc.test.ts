import { describe, it, expect } from 'vitest';
import { PATTERNS, applyPattern } from '../../detection/regex/patterns.js';
import { RegexEngine } from '../../detection/regex/engine.js';

function findPattern(category: string) {
  const p = PATTERNS.find((p) => p.category === category);
  if (!p) throw new Error(`Pattern not found: ${category}`);
  return p;
}

function matches(category: string, text: string): string[] {
  return applyPattern(text, findPattern(category)).map((s) => s.text);
}

describe('IP (IPv4 주소)', () => {
  it('192.168.1.1 — 양성 매칭', () => {
    expect(matches('IP', '192.168.1.1')).toContain('192.168.1.1');
  });

  it('255.255.255.0 — 서브넷 마스크: 양성', () => {
    expect(matches('IP', '255.255.255.0')).toContain('255.255.255.0');
  });

  it('256.1.1.1 — 범위 초과: 음성', () => {
    expect(matches('IP', '256.1.1.1')).toHaveLength(0);
  });

  it('192.168.1 — 불완전한 IP: 음성', () => {
    expect(matches('IP', '192.168.1')).toHaveLength(0);
  });
});

describe('PASSPORT (여권번호)', () => {
  it('M12345678 — M으로 시작: 양성', () => {
    expect(matches('PASSPORT', 'M12345678')).toContain('M12345678');
  });

  it('HF1234567 — H + 영문숫자: 양성', () => {
    expect(matches('PASSPORT', 'HF1234567')).toContain('HF1234567');
  });

  it('A12345678 — 잘못된 시작 문자: 음성', () => {
    expect(matches('PASSPORT', 'A12345678')).toHaveLength(0);
  });

  it('M1234 — 너무 짧음: 음성', () => {
    expect(matches('PASSPORT', 'M1234')).toHaveLength(0);
  });
});

describe('VEHICLE (차량번호)', () => {
  it('12가1234 — 양성 매칭', () => {
    expect(matches('VEHICLE', '12가1234')).toContain('12가1234');
  });

  it('123나5678 — 3자리 지역코드: 양성', () => {
    expect(matches('VEHICLE', '123나5678')).toContain('123나5678');
  });

  it('AB가1234 — 영문 앞자리: 음성', () => {
    expect(matches('VEHICLE', 'AB가1234')).toHaveLength(0);
  });

  it('12가12 — 뒷자리 부족: 음성', () => {
    expect(matches('VEHICLE', '12가12')).toHaveLength(0);
  });
});

describe('RegexEngine integration', () => {
  const engine = new RegexEngine();

  it('텍스트에서 여러 PII 검출', () => {
    const text = '홍길동의 주민번호는 901231-1234567이고 이메일은 user@example.com입니다.';
    const spans = engine.detect(text);
    const categories = spans.map((s) => s.category);
    expect(categories).toContain('RRN');
    expect(categories).toContain('EMAIL');
  });

  it('카테고리 필터링 동작', () => {
    const text = '010-1234-5678, user@example.com, 901231-1234567';
    const spans = engine.detect(text, { categories: ['PHONE'], priorityOrder: ['REGEX'] });
    expect(spans.every((s) => s.category === 'PHONE')).toBe(true);
  });

  it('매칭 없으면 빈 배열 반환', () => {
    const text = '일반적인 텍스트 내용입니다.';
    const spans = engine.detect(text, { categories: ['RRN'], priorityOrder: ['REGEX'] });
    expect(spans).toHaveLength(0);
  });

  it('모든 DetectionSpan 필드 포함', () => {
    const text = '010-1234-5678';
    const spans = engine.detect(text, { categories: ['PHONE'], priorityOrder: ['REGEX'] });
    expect(spans).toHaveLength(1);
    const span = spans[0];
    expect(span).toHaveProperty('start');
    expect(span).toHaveProperty('end');
    expect(span).toHaveProperty('text');
    expect(span).toHaveProperty('category');
    expect(span).toHaveProperty('method', 'REGEX');
    expect(span).toHaveProperty('confidence');
  });
});

describe('패턴 메타데이터', () => {
  it('15개 이상의 패턴 정의됨', () => {
    expect(PATTERNS.length).toBeGreaterThanOrEqual(15);
  });

  it('모든 패턴에 category, confidence, priority 포함', () => {
    for (const p of PATTERNS) {
      expect(p.category).toBeTruthy();
      expect(p.confidence).toBeGreaterThan(0);
      expect(p.priority).toBeGreaterThan(0);
    }
  });
});

describe('DATE (날짜 패턴)', () => {
  const datePatterns = PATTERNS.filter((p) => p.category === 'DATE');

  it('4개의 DATE 패턴이 존재', () => {
    expect(datePatterns).toHaveLength(4);
  });

  describe('DATE_KO (한국어)', () => {
    const pattern = datePatterns[0];

    it('2024년 3월 15일 — 양성', () => {
      expect(applyPattern('2024년 3월 15일', pattern).map((s) => s.text)).toContain('2024년 3월 15일');
    });

    it('2024년 12월 1일 — 양성', () => {
      expect(applyPattern('2024년 12월 1일', pattern).map((s) => s.text)).toContain('2024년 12월 1일');
    });

    it('2024년3월15일 (공백 없음) — 양성', () => {
      expect(applyPattern('2024년3월15일', pattern).map((s) => s.text)).toContain('2024년3월15일');
    });
  });

  describe('DATE_ISO (YYYY-MM-DD)', () => {
    const pattern = datePatterns[1];

    it('2024-03-15 — 양성', () => {
      expect(applyPattern('2024-03-15', pattern).map((s) => s.text)).toContain('2024-03-15');
    });

    it('2024-12-31 — 양성', () => {
      expect(applyPattern('2024-12-31', pattern).map((s) => s.text)).toContain('2024-12-31');
    });

    it('2024-13-01 — 음성 (잘못된 월)', () => {
      expect(applyPattern('2024-13-01', pattern)).toHaveLength(0);
    });

    it('2024-00-15 — 음성 (잘못된 월)', () => {
      expect(applyPattern('2024-00-15', pattern)).toHaveLength(0);
    });

    it('ACCOUNT 패턴과 충돌 없음 (123-45-67890)', () => {
      expect(applyPattern('123-45-67890', pattern)).toHaveLength(0);
    });
  });

  describe('DATE_DOT (YYYY.MM.DD)', () => {
    const pattern = datePatterns[2];

    it('2024.03.15 — 양성', () => {
      expect(applyPattern('2024.03.15', pattern).map((s) => s.text)).toContain('2024.03.15');
    });

    it('2024.13.01 — 음성 (잘못된 월)', () => {
      expect(applyPattern('2024.13.01', pattern)).toHaveLength(0);
    });
  });

  describe('DATE_SLASH (MM/DD/YYYY)', () => {
    const pattern = datePatterns[3];

    it('03/15/2024 — 양성', () => {
      expect(applyPattern('03/15/2024', pattern).map((s) => s.text)).toContain('03/15/2024');
    });

    it('12/31/2024 — 양성', () => {
      expect(applyPattern('12/31/2024', pattern).map((s) => s.text)).toContain('12/31/2024');
    });

    it('13/15/2024 — 음성 (잘못된 월)', () => {
      expect(applyPattern('13/15/2024', pattern)).toHaveLength(0);
    });
  });
});
