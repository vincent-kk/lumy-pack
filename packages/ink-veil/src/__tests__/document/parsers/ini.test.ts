import { describe, it, expect, vi, afterEach } from 'vitest';
import { isDeepStrictEqual } from 'node:util';
import * as ini from 'ini';
import { IniParser } from '../../../document/parsers/ini.js';

describe('IniParser — Tier 1b (semantic equality)', () => {
  const parser = new IniParser();

  const sampleIni = `[person]
name=홍길동
rrn=901231-1234567

[contact]
email=hong@example.com
phone=010-1234-5678
`;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parse → reconstruct: parsed content is deep equal', async () => {
    const original = Buffer.from(sampleIni, 'utf-8');
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const parsed = await parser.parse(original);
    const reconstructed = await parser.reconstruct(parsed);

    const origObj = ini.parse(original.toString('utf-8'));
    const reconObj = ini.parse(reconstructed.toString('utf-8'));
    expect(isDeepStrictEqual(origObj, reconObj)).toBe(true);
  });

  it('text segments are extracted from all sections', async () => {
    const original = Buffer.from(sampleIni, 'utf-8');
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const parsed = await parser.parse(original);
    const texts = parsed.segments.map((s) => s.text);

    expect(texts).toContain('홍길동');
    expect(texts).toContain('901231-1234567');
    expect(texts).toContain('hong@example.com');
  });

  it('writes INI comment loss warning to stderr on parse', async () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const original = Buffer.from(sampleIni, 'utf-8');

    await parser.parse(original);

    const calls = stderrSpy.mock.calls.map((c) => String(c[0]));
    expect(calls.some((m) => m.includes('INI comments are stripped'))).toBe(true);
  });

  it('modified segments reconstruct with changes', async () => {
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const original = Buffer.from('[user]\nname=홍길동\n', 'utf-8');
    const parsed = await parser.parse(original);

    const nameSeg = parsed.segments.find((s) => s.text === '홍길동');
    expect(nameSeg).toBeDefined();
    nameSeg!.text = 'PER_001';

    const reconstructed = await parser.reconstruct(parsed);
    const reconObj = ini.parse(reconstructed.toString('utf-8')) as Record<string, Record<string, string>>;
    expect(reconObj['user']?.['name']).toBe('PER_001');
  });

  it('tier is 1b', async () => {
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const original = Buffer.from('[x]\nk=v\n', 'utf-8');
    const parsed = await parser.parse(original);
    expect(parsed.tier).toBe('1b');
  });

  it('format is ini', async () => {
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const original = Buffer.from('[x]\nk=v\n', 'utf-8');
    const parsed = await parser.parse(original);
    expect(parsed.format).toBe('ini');
  });
});
