import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import JSZip from 'jszip';
import { HwpParser } from '../../../document/parsers/hwp.js';
import { RtfParser } from '../../../document/parsers/rtf.js';
import { OdtParser } from '../../../document/parsers/odt.js';
import { LatexParser } from '../../../document/parsers/latex.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let stderrSpy: any;

beforeEach(() => {
  stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
});

afterEach(() => {
  stderrSpy.mockRestore();
});

// ─── HWP ─────────────────────────────────────────────────────────────────────

async function makeHwpx(texts: string[]): Promise<Buffer> {
  const zip = new JSZip();
  const textRuns = texts.map(t => `<hp:t>${t}</hp:t>`).join('');
  zip.file('Contents/section0.xml', `<?xml version="1.0"?><hp:sec xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph">${textRuns}</hp:sec>`);
  return zip.generateAsync({ type: 'nodebuffer' });
}

describe('HwpParser — Tier 4', () => {
  const parser = new HwpParser();

  it('tier is 4', async () => {
    const buf = await makeHwpx(['hello']);
    const parsed = await parser.parse(buf);
    expect(parsed.tier).toBe('4');
  });

  it('metadata has guarantee:none', async () => {
    const buf = await makeHwpx(['hello']);
    const parsed = await parser.parse(buf);
    expect(parsed.metadata['guarantee']).toBe('none');
  });

  it('emits Tier 4 stderr warning', async () => {
    const buf = await makeHwpx(['hello']);
    await parser.parse(buf);
    const calls = stderrSpy.mock.calls.map((c: unknown[]) => String(c[0]));
    expect(calls.some((m: string) => m.includes('Tier 4'))).toBe(true);
  });

  it('extracts text from HWPx ZIP', async () => {
    const buf = await makeHwpx(['홍길동', '삼성전자']);
    const parsed = await parser.parse(buf);
    const texts = parsed.segments.map(s => s.text);
    expect(texts).toContain('홍길동');
    expect(texts).toContain('삼성전자');
  });

  it('reconstruct returns original buffer', async () => {
    const buf = await makeHwpx(['hello']);
    const parsed = await parser.parse(buf);
    const reconstructed = await parser.reconstruct(parsed);
    expect(reconstructed).toEqual(buf);
  });
});

// ─── RTF ─────────────────────────────────────────────────────────────────────

describe('RtfParser — Tier 4', () => {
  const parser = new RtfParser();

  it('tier is 4', async () => {
    const buf = Buffer.from('{\\rtf1\\ansi {\\pard 안녕하세요\\par}}', 'latin1');
    const parsed = await parser.parse(buf);
    expect(parsed.tier).toBe('4');
  });

  it('metadata has guarantee:none', async () => {
    const buf = Buffer.from('{\\rtf1\\ansi {\\pard hello\\par}}', 'latin1');
    const parsed = await parser.parse(buf);
    expect(parsed.metadata['guarantee']).toBe('none');
  });

  it('emits Tier 4 stderr warning', async () => {
    const buf = Buffer.from('{\\rtf1 hello}', 'latin1');
    await parser.parse(buf);
    const calls = stderrSpy.mock.calls.map((c: unknown[]) => String(c[0]));
    expect(calls.some((m: string) => m.includes('Tier 4'))).toBe(true);
  });

  it('extracts plain text from RTF', async () => {
    const buf = Buffer.from('{\\rtf1\\ansi {\\pard 홍길동\\par}}', 'latin1');
    const parsed = await parser.parse(buf);
    expect(parsed.segments.length).toBeGreaterThan(0);
  });

  it('handles Unicode escape sequences', async () => {
    // \uN? is RTF Unicode encoding
    const buf = Buffer.from('{\\rtf1\\ansi {\\pard \\u54556? \\u44ธ? hello\\par}}', 'latin1');
    const parsed = await parser.parse(buf);
    expect(Array.isArray(parsed.segments)).toBe(true);
  });

  it('reconstruct returns original buffer', async () => {
    const buf = Buffer.from('{\\rtf1 hello}', 'latin1');
    const parsed = await parser.parse(buf);
    const reconstructed = await parser.reconstruct(parsed);
    expect(reconstructed).toEqual(buf);
  });
});

