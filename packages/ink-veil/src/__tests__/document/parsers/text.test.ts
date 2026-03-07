import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { TextParser } from '../../../document/parsers/text.js';

function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

describe('TextParser — Tier 1a (SHA-256 round-trip)', () => {
  const parser = new TextParser('txt');

  it('plain UTF-8 text: parse → reconstruct = identical buffer', async () => {
    const original = Buffer.from('안녕하세요, 홍길동입니다.\n이메일: test@example.com\n', 'utf-8');
    const parsed = await parser.parse(original);
    const reconstructed = await parser.reconstruct(parsed);
    expect(sha256(reconstructed)).toBe(sha256(original));
  });

  it('UTF-8 BOM preserved', async () => {
    const bom = Buffer.from([0xef, 0xbb, 0xbf]);
    const content = Buffer.from('BOM test content\n', 'utf-8');
    const original = Buffer.concat([bom, content]);
    const parsed = await parser.parse(original);
    expect(parsed.metadata['hasBom']).toBe(true);
    const reconstructed = await parser.reconstruct(parsed);
    expect(sha256(reconstructed)).toBe(sha256(original));
    expect(reconstructed.slice(0, 3)).toEqual(bom);
  });

  it('empty file round-trips correctly', async () => {
    const original = Buffer.from('', 'utf-8');
    const parsed = await parser.parse(original);
    const reconstructed = await parser.reconstruct(parsed);
    expect(sha256(reconstructed)).toBe(sha256(original));
  });

  it('text with CRLF line endings round-trips correctly', async () => {
    const original = Buffer.from('line1\r\nline2\r\nline3\r\n', 'utf-8');
    const parsed = await parser.parse(original);
    const reconstructed = await parser.reconstruct(parsed);
    expect(sha256(reconstructed)).toBe(sha256(original));
  });
});

describe('MarkdownParser — Tier 1a (code block preservation)', () => {
  const parser = new TextParser('md');

  it('plain markdown round-trips correctly', async () => {
    const original = Buffer.from('# Hello\n\n홍길동에게 보내는 편지\n\n- 항목 1\n- 항목 2\n', 'utf-8');
    const parsed = await parser.parse(original);
    const reconstructed = await parser.reconstruct(parsed);
    expect(sha256(reconstructed)).toBe(sha256(original));
  });

  it('code blocks marked as skippable', async () => {
    const original = Buffer.from('# Title\n\n```\nconst x = "PII_LIKE_DATA";\n```\n\n본문 내용\n', 'utf-8');
    const parsed = await parser.parse(original);
    const codeSegment = parsed.segments.find(s => s.skippable);
    expect(codeSegment).toBeDefined();
    const reconstructed = await parser.reconstruct(parsed);
    expect(sha256(reconstructed)).toBe(sha256(original));
  });

  it('inline code marked as skippable', async () => {
    const original = Buffer.from('텍스트 `inline code` 이후 내용\n', 'utf-8');
    const parsed = await parser.parse(original);
    const codeSegment = parsed.segments.find(s => s.skippable);
    expect(codeSegment).toBeDefined();
    const reconstructed = await parser.reconstruct(parsed);
    expect(sha256(reconstructed)).toBe(sha256(original));
  });
});
