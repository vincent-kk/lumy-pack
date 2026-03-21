/**
 * 한국어 조사 목록 (최장 일치 우선 순서)
 * 19개 조사 패턴: 긴 것부터 앞에 배치하여 부분 매칭 방지
 */
export const KOREAN_PARTICLES: string[] = [
  "에서부터",
  "에서",
  "까지",
  "부터",
  "으로",
  "에게",
  "한테",
  "와",
  "과",
  "은",
  "는",
  "이",
  "가",
  "을",
  "를",
  "의",
  "도",
  "만",
  "로",
];

/**
 * 텍스트 끝에서 한국어 조사를 제거합니다.
 * 최장 일치 원칙에 따라 KOREAN_PARTICLES 순서대로 시도합니다.
 *
 * @returns { entity: string; particle: string | null }
 */
export function stripTrailingParticle(text: string): {
  entity: string;
  particle: string | null;
} {
  for (const particle of KOREAN_PARTICLES) {
    if (text.endsWith(particle) && text.length > particle.length) {
      return {
        entity: text.slice(0, text.length - particle.length),
        particle,
      };
    }
  }
  return { entity: text, particle: null };
}
