/**
 * NFC 정규화 래퍼
 * 한국어 자모 분리 문제를 방지하기 위해 모든 텍스트를 NFC로 정규화합니다.
 */
export function normalizeNFC(text: string): string {
  return text.normalize('NFC');
}
