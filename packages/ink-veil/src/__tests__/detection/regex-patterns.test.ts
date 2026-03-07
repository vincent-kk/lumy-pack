import { describe, it, expect } from 'vitest';
import { PATTERNS, applyPattern } from '../../detection/regex/patterns.js';
import { RegexEngine } from '../../detection/regex/engine.js';

// 패턴 카테고리별 테스트 헬퍼
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

describe('CARD (카드번호)', () => {
  it('4111-1111-1111-1111 — Visa: 양성', () => {
    expect(matches('CARD', '4111-1111-1111-1111')).toHaveLength(1);
  });

  it('5500-0000-0000-0004 — MasterCard: 양성', () => {
    expect(matches('CARD', '5500-0000-0000-0004')).toHaveLength(1);
  });

  it('1234-5678-9012-3456 — 비표준 번호: 음성', () => {
    expect(matches('CARD', '1234-5678-9012-3456')).toHaveLength(0);
  });

  it('1234 — 너무 짧음: 음성', () => {
    expect(matches('CARD', '1234')).toHaveLength(0);
  });
});

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
