import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// config 모듈을 동적으로 임포트하여 환경변수 격리
import { loadConfig, saveConfig, DEFAULT_CONFIG } from '../../config/loader.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const TMP = join(tmpdir(), `ink-veil-config-test-${process.pid}`);

function writeTmpConfig(content: unknown, filename = 'config.json'): string {
  mkdirSync(TMP, { recursive: true });
  const p = join(TMP, filename);
  writeFileSync(p, JSON.stringify(content), 'utf-8');
  return p;
}

beforeEach(() => {
  mkdirSync(TMP, { recursive: true });
  // 환경변수 초기화
  delete process.env['INK_VEIL_CONFIG'];
  delete process.env['INK_VEIL_TOKEN_MODE'];
  delete process.env['INK_VEIL_NER_MODEL'];
  delete process.env['INK_VEIL_NER_THRESHOLD'];
  delete process.env['INK_VEIL_NO_NER'];
  delete process.env['INK_VEIL_DICT_PATH'];
  delete process.env['INK_VEIL_OUTPUT_DIR'];
  delete process.env['INK_VEIL_ENCODING'];
});

afterEach(() => {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true, force: true });
  delete process.env['INK_VEIL_CONFIG'];
  delete process.env['INK_VEIL_TOKEN_MODE'];
  delete process.env['INK_VEIL_NER_MODEL'];
  delete process.env['INK_VEIL_NER_THRESHOLD'];
  delete process.env['INK_VEIL_NO_NER'];
  delete process.env['INK_VEIL_DICT_PATH'];
  delete process.env['INK_VEIL_OUTPUT_DIR'];
  delete process.env['INK_VEIL_ENCODING'];
});

// ---------------------------------------------------------------------------
// 1. 기본값 테스트
// ---------------------------------------------------------------------------

describe('defaults', () => {
  it('config 파일 없이도 기본값으로 동작', () => {
    const config = loadConfig({ configPath: join(TMP, 'nonexistent.json') });

    expect(config.tokenMode).toBe('tag');
    expect(config.signature).toBe(true);
    expect(config.ner.model).toBe('kiwi-base');
    expect(config.ner.threshold).toBe(0.2);
    expect(config.ner.enabled).toBe(true);
    expect(config.detection.priorityOrder).toEqual(['MANUAL', 'REGEX', 'NER']);
    expect(config.detection.categories).toEqual([]);
    expect(config.dictionary.defaultPath).toBe('./dictionary.json');
    expect(config.output.directory).toBe('./veiled/');
    expect(config.output.encoding).toBe('utf-8');
    expect(config.manualRules).toEqual([]);
  });

  it('DEFAULT_CONFIG가 모든 필수 필드를 포함', () => {
    expect(DEFAULT_CONFIG).toMatchObject({
      tokenMode: 'tag',
      signature: true,
      ner: { model: expect.any(String), threshold: expect.any(Number), enabled: true },
      detection: { priorityOrder: expect.any(Array), categories: expect.any(Array) },
      dictionary: { defaultPath: expect.any(String) },
      output: { directory: expect.any(String), encoding: expect.any(String) },
      manualRules: expect.any(Array),
    });
  });
});

// ---------------------------------------------------------------------------
// 2. 우선순위 테스트: CLI > env > config file > defaults
// ---------------------------------------------------------------------------