// ─── ODT ─────────────────────────────────────────────────────────────────────

async function makeOdt(textContent: string): Promise<Buffer> {
  const zip = new JSZip();
  zip.file('content.xml', `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
                         xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0">
  <office:body><office:text>
    <text:p>${textContent}</text:p>
  </office:text></office:body>
</office:document-content>`);
  return zip.generateAsync({ type: 'nodebuffer' });
}

describe('OdtParser — Tier 4', () => {
  const parser = new OdtParser('odt');

  it('tier is 4', async () => {
    const buf = await makeOdt('hello');
    const parsed = await parser.parse(buf);
    expect(parsed.tier).toBe('4');
  });

  it('metadata has guarantee:none', async () => {
    const buf = await makeOdt('hello');
    const parsed = await parser.parse(buf);
    expect(parsed.metadata['guarantee']).toBe('none');
  });

  it('emits Tier 4 stderr warning', async () => {
    const buf = await makeOdt('hello');
    await parser.parse(buf);
    const calls = stderrSpy.mock.calls.map((c: unknown[]) => String(c[0]));
    expect(calls.some((m: string) => m.includes('Tier 4'))).toBe(true);
  });

  it('extracts text from content.xml', async () => {
    const buf = await makeOdt('홍길동');
    const parsed = await parser.parse(buf);
    const texts = parsed.segments.map(s => s.text);
    expect(texts.some(t => t.includes('홍길동'))).toBe(true);
  });

  it('reconstruct returns original buffer', async () => {
    const buf = await makeOdt('hello');
    const parsed = await parser.parse(buf);
    const reconstructed = await parser.reconstruct(parsed);
    expect(reconstructed).toEqual(buf);
  });
});

// ─── LaTeX ───────────────────────────────────────────────────────────────────

describe('LatexParser — Tier 4', () => {
  const parser = new LatexParser();

  it('tier is 4', async () => {
    const buf = Buffer.from('\\documentclass{article}\n\\begin{document}\nhello\n\\end{document}', 'utf-8');
    const parsed = await parser.parse(buf);
    expect(parsed.tier).toBe('4');
  });

  it('metadata has guarantee:none', async () => {
    const buf = Buffer.from('hello world', 'utf-8');
    const parsed = await parser.parse(buf);
    expect(parsed.metadata['guarantee']).toBe('none');
  });

  it('emits Tier 4 stderr warning', async () => {
    const buf = Buffer.from('hello', 'utf-8');
    await parser.parse(buf);
    const calls = stderrSpy.mock.calls.map((c: unknown[]) => String(c[0]));
    expect(calls.some((m: string) => m.includes('Tier 4'))).toBe(true);
  });

  it('extracts text stripping LaTeX commands', async () => {
    const latex = '\\section{제목}\n\n\\textbf{홍길동}은 \\emph{삼성전자}에 다닌다.';
    const buf = Buffer.from(latex, 'utf-8');
    const parsed = await parser.parse(buf);
    const allText = parsed.segments.map(s => s.text).join(' ');
    expect(allText).toContain('홍길동');
    expect(allText).toContain('삼성전자');
    expect(allText).not.toContain('\\textbf');
  });

  it('skips math environments', async () => {
    const latex = 'Normal text.\n\n\\begin{equation}\nE = mc^2\n\\end{equation}\n\nMore text.';
    const buf = Buffer.from(latex, 'utf-8');
    const parsed = await parser.parse(buf);
    const allText = parsed.segments.map(s => s.text).join(' ');
    expect(allText).toContain('Normal text');
    expect(allText).toContain('More text');
    expect(allText).not.toContain('mc^2');
  });

  it('reconstruct returns original buffer', async () => {
    const buf = Buffer.from('hello world', 'utf-8');
    const parsed = await parser.parse(buf);
    const reconstructed = await parser.reconstruct(parsed);
    expect(reconstructed).toEqual(buf);
  });
});
