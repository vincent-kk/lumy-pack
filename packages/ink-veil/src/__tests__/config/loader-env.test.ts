import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { loadConfig } from "../../config/loader.js";

const TMP = join(tmpdir(), `ink-veil-config-env-test-${process.pid}`);

beforeEach(() => {
  mkdirSync(TMP, { recursive: true });
  delete process.env["INK_VEIL_CONFIG"];
  delete process.env["INK_VEIL_TOKEN_MODE"];
  delete process.env["INK_VEIL_NER_MODEL"];
  delete process.env["INK_VEIL_NER_THRESHOLD"];
  delete process.env["INK_VEIL_NO_NER"];
  delete process.env["INK_VEIL_DICT_PATH"];
  delete process.env["INK_VEIL_OUTPUT_DIR"];
  delete process.env["INK_VEIL_ENCODING"];
});

afterEach(() => {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true, force: true });
  delete process.env["INK_VEIL_CONFIG"];
  delete process.env["INK_VEIL_TOKEN_MODE"];
  delete process.env["INK_VEIL_NER_MODEL"];
  delete process.env["INK_VEIL_NER_THRESHOLD"];
  delete process.env["INK_VEIL_NO_NER"];
  delete process.env["INK_VEIL_DICT_PATH"];
  delete process.env["INK_VEIL_OUTPUT_DIR"];
  delete process.env["INK_VEIL_ENCODING"];
});

describe("environment variables", () => {
  it("INK_VEIL_TOKEN_MODE", () => {
    process.env["INK_VEIL_TOKEN_MODE"] = "bracket";
    const config = loadConfig({ configPath: join(TMP, "nonexistent.json") });
    expect(config.tokenMode).toBe("bracket");
  });

  it("INK_VEIL_NER_MODEL", () => {
    process.env["INK_VEIL_NER_MODEL"] = "kiwi-base";
    const config = loadConfig({ configPath: join(TMP, "nonexistent.json") });
    expect(config.ner.model).toBe("kiwi-base");
  });

  it("INK_VEIL_NER_THRESHOLD — 유효한 숫자", () => {
    process.env["INK_VEIL_NER_THRESHOLD"] = "0.75";
    const config = loadConfig({ configPath: join(TMP, "nonexistent.json") });
    expect(config.ner.threshold).toBe(0.75);
  });

  it("INK_VEIL_NER_THRESHOLD — 잘못된 숫자는 무시", () => {
    process.env["INK_VEIL_NER_THRESHOLD"] = "abc";
    const config = loadConfig({ configPath: join(TMP, "nonexistent.json") });
    expect(config.ner.threshold).toBe(0.2);
  });

  it("INK_VEIL_DICT_PATH", () => {
    process.env["INK_VEIL_DICT_PATH"] = "/custom/dict.json";
    const config = loadConfig({ configPath: join(TMP, "nonexistent.json") });
    expect(config.dictionary.defaultPath).toBe("/custom/dict.json");
  });

  it("INK_VEIL_OUTPUT_DIR", () => {
    process.env["INK_VEIL_OUTPUT_DIR"] = "/custom/output/";
    const config = loadConfig({ configPath: join(TMP, "nonexistent.json") });
    expect(config.output.directory).toBe("/custom/output/");
  });

  it("INK_VEIL_ENCODING", () => {
    process.env["INK_VEIL_ENCODING"] = "euc-kr";
    const config = loadConfig({ configPath: join(TMP, "nonexistent.json") });
    expect(config.output.encoding).toBe("euc-kr");
  });
});
