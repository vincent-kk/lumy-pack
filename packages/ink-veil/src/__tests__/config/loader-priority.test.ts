import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { loadConfig } from '../../config/loader.js';

const TMP = join(tmpdir(), `ink-veil-config-priority-test-${process.pid}`);

function writeTmpConfig(content: unknown, filename = 'config.json'): string {
  mkdirSync(TMP, { recursive: true });
  const p = join(TMP, filename);
  writeFileSync(p, JSON.stringify(content), 'utf-8');
  return p;
}

beforeEach(() => {
  mkdirSync(TMP, { recursive: true });
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

describe('priority order', () => {
  it('CLI 오버라이드가 config 파일보다 우선', () => {
    const configPath = writeTmpConfig({ tokenMode: 'bracket', ner: { threshold: 0.3 } });

    const config = loadConfig({
      configPath,
      tokenMode: 'plain',
      nerThreshold: 0.9,
    });

    expect(config.tokenMode).toBe('plain');
    expect(config.ner.threshold).toBe(0.9);
  });

  it('env var가 config 파일보다 우선', () => {
    const configPath = writeTmpConfig({ tokenMode: 'bracket' });
    process.env['INK_VEIL_TOKEN_MODE'] = 'plain';

    const config = loadConfig({ configPath });

    expect(config.tokenMode).toBe('plain');
  });

  it('CLI 오버라이드가 env var보다 우선', () => {
    process.env['INK_VEIL_TOKEN_MODE'] = 'bracket';

    const config = loadConfig({
      configPath: join(TMP, 'nonexistent.json'),
      tokenMode: 'plain',
    });

    expect(config.tokenMode).toBe('plain');
  });

  it('config 파일 값이 기본값보다 우선', () => {
    const configPath = writeTmpConfig({
      tokenMode: 'bracket',
      ner: { threshold: 0.7 },
    });

    const config = loadConfig({ configPath });

    expect(config.tokenMode).toBe('bracket');
    expect(config.ner.threshold).toBe(0.7);
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

describe('invalid config fallback', () => {
  it('잘못된 JSON: 파싱 오류 → 기본값으로 폴백, stderr 경고', () => {
    const configPath = join(TMP, 'bad.json');
    writeFileSync(configPath, 'not valid json!!!', 'utf-8');

    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const config = loadConfig({ configPath });

    expect(config.tokenMode).toBe('tag');
    expect(stderrSpy).toHaveBeenCalled();
    expect(stderrSpy.mock.calls.join('')).toContain('failed to read config file');

    stderrSpy.mockRestore();
  });

  it('스키마 위반 (tokenMode에 잘못된 값): 경고 후 유효한 필드는 적용', () => {
    const configPath = writeTmpConfig({
      tokenMode: 'invalid-mode',
      ner: { threshold: 0.8 },
    });

    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    loadConfig({ configPath });

    expect(stderrSpy).toHaveBeenCalled();
    expect(stderrSpy.mock.calls.join('')).toContain('config file invalid');

    stderrSpy.mockRestore();
  });

  it('잘못된 config가 있어도 프로세스가 종료되지 않음 (no fatal error)', () => {
    const configPath = writeTmpConfig({ tokenMode: 99999 });

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
    expect(config.ner.threshold).toBe(0.2);
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