describe('priority order', () => {
  it('CLI 오버라이드가 config 파일보다 우선', () => {
    const configPath = writeTmpConfig({ tokenMode: 'bracket', ner: { threshold: 0.3 } });

    const config = loadConfig({
      configPath,
      tokenMode: 'plain',      // CLI override
      nerThreshold: 0.9,        // CLI override
    });

    expect(config.tokenMode).toBe('plain');       // CLI wins
    expect(config.ner.threshold).toBe(0.9);       // CLI wins
  });

  it('env var가 config 파일보다 우선', () => {
    const configPath = writeTmpConfig({ tokenMode: 'bracket' });
    process.env['INK_VEIL_TOKEN_MODE'] = 'plain';

    const config = loadConfig({ configPath });

    expect(config.tokenMode).toBe('plain');       // env wins over file
  });

  it('CLI 오버라이드가 env var보다 우선', () => {
    process.env['INK_VEIL_TOKEN_MODE'] = 'bracket';

    const config = loadConfig({
      configPath: join(TMP, 'nonexistent.json'),
      tokenMode: 'plain',                          // CLI wins
    });

    expect(config.tokenMode).toBe('plain');
  });

  it('config 파일 값이 기본값보다 우선', () => {
    const configPath = writeTmpConfig({
      tokenMode: 'bracket',
      ner: { threshold: 0.7 },
    });

    const config = loadConfig({ configPath });

    expect(config.tokenMode).toBe('bracket');     // file > defaults
    expect(config.ner.threshold).toBe(0.7);       // file > defaults
    // 명시하지 않은 값은 기본값 유지
    expect(config.ner.model).toBe('kiwi-base');
    expect(config.ner.enabled).toBe(true);
  });

  it('noNer CLI 플래그가 ner.enabled를 false로 설정', () => {
    const config = loadConfig({
      configPath: join(TMP, 'nonexistent.json'),
      noNer: true,
    });
    expect(config.ner.enabled).toBe(false);
  });

  it('INK_VEIL_NO_NER=1 환경변수가 ner.enabled를 false로 설정', () => {
    process.env['INK_VEIL_NO_NER'] = '1';

    const config = loadConfig({ configPath: join(TMP, 'nonexistent.json') });

    expect(config.ner.enabled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. 잘못된 config 파일 — fallback 테스트
// ---------------------------------------------------------------------------

describe('invalid config fallback', () => {
  it('잘못된 JSON: 파싱 오류 → 기본값으로 폴백, stderr 경고', () => {
    const configPath = join(TMP, 'bad.json');
    writeFileSync(configPath, 'not valid json!!!', 'utf-8');

    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const config = loadConfig({ configPath });

    expect(config.tokenMode).toBe('tag');          // fallback to defaults
    expect(stderrSpy).toHaveBeenCalled();
    expect(stderrSpy.mock.calls.join('')).toContain('failed to read config file');

    stderrSpy.mockRestore();
  });

  it('스키마 위반 (tokenMode에 잘못된 값): 경고 후 유효한 필드는 적용', () => {
    const configPath = writeTmpConfig({
      tokenMode: 'invalid-mode',   // 스키마 위반
      ner: { threshold: 0.8 },     // 유효한 값
    });

    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    loadConfig({ configPath });

    // 스키마 오류 경고 출력
    expect(stderrSpy).toHaveBeenCalled();
    expect(stderrSpy.mock.calls.join('')).toContain('config file invalid');

    stderrSpy.mockRestore();
  });

  it('잘못된 config가 있어도 프로세스가 종료되지 않음 (no fatal error)', () => {
    const configPath = writeTmpConfig({ tokenMode: 99999 });  // 타입 위반

    // 예외가 발생하지 않아야 함
    expect(() => loadConfig({ configPath })).not.toThrow();
  });

  it('비어 있는 config 파일: 모든 기본값 사용', () => {
    const configPath = writeTmpConfig({});

    const config = loadConfig({ configPath });

    expect(config.tokenMode).toBe('tag');
    expect(config.ner.threshold).toBe(0.2);
    expect(config.manualRules).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 4. 환경변수 테스트
// ---------------------------------------------------------------------------

describe('environment variables', () => {
  it('INK_VEIL_TOKEN_MODE', () => {
    process.env['INK_VEIL_TOKEN_MODE'] = 'bracket';
    const config = loadConfig({ configPath: join(TMP, 'nonexistent.json') });
    expect(config.tokenMode).toBe('bracket');
  });

  it('INK_VEIL_NER_MODEL', () => {
    process.env['INK_VEIL_NER_MODEL'] = 'kiwi-base';
    const config = loadConfig({ configPath: join(TMP, 'nonexistent.json') });
    expect(config.ner.model).toBe('kiwi-base');
  });

  it('INK_VEIL_NER_THRESHOLD — 유효한 숫자', () => {
    process.env['INK_VEIL_NER_THRESHOLD'] = '0.75';
    const config = loadConfig({ configPath: join(TMP, 'nonexistent.json') });
    expect(config.ner.threshold).toBe(0.75);
  });

  it('INK_VEIL_NER_THRESHOLD — 잘못된 숫자는 무시', () => {
    process.env['INK_VEIL_NER_THRESHOLD'] = 'abc';
    const config = loadConfig({ configPath: join(TMP, 'nonexistent.json') });
    expect(config.ner.threshold).toBe(0.2);   // default preserved
  });

  it('INK_VEIL_DICT_PATH', () => {
    process.env['INK_VEIL_DICT_PATH'] = '/custom/dict.json';
    const config = loadConfig({ configPath: join(TMP, 'nonexistent.json') });
    expect(config.dictionary.defaultPath).toBe('/custom/dict.json');
  });

  it('INK_VEIL_OUTPUT_DIR', () => {
    process.env['INK_VEIL_OUTPUT_DIR'] = '/custom/output/';
    const config = loadConfig({ configPath: join(TMP, 'nonexistent.json') });
    expect(config.output.directory).toBe('/custom/output/');
  });

  it('INK_VEIL_ENCODING', () => {
    process.env['INK_VEIL_ENCODING'] = 'euc-kr';
    const config = loadConfig({ configPath: join(TMP, 'nonexistent.json') });
    expect(config.output.encoding).toBe('euc-kr');
  });
});

// ---------------------------------------------------------------------------
// 5. saveConfig 테스트
// ---------------------------------------------------------------------------

describe('saveConfig', () => {
  it('config를 파일에 저장하고 다시 로드하면 동일한 값', () => {
    const configPath = join(TMP, 'saved-config.json');
    const modified = {
      ...DEFAULT_CONFIG,
      tokenMode: 'bracket' as const,
      ner: { ...DEFAULT_CONFIG.ner, threshold: 0.8 },
    };

    saveConfig(modified, configPath);
    expect(existsSync(configPath)).toBe(true);

    const loaded = loadConfig({ configPath });
    expect(loaded.tokenMode).toBe('bracket');
    expect(loaded.ner.threshold).toBe(0.8);
  });

  it('부모 디렉토리가 없어도 자동 생성', () => {
    const configPath = join(TMP, 'nested', 'deep', 'config.json');

    expect(() => saveConfig(DEFAULT_CONFIG, configPath)).not.toThrow();
    expect(existsSync(configPath)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. manualRules 테스트
// ---------------------------------------------------------------------------

describe('manualRules', () => {
  it('config 파일의 manualRules 로드', () => {
    const configPath = writeTmpConfig({
      manualRules: [
        { pattern: 'Project-Alpha', category: 'PROJECT' },
        { pattern: 'INV-\\d{8}', category: 'INVOICE', isRegex: true },
      ],
    });

    const config = loadConfig({ configPath });

    expect(config.manualRules).toHaveLength(2);
    expect(config.manualRules[0]).toMatchObject({ pattern: 'Project-Alpha', category: 'PROJECT', isRegex: false });
    expect(config.manualRules[1]).toMatchObject({ pattern: 'INV-\\d{8}', category: 'INVOICE', isRegex: true });
  });
});
