/**
 * NER-enabled E2E pipeline tests
 *
 * GLiNER ONNX 모델이 설치된 환경에서만 실행.
 * 결과 파일은 .samples/ner-test-results/ 에 보존 (수동 품질 확인용).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, '..', '..', '..');
const FIXTURES_DIR = join(PACKAGE_ROOT, '.samples', 'fixtures');
const RESULTS_DIR = join(PACKAGE_ROOT, '.samples', 'ner-test-results');
const BIN = join(PACKAGE_ROOT, 'dist', 'cli.mjs');

const MANIFEST_PATH = join(
  homedir(),
  '.ink-veil',
  'models',
  'gliner_multi-v2.1',
  '.manifest.json',
);

const hasNerModel = existsSync(MANIFEST_PATH);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function runCli(args: string[]) {
  const result = spawnSync('node', [BIN, ...args], {
    encoding: 'utf-8',
    cwd: PACKAGE_ROOT,
    timeout: 60_000,
    env: { ...process.env, NO_COLOR: '1' },
  });
  // ONNX Runtime worker cleanup can cause SIGABRT after successful execution.
  // Treat as exit 0 if stdout contains valid JSON with success: true.
  let exitCode = result.status ?? -1;
  if (exitCode === -1 && result.signal === 'SIGABRT') {
    const json = parseJsonFromStdout(result.stdout ?? '');
    if (json?.success === true) exitCode = 0;
  }
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode,
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

// ---------------------------------------------------------------------------
// NER Pipeline E2E Tests
// ---------------------------------------------------------------------------

describe.skipIf(!hasNerModel)('NER pipeline E2E', () => {
  const KOREAN_PII = join(FIXTURES_DIR, 'korean-pii.txt');
  const VEILED_DIR = join(RESULTS_DIR, 'veiled');
  const RESTORED_DIR = join(RESULTS_DIR, 'restored');
  const DICT_PATH = join(RESULTS_DIR, 'ner-dict.json');

  beforeAll(() => {
    mkdirSync(VEILED_DIR, { recursive: true });
    mkdirSync(RESTORED_DIR, { recursive: true });
  });

  // -------------------------------------------------------------------------
  // A. NER 감지 테스트 (detect 명령어)
  // -------------------------------------------------------------------------

  it('A: detect — NER 파이프라인 정상 실행 및 엔티티 감지', { timeout: 30_000 }, () => {
    const r = runCli(['detect', KOREAN_PII, '--json']);
    expect(r.exitCode, `detect failed: ${r.stderr}`).toBe(0);

    const json = parseJsonFromStdout(r.stdout);
    expect(json?.success).toBe(true);

    // Save result
    writeFileSync(
      join(RESULTS_DIR, 'detect-result.json'),
      JSON.stringify(json, null, 2),
      'utf-8',
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results = json?.results as any[];
    expect(results?.length).toBeGreaterThan(0);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entities = results[0]?.entities as any[];
    expect(entities?.length, 'NER 파이프라인이 엔티티를 감지해야 함').toBeGreaterThan(0);

    // NER 스팬이 1개 이상 존재하는지 검증
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nerSpans = entities?.filter((e: any) => e.method === 'NER') ?? [];
    expect(nerSpans.length, 'NER method 스팬이 1개 이상 있어야 함').toBeGreaterThanOrEqual(1);

    for (const span of nerSpans) {
      expect(span).toHaveProperty('text');
      expect(span).toHaveProperty('category');
      expect(span).toHaveProperty('start');
      expect(span).toHaveProperty('end');
      expect(span).toHaveProperty('confidence');
    }
  });

  // -------------------------------------------------------------------------
  // B. NER + Regex 통합 veil 테스트
  // -------------------------------------------------------------------------

  it('B: veil — NER 포함 veil 결과에 iv- 태그 존재', { timeout: 30_000 }, () => {
    const r = runCli([
      'veil', KOREAN_PII,
      '-o', VEILED_DIR,
      '-d', DICT_PATH,
      '--json',
    ]);
    expect(r.exitCode, `veil failed: ${r.stderr}`).toBe(0);

    const json = parseJsonFromStdout(r.stdout);
    expect(json?.success).toBe(true);

    writeFileSync(
      join(RESULTS_DIR, 'veil-result.json'),
      JSON.stringify(json, null, 2),
      'utf-8',
    );

    const veiledPath = join(VEILED_DIR, 'korean-pii.txt');
    expect(existsSync(veiledPath), 'veiled 파일이 생성되어야 함').toBe(true);

    const veiledText = readFileSync(veiledPath, 'utf-8');
    expect(veiledText).toMatch(/<iv-/);
  });

  // -------------------------------------------------------------------------
  // C. NER veil → unveil round-trip
  // -------------------------------------------------------------------------

  it('C: unveil — round-trip tokenIntegrity === 1.0', { timeout: 30_000 }, () => {
    const veiledPath = join(VEILED_DIR, 'korean-pii.txt');
    expect(existsSync(veiledPath), 'B 테스트의 veiled 파일이 필요').toBe(true);

    const r = runCli([
      'unveil', veiledPath,
      '-o', RESTORED_DIR,
      '-d', DICT_PATH,
      '--json',
    ]);
    expect(r.exitCode, `unveil failed: ${r.stderr}`).toBe(0);

    const json = parseJsonFromStdout(r.stdout);
    expect(json?.success).toBe(true);

    writeFileSync(
      join(RESULTS_DIR, 'unveil-result.json'),
      JSON.stringify(json, null, 2),
      'utf-8',
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (json?.results as any)?.[0];
    expect(result).toBeDefined();
    expect(result.tokenIntegrity, 'tokenIntegrity === 1.0').toBe(1.0);
  });

  // -------------------------------------------------------------------------
  // D. Regex-only 대비 NER 추가 감지 확인
  // -------------------------------------------------------------------------

  it('D: NER 포함 시 substitutions >= regex-only', { timeout: 30_000 }, () => {
    const regexOnlyDir = join(RESULTS_DIR, 'regex-only-veiled');
    const regexOnlyDict = join(RESULTS_DIR, 'regex-only-dict.json');
    mkdirSync(regexOnlyDir, { recursive: true });

    // Regex-only veil
    const regexResult = runCli([
      'veil', KOREAN_PII,
      '-o', regexOnlyDir,
      '-d', regexOnlyDict,
      '--no-ner',
      '--json',
    ]);
    expect(regexResult.exitCode, `regex-only veil failed: ${regexResult.stderr}`).toBe(0);

    const regexJson = parseJsonFromStdout(regexResult.stdout);
    expect(regexJson?.success).toBe(true);

    // NER veil (B 테스트의 결과 파일 재사용, 없으면 직접 실행)
    let nerJson: Record<string, unknown>;
    const nerResultPath = join(RESULTS_DIR, 'veil-result.json');
    if (existsSync(nerResultPath)) {
      nerJson = JSON.parse(readFileSync(nerResultPath, 'utf-8'));
    } else {
      const nerDir = join(RESULTS_DIR, 'ner-veiled-d');
      const nerDict = join(RESULTS_DIR, 'ner-dict-d.json');
      mkdirSync(nerDir, { recursive: true });
      const nerResult = runCli([
        'veil', KOREAN_PII,
        '-o', nerDir,
        '-d', nerDict,
        '--json',
      ]);
      expect(nerResult.exitCode, `NER veil failed: ${nerResult.stderr}`).toBe(0);
      nerJson = parseJsonFromStdout(nerResult.stdout) ?? {};
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const regexEntities = (regexJson?.results as any)?.[0]?.entitiesFound ?? 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nerEntities = (nerJson?.results as any)?.[0]?.entitiesFound ?? 0;

    // Save comparison
    writeFileSync(
      join(RESULTS_DIR, 'comparison.json'),
      JSON.stringify({
        regexOnly: { entitiesFound: regexEntities },
        nerEnabled: { entitiesFound: nerEntities },
        nerAddedMore: nerEntities >= regexEntities,
      }, null, 2),
      'utf-8',
    );

    expect(
      nerEntities,
      `NER(${nerEntities}) >= regex-only(${regexEntities})`,
    ).toBeGreaterThanOrEqual(regexEntities);
  });
});
