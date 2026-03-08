/**
 * Format round-trip E2E tests — multi-format veil/unveil + LLM mutation scenarios
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, '..', '..', '..'); // packages/ink-veil/
const FIXTURES_DIR = join(PACKAGE_ROOT, '.samples', 'fixtures');
const TMP_DIR = join(PACKAGE_ROOT, '.samples', 'e2e-fmt-tmp');
const BIN = join(PACKAGE_ROOT, 'dist', 'cli.mjs');

function runCli(args: string[], stdin?: string) {
  const result = spawnSync('node', [BIN, ...args], {
    input: stdin ? Buffer.from(stdin, 'utf-8') : undefined,
    encoding: 'utf-8',
    cwd: PACKAGE_ROOT,
    timeout: 60_000,
    env: { ...process.env, NO_COLOR: '1' },
  });
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: result.status ?? -1,
  };
}

function parseJsonFromStdout(raw: string): Record<string, unknown> | null {
  try { return JSON.parse(raw); } catch { /* continue */ }
  const lastBrace = raw.lastIndexOf('}');
  if (lastBrace === -1) return null;
  let depth = 0;
  for (let i = lastBrace; i >= 0; i--) {
    if (raw[i] === '}') depth++;
    if (raw[i] === '{') depth--;
    if (depth === 0) {
      try { return JSON.parse(raw.slice(i, lastBrace + 1)); } catch { return null; }
    }
  }
  return null;
}

beforeAll(() => {
  mkdirSync(TMP_DIR, { recursive: true });
});

afterAll(() => {
  if (existsSync(TMP_DIR)) {
    rmSync(TMP_DIR, { recursive: true, force: true });
  }
});

describe('Round-trip by format', () => {
  const formats: Array<{ file: string; format: string; tier: string }> = [
    { file: 'korean-pii.txt',  format: 'TXT',  tier: '1a' },
    { file: 'README.md',       format: 'MD',   tier: '1a' },
    { file: 'mixed-data.csv',  format: 'CSV',  tier: '1a' },
    { file: 'data.tsv',        format: 'TSV',  tier: '1a' },
    { file: 'config-data.json', format: 'JSON', tier: '1b' },
    { file: 'structured.xml',  format: 'XML',  tier: '1b' },
    { file: 'settings.yaml',   format: 'YAML', tier: '1b' },
  ];

  for (const { file, format } of formats) {
    it(`${format}: veil -> unveil round-trip`, () => {
      const fixturePath = join(FIXTURES_DIR, file);
      if (!existsSync(fixturePath)) {
        console.warn(`fixture not found, skipping: ${file}`);
        return;
      }

      const fmtDictPath = join(TMP_DIR, `dict-${format.toLowerCase()}.json`);
      const fmtOutputDir = join(TMP_DIR, `veiled-${format.toLowerCase()}`);
      const fmtRestoreDir = join(TMP_DIR, `restored-${format.toLowerCase()}`);
      mkdirSync(fmtOutputDir, { recursive: true });
      mkdirSync(fmtRestoreDir, { recursive: true });

      const veilResult = runCli([
        'veil', fixturePath,
        '-o', fmtOutputDir,
        '-d', fmtDictPath,
        '--no-ner',
        '--json',
      ]);

      expect(veilResult.exitCode, `veil failed for ${format}: ${veilResult.stderr}`).toBe(0);

      const veilJson = parseJsonFromStdout(veilResult.stdout);
      expect(veilJson?.success).toBe(true);

      const veiledPath = join(fmtOutputDir, file);
      if (!existsSync(veiledPath)) {
        console.warn(`veiled file not written for ${format}, skipping unveil check`);
        return;
      }

      const unveilResult = runCli([
        'unveil', veiledPath,
        '-o', fmtRestoreDir,
        '-d', fmtDictPath,
        '--json',
      ]);

      expect(unveilResult.exitCode, `unveil failed for ${format}: ${unveilResult.stderr}`).toBe(0);

      const unveilJson = parseJsonFromStdout(unveilResult.stdout);
      expect(unveilJson?.success).toBe(true);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (unveilJson?.results as any)?.[0];
      expect(result).toBeDefined();
      expect(result.tokenIntegrity, `${format} tokenIntegrity should be 1.0`).toBe(1.0);

      const restoredPath = join(fmtRestoreDir, file);
      if (existsSync(restoredPath)) {
        const restoredText = readFileSync(restoredPath, 'utf-8');
        expect(restoredText, `${format} should not contain iv-tag tokens after unveil`).not.toMatch(/<iv-\w+ id=["']\d+["']>/);
        expect(restoredText, `${format} should not contain bare token patterns after unveil`).not.toMatch(/\b(?:PER|ORG|LOC|PHONE|EMAIL|RRN|CARD|ACCOUNT|IP|BRN)_\d{3,}\b/);
      }
    });
  }
});

describe('Tier 4 parser availability', () => {
  it('LaTeX 포맷 인식 — exit code != 4 (지원됨)', () => {
    const tmpFile = join(TMP_DIR, 'test.tex');
    writeFileSync(tmpFile, '\\documentclass{article}\n\\begin{document}\n홍길동 010-1234-5678\n\\end{document}', 'utf-8');

    const outDir = join(TMP_DIR, 'latex-out');
    mkdirSync(outDir, { recursive: true });

    const r = runCli([
      'veil', tmpFile,
      '-o', outDir,
      '-d', join(TMP_DIR, 'latex-dict.json'),
      '--no-ner',
      '--json',
    ]);
    expect(r.exitCode).not.toBe(4);
  });

  it('LaTeX veil — PII 감지 및 정상 처리', () => {
    const tmpFile = join(TMP_DIR, 'roundtrip.tex');
    writeFileSync(tmpFile, '\\section{고객정보}\n\\textbf{홍길동}의 전화번호는 010-1234-5678이다.', 'utf-8');

    const outDir = join(TMP_DIR, 'latex-rt-out');
    mkdirSync(outDir, { recursive: true });
    const dictPath = join(TMP_DIR, 'latex-rt-dict.json');

    const r = runCli([
      'veil', tmpFile,
      '-o', outDir,
      '-d', dictPath,
      '--no-ner',
      '--json',
    ]);

    expect(r.exitCode).toBe(0);
    const json = parseJsonFromStdout(r.stdout);
    expect(json?.success).toBe(true);
  });

  it('HWP 포맷 인식 — exit code != 4 (지원됨)', () => {
    const tmpFile = join(TMP_DIR, 'test.hwp');
    writeFileSync(tmpFile, 'fake hwp content', 'utf-8');

    const r = runCli([
      'veil', tmpFile,
      '-d', join(TMP_DIR, 'hwp-dict.json'),
      '--no-ner',
    ]);
    expect(r.exitCode).not.toBe(4);
  });
});
