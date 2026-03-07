import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { CsvParser } from '../../../document/parsers/csv.js';

function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

describe('CsvParser — Tier 1a (SHA-256 round-trip)', () => {
  it('plain CSV round-trips correctly', async () => {
    const parser = new CsvParser('csv');
    const original = Buffer.from('name,email,phone\n홍길동,hong@example.com,010-1234-5678\n김철수,kim@example.com,010-9876-5432\n', 'utf-8');
    const parsed = await parser.parse(original);
    const reconstructed = await parser.reconstruct(parsed);
    expect(sha256(reconstructed)).toBe(sha256(original));
  });

  it('quoted fields remain quoted after round-trip', async () => {
    const parser = new CsvParser('csv');
    const original = Buffer.from('name,address\n"홍길동","서울시 강남구, 역삼동"\n', 'utf-8');
    const parsed = await parser.parse(original);
    const reconstructed = await parser.reconstruct(parsed);
    const text = reconstructed.toString('utf-8');
    expect(text).toContain('"서울시 강남구, 역삼동"');
    expect(sha256(reconstructed)).toBe(sha256(original));
  });

  it('TSV (tab-delimited) round-trips correctly', async () => {
    const parser = new CsvParser('tsv');
    const original = Buffer.from('name\temail\tphone\n홍길동\thong@example.com\t010-1234-5678\n', 'utf-8');
    const parsed = await parser.parse(original);
    expect(parsed.metadata['delimiter']).toBe('\t');
    const reconstructed = await parser.reconstruct(parsed);
    expect(sha256(reconstructed)).toBe(sha256(original));
  });

  it('cell values correctly extracted as segments', async () => {
    const parser = new CsvParser('csv');
    const original = Buffer.from('a,b\nc,d\n', 'utf-8');
    const parsed = await parser.parse(original);
    const texts = parsed.segments.map(s => s.text);
    expect(texts).toContain('a');
    expect(texts).toContain('b');
    expect(texts).toContain('c');
    expect(texts).toContain('d');
  });
});
