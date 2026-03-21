import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { loadConfig, saveConfig, DEFAULT_CONFIG } from "../../config/loader.js";

const TMP = join(tmpdir(), `ink-veil-config-test-${process.pid}`);

function writeTmpConfig(content: unknown, filename = "config.json"): string {
  mkdirSync(TMP, { recursive: true });
  const p = join(TMP, filename);
  writeFileSync(p, JSON.stringify(content), "utf-8");
  return p;
}

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

describe("defaults", () => {
  it("config 파일 없이도 기본값으로 동작", () => {
    const config = loadConfig({ configPath: join(TMP, "nonexistent.json") });

    expect(config.tokenMode).toBe("tag");
    expect(config.signature).toBe(true);
    expect(config.ner.model).toBe("kiwi-base");
    expect(config.ner.threshold).toBe(0.2);
    expect(config.ner.enabled).toBe(true);
    expect(config.detection.priorityOrder).toEqual(["MANUAL", "REGEX", "NER"]);
    expect(config.detection.categories).toEqual([]);
    expect(config.dictionary.defaultPath).toBe("./dictionary.json");
    expect(config.output.directory).toBe("./veiled/");
    expect(config.output.encoding).toBe("utf-8");
    expect(config.manualRules).toEqual([]);
  });

  it("DEFAULT_CONFIG가 모든 필수 필드를 포함", () => {
    expect(DEFAULT_CONFIG).toMatchObject({
      tokenMode: "tag",
      signature: true,
      ner: {
        model: expect.any(String),
        threshold: expect.any(Number),
        enabled: true,
      },
      detection: {
        priorityOrder: expect.any(Array),
        categories: expect.any(Array),
      },
      dictionary: { defaultPath: expect.any(String) },
      output: { directory: expect.any(String), encoding: expect.any(String) },
      manualRules: expect.any(Array),
    });
  });
});

describe("saveConfig", () => {
  it("config를 파일에 저장하고 다시 로드하면 동일한 값", () => {
    const configPath = join(TMP, "saved-config.json");
    const modified = {
      ...DEFAULT_CONFIG,
      tokenMode: "bracket" as const,
      ner: { ...DEFAULT_CONFIG.ner, threshold: 0.8 },
    };

    saveConfig(modified, configPath);
    expect(existsSync(configPath)).toBe(true);

    const loaded = loadConfig({ configPath });
    expect(loaded.tokenMode).toBe("bracket");
    expect(loaded.ner.threshold).toBe(0.8);
  });

  it("부모 디렉토리가 없어도 자동 생성", () => {
    const configPath = join(TMP, "nested", "deep", "config.json");

    expect(() => saveConfig(DEFAULT_CONFIG, configPath)).not.toThrow();
    expect(existsSync(configPath)).toBe(true);
  });
});

describe("manualRules", () => {
  it("config 파일의 manualRules 로드", () => {
    const configPath = writeTmpConfig({
      manualRules: [
        { pattern: "Project-Alpha", category: "PROJECT" },
        { pattern: "INV-\\d{8}", category: "INVOICE", isRegex: true },
      ],
    });

    const config = loadConfig({ configPath });

    expect(config.manualRules).toHaveLength(2);
    expect(config.manualRules[0]).toMatchObject({
      pattern: "Project-Alpha",
      category: "PROJECT",
      isRegex: false,
    });
    expect(config.manualRules[1]).toMatchObject({
      pattern: "INV-\\d{8}",
      category: "INVOICE",
      isRegex: true,
    });
  });
});
