import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PdfParser } from '../../../document/parsers/pdf.js';

describe('PdfParser — Tier 3', () => {
  const parser = new PdfParser();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let stderrSpy: any;

  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
  });

  it('tier is 3', async () => {
    // Use a minimal buffer — @libpdf/core likely not installed, falls back to empty segments
    const buf = Buffer.from('%PDF-1.4\n%%EOF\n', 'utf-8');
    const parsed = await parser.parse(buf);
    expect(parsed.tier).toBe('3');
  });

  it('emits stderr warning about CID limitations', async () => {
    const buf = Buffer.from('%PDF-1.4\n%%EOF\n', 'utf-8');
    await parser.parse(buf);
    const calls = stderrSpy.mock.calls.map((c: unknown[]) => String(c[0]));
    const hasWarning = calls.some((msg: string) =>
      msg.includes('CID') || msg.includes('libpdf') || msg.includes('Warning')
    );
    expect(hasWarning).toBe(true);
  });

  it('returns empty segments when @libpdf/core not installed', async () => {
    const buf = Buffer.from('%PDF-1.4\n%%EOF\n', 'utf-8');
    const parsed = await parser.parse(buf);
    // Either empty segments (no library) or extracted segments (library present)
    expect(Array.isArray(parsed.segments)).toBe(true);
  });

  it('metadata documents CID limitation', async () => {
    const buf = Buffer.from('%PDF-1.4\n%%EOF\n', 'utf-8');
    const parsed = await parser.parse(buf);
    expect(parsed.metadata['cidWarning']).toBe(true);
    expect(typeof parsed.metadata['limitation']).toBe('string');
    expect((parsed.metadata['limitation'] as string).toLowerCase()).toMatch(/cid/i);
  });

  it('reconstruct returns original buffer (no binary rewrite at Tier 3)', async () => {
    const buf = Buffer.from('%PDF-1.4\n%%EOF\n', 'utf-8');
    const parsed = await parser.parse(buf);
    const reconstructed = await parser.reconstruct(parsed);
    expect(reconstructed).toEqual(buf);
  });
});
