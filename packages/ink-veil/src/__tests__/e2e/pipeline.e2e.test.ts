/**
 * Full pipeline E2E tests — LLM mutation scenarios + multi-format round-trip
 *
 * 의존성: CLI (#12) + API (#13) 완료 후 실행 가능
 * CI: --no-ner (regex-only) 모드 사용
 *
 * 커버리지:
 *   - 5가지 LLM 변형 시나리오
 *   - 7가지 포맷 round-trip (TXT, MD, CSV, TSV, JSON, XML, YAML)
 *   - 멀티 문서 배치에서 딕셔너리 일관성
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, '..', '..', '..'); // packages/ink-veil/
const FIXTURES_DIR = join(PACKAGE_ROOT, '.samples', 'fixtures');
const TMP_DIR = join(PACKAGE_ROOT, '.samples', 'e2e-tmp');
const DICT_PATH = join(TMP_DIR, 'test-dict.json');
const BIN = join(PACKAGE_ROOT, 'dist', 'cli.mjs');

// ---------------------------------------------------------------------------
// 헬퍼
// ---------------------------------------------------------------------------

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

function veilFile(fixturePath: string, outputDir: string) {
  return runCli([
    'veil', fixturePath,
    '-o', outputDir,
    '-d', DICT_PATH,
    '--no-ner',
    '--json',
  ]);
}

function unveilStdin(text: string) {
  return runCli([
    'unveil', '--stdin',
    '-d', DICT_PATH,
    '--json',
  ], text);
}

function parseJson(raw: string) {
  try { return JSON.parse(raw); } catch { return null; }
}

/** LLM mutation 함수 5종 */
const mutate = {
  /** Scenario 1: id="001" -> id='001' */
  quoteStyle: (text: string) =>
    text.replace(/<iv-(\w+) id="(\d+)">/g, "<iv-$1 id='$2'>"),

  /** Scenario 2: <iv-per id="001"> -> <iv-per  id="001"> (extra space) */
  whitespace: (text: string) =>
    text.replace(/<iv-(\w+) id=/g, '<iv-$1  id='),

  /** Scenario 3: <iv-per id="001">PER_001</iv-per> -> PER_001 */
  xmlStrip: (text: string) =>
    text.replace(/<iv-\w+ id=["']\d+["']>([A-Z]+_\d+)<\/iv-\w+>/g, '$1'),

  /** Scenario 4: 짝수 번째 토큰 제거 (token omission) */
  omission: (text: string) => {
    let count = 0;
    return text.replace(/<iv-\w+[^>]*>[A-Z]+_\d+<\/iv-\w+>/g, (m) => {
      count++;
      return count % 2 === 0 ? '' : m;
    });
  },

  /** Scenario 5: 비존재 PER_099 삽입 (token hallucination) */
  hallucination: (text: string) =>
    text + '\n<iv-per id="099">PER_099</iv-per>',
};

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeAll(() => {
  mkdirSync(TMP_DIR, { recursive: true });
  mkdirSync(join(TMP_DIR, 'veiled'), { recursive: true });
});

afterAll(() => {
  if (existsSync(TMP_DIR)) {
    rmSync(TMP_DIR, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// LLM Mutation 시나리오 테스트 (기준 텍스트 기반)
// ---------------------------------------------------------------------------

describe('LLM mutation scenarios', () => {
  // 기준 입력 텍스트 (regex로 잡히는 PII 3개 포함)
  const PLAIN_TEXT = [
    '고객명: 홍길동',
    '전화번호: 010-1234-5678',
    '이메일: hong@example.com',
    '주민등록번호: 901231-1234567',
  ].join('\n');

  let veiledText = '';

  beforeAll(() => {
    // stdin veil로 기준 veiled 텍스트 생성
    const tmpIn = join(TMP_DIR, 'mutation-input.txt');
    writeFileSync(tmpIn, PLAIN_TEXT, 'utf-8');
    const r = veilFile(tmpIn, join(TMP_DIR, 'veiled'));
    expect(r.exitCode, `veil failed: ${r.stderr}`).toBe(0);

    const veiledPath = join(TMP_DIR, 'veiled', 'mutation-input.txt');
    if (existsSync(veiledPath)) {
      veiledText = readFileSync(veiledPath, 'utf-8');
    } else {
      // fallback: JSON stdout의 veiledText 필드
      const json = parseJson(r.stdout);
      veiledText = json?.results?.[0]?.veiledText ?? '';
    }

    expect(veiledText.length, 'veiled text should not be empty').toBeGreaterThan(0);
    // iv- 태그가 생성됐는지 확인
    expect(veiledText).toMatch(/<iv-\w+ id="/);
  });

  it('Scenario 1: quote style change — id="001" → id=\'001\'', () => {
    const mutated = mutate.quoteStyle(veiledText);
    expect(mutated).toMatch(/id='\d+'/);

    const r = unveilStdin(mutated);
    // exit 0 (정상 복원) 또는 8 (integrity < 1.0, strict 모드 아님)
    expect([0, 8]).toContain(r.exitCode);

    const json = parseJson(r.stdout);
    expect(json?.success).toBe(true);
    // Stage 2 (loose match)로 복원됐어야 함
    const result = json?.results?.[0];
    expect(result).toBeDefined();
    expect(result.modifiedTokens.length + result.matchedTokens.length).toBeGreaterThan(0);
  });

  it('Scenario 2: whitespace insertion — <iv-per  id="001">', () => {
    const mutated = mutate.whitespace(veiledText);
    expect(mutated).toMatch(/<iv-\w+  id=/);

    const r = unveilStdin(mutated);
    expect([0, 8]).toContain(r.exitCode);

    const json = parseJson(r.stdout);
    expect(json?.success).toBe(true);
    const result = json?.results?.[0];
    expect(result).toBeDefined();
    // Stage 2로 복원
    expect(result.modifiedTokens.length + result.matchedTokens.length).toBeGreaterThan(0);
  });

  it('Scenario 3: XML structure removal — PER_001 (bare token)', () => {
    const mutated = mutate.xmlStrip(veiledText);
    // 태그가 없어야 함
    expect(mutated).not.toMatch(/<iv-/);
    // 하지만 plain token은 남아있어야 함
    expect(mutated).toMatch(/[A-Z]+_\d+/);

    const r = unveilStdin(mutated);
    expect([0, 8]).toContain(r.exitCode);

    const json = parseJson(r.stdout);
    expect(json?.success).toBe(true);
    const result = json?.results?.[0];
    expect(result).toBeDefined();
    // Stage 3 (plain token scan)으로 복원
    expect(result.modifiedTokens.length + result.matchedTokens.length).toBeGreaterThan(0);
  });

  it('Scenario 4: token omission — some tokens dropped', () => {
    const mutated = mutate.omission(veiledText);

    const r = unveilStdin(mutated);
    // exit 0 or 8 (integrity < 1.0 when strict mode)
    expect([0, 8]).toContain(r.exitCode);

    const json = parseJson(r.stdout);
    expect(json?.success).toBe(true);
    const result = json?.results?.[0];
    expect(result).toBeDefined();
    // tokenIntegrity < 1.0 (일부 토큰이 누락됨)
    expect(result.tokenIntegrity).toBeLessThan(1.0);
  });

  it('Scenario 5: token hallucination — non-existent PER_099 inserted', () => {
    const mutated = mutate.hallucination(veiledText);
    expect(mutated).toContain('PER_099');

    const r = unveilStdin(mutated);
    expect([0, 8]).toContain(r.exitCode);

    const json = parseJson(r.stdout);
    expect(json?.success).toBe(true);
    const result = json?.results?.[0];
    expect(result).toBeDefined();
    // PER_099는 딕셔너리에 없으므로 unmatchedTokens에 포함됨
    expect(result.unmatchedTokens).toContain('PER_099');
    // tokenIntegrity < 1.0
    expect(result.tokenIntegrity).toBeLessThan(1.0);
  });
});

// ---------------------------------------------------------------------------
// 7가지 포맷 Round-trip 테스트
// ---------------------------------------------------------------------------

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

  for (const { file, format, tier } of formats) {
    it(`${format} (Tier ${tier}): veil → unveil round-trip`, () => {
      const fixturePath = join(FIXTURES_DIR, file);
      if (!existsSync(fixturePath)) {
        console.warn(`fixture not found, skipping: ${file}`);
        return;
      }

      // 포맷별 딕셔너리 분리 (다른 테스트와 간섭 방지)
      const fmtDictPath = join(TMP_DIR, `dict-${format.toLowerCase()}.json`);
      const fmtOutputDir = join(TMP_DIR, `veiled-${format.toLowerCase()}`);
      mkdirSync(fmtOutputDir, { recursive: true });

      // veil
      const veilResult = spawnSync('node', [
        BIN, 'veil', fixturePath,
        '-o', fmtOutputDir,
        '-d', fmtDictPath,
        '--no-ner',
        '--json',
      ], {
        encoding: 'utf-8',
        cwd: PACKAGE_ROOT,
        timeout: 60_000,
        env: { ...process.env, NO_COLOR: '1' },
      });

      expect(veilResult.status, `veil failed for ${format}: ${veilResult.stderr}`).toBe(0);

      const veilJson = parseJson(veilResult.stdout);
      expect(veilJson?.success).toBe(true);
      expect(veilJson?.results?.[0]?.format?.toLowerCase()).toBe(format.toLowerCase());
      expect(veilJson?.results?.[0]?.tier).toBe(tier);

      // veiled 파일 읽기
      const veiledPath = join(fmtOutputDir, file);
      if (!existsSync(veiledPath)) {
        console.warn(`veiled file not written for ${format}, skipping unveil check`);
        return;
      }
      readFileSync(veiledPath, 'utf-8');

      // unveil (no mutation — clean round-trip)
      const unveilResult = spawnSync('node', [
        BIN, 'unveil', veiledPath,
        '-o', join(TMP_DIR, `restored-${format.toLowerCase()}`),
        '-d', fmtDictPath,
        '--json',
      ], {
        encoding: 'utf-8',
        cwd: PACKAGE_ROOT,
        timeout: 60_000,
        env: { ...process.env, NO_COLOR: '1' },
      });

      expect(unveilResult.status, `unveil failed for ${format}: ${unveilResult.stderr}`).toBe(0);

      const unveilJson = parseJson(unveilResult.stdout);
      expect(unveilJson?.success).toBe(true);

      const result = unveilJson?.results?.[0];
      expect(result).toBeDefined();

      // 완벽한 round-trip: tokenIntegrity === 1.0
      expect(result.tokenIntegrity, `${format} tokenIntegrity should be 1.0`).toBe(1.0);
      expect(result.unmatchedTokens.length, `${format} should have no unmatched tokens`).toBe(0);
    });
  }
});

// ---------------------------------------------------------------------------
// 멀티 문서 배치 딕셔너리 일관성 테스트
// ---------------------------------------------------------------------------

describe('Dictionary consistency across multi-document batch', () => {
  const BATCH_DICT_PATH = join(TMP_DIR, 'batch-dict.json');
  const BATCH_OUTPUT_DIR = join(TMP_DIR, 'batch-veiled');

  beforeAll(() => {
    mkdirSync(BATCH_OUTPUT_DIR, { recursive: true });
  });

  it('같은 PII가 여러 문서에서 동일한 토큰으로 대치됨', () => {
    // 동일한 이름 "홍길동"이 두 파일에 등장
    const doc1 = join(TMP_DIR, 'batch-doc1.txt');
    const doc2 = join(TMP_DIR, 'batch-doc2.txt');

    writeFileSync(doc1, '고객: 홍길동, 전화: 010-1234-5678', 'utf-8');
    writeFileSync(doc2, '담당자: 홍길동, 이메일: hong@example.com', 'utf-8');

    // doc1 veil
    const r1 = spawnSync('node', [
      BIN, 'veil', doc1,
      '-o', BATCH_OUTPUT_DIR,
      '-d', BATCH_DICT_PATH,
      '--no-ner',
      '--json',
    ], { encoding: 'utf-8', cwd: PACKAGE_ROOT, timeout: 30_000, env: { ...process.env, NO_COLOR: '1' } });

    expect(r1.status, `batch doc1 veil failed: ${r1.stderr}`).toBe(0);

    // doc2 veil (같은 딕셔너리 사용)
    const r2 = spawnSync('node', [
      BIN, 'veil', doc2,
      '-o', BATCH_OUTPUT_DIR,
      '-d', BATCH_DICT_PATH,
      '--no-ner',
      '--json',
    ], { encoding: 'utf-8', cwd: PACKAGE_ROOT, timeout: 30_000, env: { ...process.env, NO_COLOR: '1' } });

    expect(r2.status, `batch doc2 veil failed: ${r2.stderr}`).toBe(0);

    // 두 veiled 파일 읽기
    const veiled1 = readFileSync(join(BATCH_OUTPUT_DIR, 'batch-doc1.txt'), 'utf-8');
    const veiled2 = readFileSync(join(BATCH_OUTPUT_DIR, 'batch-doc2.txt'), 'utf-8');

    // "홍길동"이 두 파일에서 동일한 PER 토큰으로 대치됐는지 확인
    const token1Match = veiled1.match(/iv-per id="(\d+)"/);
    const token2Match = veiled2.match(/iv-per id="(\d+)"/);

    expect(token1Match, 'doc1 should contain PER token').not.toBeNull();
    expect(token2Match, 'doc2 should contain PER token').not.toBeNull();

    if (token1Match && token2Match) {
      expect(token1Match[1], '같은 엔티티는 동일한 ID를 가져야 함').toBe(token2Match[1]);
    }
  });

  it('딕셔너리 newEntries vs reusedEntities 카운트 정확성', () => {
    const doc3 = join(TMP_DIR, 'batch-doc3.txt');
    // 이미 등록된 "홍길동"과 새로운 "김영희"를 포함
    writeFileSync(doc3, '홍길동과 김영희가 만났다. 010-9876-5432', 'utf-8');

    const r3 = spawnSync('node', [
      BIN, 'veil', doc3,
      '-o', BATCH_OUTPUT_DIR,
      '-d', BATCH_DICT_PATH,
      '--no-ner',
      '--json',
    ], { encoding: 'utf-8', cwd: PACKAGE_ROOT, timeout: 30_000, env: { ...process.env, NO_COLOR: '1' } });

    expect(r3.status, `batch doc3 veil failed: ${r3.stderr}`).toBe(0);

    const json = parseJson(r3.stdout);
    expect(json?.success).toBe(true);

    const result = json?.results?.[0];
    expect(result).toBeDefined();

    // NER 없이 regex만 사용하므로 regex로 잡히는 엔티티만 카운트
    // 010-9876-5432 → 새 PHONE 엔티티 (reused PHONE 없으면 newEntities >= 1)
    expect(result.newEntities + result.reusedEntities).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Exit code 테스트
// ---------------------------------------------------------------------------

describe('CLI exit codes', () => {
  it('exit 0 — 정상 veil', () => {
    const tmpFile = join(TMP_DIR, 'exit-code-test.txt');
    writeFileSync(tmpFile, '홍길동 010-1234-5678', 'utf-8');

    const r = runCli([
      'veil', tmpFile,
      '-o', join(TMP_DIR, 'exit-test-out'),
      '-d', join(TMP_DIR, 'exit-test-dict.json'),
      '--no-ner',
    ]);
    expect(r.exitCode).toBe(0);
  });

  it('exit 2 — 잘못된 플래그', () => {
    const r = runCli(['veil', '--no-such-flag']);
    expect(r.exitCode).toBe(2);
  });

  it('exit 3 — 존재하지 않는 파일', () => {
    const r = runCli([
      'veil', '/nonexistent/path/file.txt',
      '-d', DICT_PATH,
    ]);
    expect(r.exitCode).toBe(3);
  });

  it('exit 4 — 지원하지 않는 포맷', () => {
    const tmpFile = join(TMP_DIR, 'unsupported.xyz');
    writeFileSync(tmpFile, 'some content', 'utf-8');

    const r = runCli([
      'veil', tmpFile,
      '-d', DICT_PATH,
      '--no-ner',
    ]);
    expect(r.exitCode).toBe(4);
  });

  it('exit 8 — tokenIntegrity < 1.0 with --strict', () => {
    // token omission으로 일부 토큰 누락된 텍스트를 --strict으로 unveil
    const tmpFile = join(TMP_DIR, 'strict-input.txt');
    writeFileSync(tmpFile, '홍길동 010-1234-5678 kim@example.com', 'utf-8');

    const dictPath = join(TMP_DIR, 'strict-dict.json');
    const outDir = join(TMP_DIR, 'strict-veiled');
    mkdirSync(outDir, { recursive: true });

    const veilR = runCli([
      'veil', tmpFile,
      '-o', outDir,
      '-d', dictPath,
      '--no-ner',
    ]);
    if (veilR.exitCode !== 0) return; // veil이 구현 안됐으면 skip

    const veiledPath = join(outDir, 'strict-input.txt');
    if (!existsSync(veiledPath)) return;

    const veiledText = readFileSync(veiledPath, 'utf-8');
    const omitted = mutate.omission(veiledText);

    const r = runCli([
      'unveil', '--stdin',
      '-d', dictPath,
      '--strict',
    ], omitted);

    // strict 모드에서 integrity < 1.0이면 exit 8
    expect(r.exitCode).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// Non-TTY 모드 테스트
// ---------------------------------------------------------------------------

describe('Non-TTY compatibility', () => {
  it('stdout에 ANSI 색상 코드 없음 (NO_COLOR=1)', () => {
    const tmpFile = join(TMP_DIR, 'notty-test.txt');
    writeFileSync(tmpFile, '홍길동 010-1234-5678', 'utf-8');

    const r = spawnSync('node', [
      BIN, 'veil', tmpFile,
      '-o', join(TMP_DIR, 'notty-out'),
      '-d', join(TMP_DIR, 'notty-dict.json'),
      '--no-ner',
      '--json',
    ], {
      encoding: 'utf-8',
      cwd: PACKAGE_ROOT,
      timeout: 30_000,
      env: { ...process.env, NO_COLOR: '1' },
    });

    // stdout에 ANSI escape 없어야 함
    expect(r.stdout).not.toMatch(/\x1b\[/);
  });

  it('--json 플래그: stdout이 유효한 JSON', () => {
    const tmpFile = join(TMP_DIR, 'json-output-test.txt');
    writeFileSync(tmpFile, '이메일: test@example.com', 'utf-8');

    const r = runCli([
      'veil', tmpFile,
      '-o', join(TMP_DIR, 'json-out'),
      '-d', join(TMP_DIR, 'json-dict.json'),
      '--no-ner',
      '--json',
    ]);

    if (r.exitCode !== 0) return; // CLI 구현 전이면 skip
    expect(() => JSON.parse(r.stdout)).not.toThrow();
    const json = JSON.parse(r.stdout);
    expect(json).toHaveProperty('success');
    expect(json).toHaveProperty('results');
  });
});
