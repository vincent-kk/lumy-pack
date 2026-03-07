import { describe, it, expect, vi } from 'vitest';
import { DetectionPipeline } from '../../detection/index.js';
import type { DictionaryLike } from '../../detection/index.js';

describe('DetectionPipeline', () => {
  it('NFC 정규화 후 감지', async () => {
    const pipeline = new DetectionPipeline({ noNer: true });
    const text = 'user@example.com';
    const spans = await pipeline.detect(text);
    expect(spans.some((s) => s.category === 'EMAIL')).toBe(true);
  });

  it('REGEX 엔진이 RRN 감지', async () => {
    const pipeline = new DetectionPipeline({ noNer: true });
    const spans = await pipeline.detect('주민번호: 901231-1234567');
    expect(spans.some((s) => s.category === 'RRN')).toBe(true);
  });

  it('MANUAL 규칙이 문자열 패턴 감지', async () => {
    const pipeline = new DetectionPipeline({
      manual: [{ pattern: 'Project-Alpha', category: 'PROJECT' }],
      noNer: true,
    });
    const spans = await pipeline.detect('이 문서는 Project-Alpha에 관한 것입니다.');
    expect(spans.some((s) => s.category === 'PROJECT')).toBe(true);
  });

  it('MANUAL 규칙이 regex 패턴 감지', async () => {
    const pipeline = new DetectionPipeline({
      manual: [{ pattern: /INV-\d{8}/g, category: 'INVOICE' }],
      noNer: true,
    });
    const spans = await pipeline.detect('인보이스 INV-20240101 처리');
    expect(spans.some((s) => s.category === 'INVOICE')).toBe(true);
  });

  it('dictionary.addEntity()가 각 스팬에 대해 호출됨', async () => {
    const pipeline = new DetectionPipeline({ noNer: true });
    const dict: DictionaryLike = { addEntity: vi.fn().mockReturnValue('TOKEN_001') };
    await pipeline.detect('user@example.com 010-1234-5678', dict);
    expect(dict.addEntity).toHaveBeenCalledWith('user@example.com', 'EMAIL');
    expect(dict.addEntity).toHaveBeenCalledWith('010-1234-5678', 'PHONE');
  });

  it('결과 스팬이 start 기준 정렬됨', async () => {
    const pipeline = new DetectionPipeline({ noNer: true });
    const spans = await pipeline.detect('010-1234-5678 그리고 user@example.com');
    for (let i = 1; i < spans.length; i++) {
      expect(spans[i].start).toBeGreaterThanOrEqual(spans[i - 1].start);
    }
  });

  it('빈 텍스트 → 빈 배열', async () => {
    const pipeline = new DetectionPipeline({ noNer: true });
    expect(await pipeline.detect('')).toHaveLength(0);
  });
});
