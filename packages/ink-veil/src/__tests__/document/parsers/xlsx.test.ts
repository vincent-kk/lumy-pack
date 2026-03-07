import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { XlsxParser } from '../../../document/parsers/xlsx.js';

function makeXlsx(rows: (string | number | null)[][]): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

function makeXlsxWithFormula(): Buffer {
  const wb = XLSX.utils.book_new();
  const ws: XLSX.WorkSheet = {
    A1: { t: 's', v: '홍길동' },
    A2: { t: 'n', v: 42, f: 'SUM(1,1)' },
    A3: { t: 's', v: 'test@example.com' },
    '!ref': 'A1:A3',
  };
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

describe('XlsxParser — Tier 2', () => {
  const parser = new XlsxParser();

  it('tier is 2', async () => {
    const buf = makeXlsx([['hello']]);
    const parsed = await parser.parse(buf);
    expect(parsed.tier).toBe('2');
  });

  it('extracts string cell values as segments', async () => {
    const buf = makeXlsx([['홍길동', 'test@example.com'], ['김철수', '010-1234-5678']]);
    const parsed = await parser.parse(buf);
    const texts = parsed.segments.map(s => s.text);
    expect(texts).toContain('홍길동');
    expect(texts).toContain('test@example.com');
    expect(texts).toContain('김철수');
    expect(texts).toContain('010-1234-5678');
  });

  it('formula cells are skipped (not extracted as segments)', async () => {
    const buf = makeXlsxWithFormula();
    const parsed = await parser.parse(buf);
    const texts = parsed.segments.map(s => s.text);
    expect(texts).toContain('홍길동');
    expect(texts).toContain('test@example.com');
    // Formula cell (A2) should not appear as a segment
    expect(texts).not.toContain('42');
  });

  it('reconstruct replaces cell values', async () => {
    const buf = makeXlsx([['홍길동', 'test@example.com']]);
    const parsed = await parser.parse(buf);
    // Replace first segment
    parsed.segments[0].text = 'PER_001';
    const reconstructed = await parser.reconstruct(parsed);

    const reParsed = await parser.parse(reconstructed);
    const texts = reParsed.segments.map(s => s.text);
    expect(texts).toContain('PER_001');
    expect(texts).not.toContain('홍길동');
  });

  it('formula cells preserved after reconstruct', async () => {
    const buf = makeXlsxWithFormula();
    const parsed = await parser.parse(buf);
    const reconstructed = await parser.reconstruct(parsed);
    // Check formula cell is still present
    const wb = XLSX.read(reconstructed, { type: 'buffer', cellFormula: true });
    const ws = wb.Sheets['Sheet1']!;
    const a2 = ws['A2'] as XLSX.CellObject;
    expect(a2.f).toBeDefined();
  });
});
