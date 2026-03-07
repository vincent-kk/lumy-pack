import { describe, it, expect } from 'vitest';
import { stripTrailingParticle, KOREAN_PARTICLES } from '../../detection/particles.js';

describe('KOREAN_PARTICLES', () => {
  it('19개 조사 포함', () => {
    expect(KOREAN_PARTICLES.length).toBe(19);
  });

  it('에서부터가 에서보다 앞에 위치 (최장 일치)', () => {
    const idx에서부터 = KOREAN_PARTICLES.indexOf('에서부터');
    const idx에서 = KOREAN_PARTICLES.indexOf('에서');
    expect(idx에서부터).toBeLessThan(idx에서);
  });
});

describe('stripTrailingParticle()', () => {
  it('"홍길동은" → entity: "홍길동", particle: "은"', () => {
    const result = stripTrailingParticle('홍길동은');
    expect(result.entity).toBe('홍길동');
    expect(result.particle).toBe('은');
  });

  it('"서울에서부터" → entity: "서울", particle: "에서부터"', () => {
    const result = stripTrailingParticle('서울에서부터');
    expect(result.entity).toBe('서울');
    expect(result.particle).toBe('에서부터');
  });

  it('"삼성전자의" → entity: "삼성전자", particle: "의"', () => {
    const result = stripTrailingParticle('삼성전자의');
    expect(result.entity).toBe('삼성전자');
    expect(result.particle).toBe('의');
  });

  it('"부산까지" → entity: "부산", particle: "까지"', () => {
    const result = stripTrailingParticle('부산까지');
    expect(result.entity).toBe('부산');
    expect(result.particle).toBe('까지');
  });

  it('"홍길동" (조사 없음) → entity: "홍길동", particle: null', () => {
    const result = stripTrailingParticle('홍길동');
    expect(result.entity).toBe('홍길동');
    expect(result.particle).toBeNull();
  });

  it('"은" (조사만 있는 경우) → 제거하지 않음', () => {
    const result = stripTrailingParticle('은');
    expect(result.entity).toBe('은');
    expect(result.particle).toBeNull();
  });

  it('"서울에서" → entity: "서울", particle: "에서" (에서부터 아닌 경우)', () => {
    const result = stripTrailingParticle('서울에서');
    expect(result.entity).toBe('서울');
    expect(result.particle).toBe('에서');
  });
});
