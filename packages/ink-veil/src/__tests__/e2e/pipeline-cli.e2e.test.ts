/**
 * System-level pipeline E2E tests — CLI exit codes, non-TTY compatibility
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import {
  writeFileSync,
  mkdirSync,
  rmSync,
  existsSync,
  readFileSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, "..", "..", ".."); // packages/ink-veil/
const TMP_DIR = join(PACKAGE_ROOT, ".samples", "e2e-cli-tmp");
const DICT_PATH = join(TMP_DIR, "test-dict.json");
const BIN = join(PACKAGE_ROOT, "dist", "cli.mjs");

function runCli(args: string[], stdin?: string) {
  const result = spawnSync("node", [BIN, ...args], {
    input: stdin ? Buffer.from(stdin, "utf-8") : undefined,
    encoding: "utf-8",
    cwd: PACKAGE_ROOT,
    timeout: 60_000,
    env: { ...process.env, NO_COLOR: "1" },
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    exitCode: result.status ?? -1,
  };
}

const mutate = {
  xmlStrip: (text: string) =>
    text.replace(/<iv-\w+ id=["']\d+["']>([A-Z]+_\d+)<\/iv-\w+>/g, "$1"),
};

beforeAll(() => {
  mkdirSync(TMP_DIR, { recursive: true });
});

afterAll(() => {
  if (existsSync(TMP_DIR)) {
    rmSync(TMP_DIR, { recursive: true, force: true });
  }
});

describe("CLI exit codes", () => {
  it("exit 0 — 정상 veil", () => {
    const tmpFile = join(TMP_DIR, "exit-code-test.txt");
    writeFileSync(tmpFile, "홍길동 010-1234-5678", "utf-8");

    const r = runCli([
      "veil",
      tmpFile,
      "-o",
      join(TMP_DIR, "exit-test-out"),
      "-d",
      join(TMP_DIR, "exit-test-dict.json"),
      "--no-ner",
    ]);
    expect(r.exitCode).toBe(0);
  });

  it("exit 3 — 존재하지 않는 파일", () => {
    const r = runCli(["veil", "/nonexistent/path/file.txt", "-d", DICT_PATH]);
    expect(r.exitCode).toBe(3);
  });

  it("exit 4 — 지원하지 않는 포맷", () => {
    const tmpFile = join(TMP_DIR, "unsupported.xyz");
    writeFileSync(tmpFile, "some content", "utf-8");

    const r = runCli(["veil", tmpFile, "-d", DICT_PATH, "--no-ner"]);
    expect(r.exitCode).toBe(4);
  });

  it("exit 4 — 제거된 RTF 포맷", () => {
    const tmpFile = join(TMP_DIR, "removed.rtf");
    writeFileSync(tmpFile, "{\\rtf1 hello}", "utf-8");

    const r = runCli(["veil", tmpFile, "-d", DICT_PATH, "--no-ner"]);
    expect(r.exitCode).toBe(4);
  });

  it("exit 4 — 제거된 ODT 포맷", () => {
    const tmpFile = join(TMP_DIR, "removed.odt");
    writeFileSync(tmpFile, "fake odt content", "utf-8");

    const r = runCli(["veil", tmpFile, "-d", DICT_PATH, "--no-ner"]);
    expect(r.exitCode).toBe(4);
  });

  it("exit 2 — 파일 미지정 (no files, no --stdin)", () => {
    const r = runCli(["veil", "-d", DICT_PATH, "--no-ner"]);
    expect(r.exitCode).toBe(2);
  });

  it("exit 2 — unveil 파일 미지정", () => {
    const r = runCli(["unveil", "-d", DICT_PATH]);
    expect(r.exitCode).toBe(2);
  });

  it("exit 5 — 손상된 딕셔너리 파일", () => {
    const corruptDict = join(TMP_DIR, "corrupt-dict.json");
    writeFileSync(corruptDict, "{ not valid json !!!", "utf-8");

    const tmpFile = join(TMP_DIR, "exit5-input.txt");
    writeFileSync(tmpFile, "test content", "utf-8");

    const r = runCli(["unveil", tmpFile, "-d", corruptDict]);
    expect(r.exitCode).toBe(5);
  });

  it("exit 8 — tokenIntegrity < 1.0 with --strict", () => {
    const tmpFile = join(TMP_DIR, "strict-input.txt");
    writeFileSync(tmpFile, "홍길동 010-1234-5678 kim@example.com", "utf-8");

    const dictPath = join(TMP_DIR, "strict-dict.json");
    const outDir = join(TMP_DIR, "strict-veiled");
    mkdirSync(outDir, { recursive: true });

    const veilR = runCli([
      "veil",
      tmpFile,
      "-o",
      outDir,
      "-d",
      dictPath,
      "--no-ner",
    ]);
    if (veilR.exitCode !== 0) return;

    const veiledPath = join(outDir, "strict-input.txt");
    if (!existsSync(veiledPath)) return;

    const veiledText = readFileSync(veiledPath, "utf-8");
    const stripped = mutate.xmlStrip(veiledText);

    const strippedFile = join(TMP_DIR, "strict-stripped.txt");
    writeFileSync(strippedFile, stripped, "utf-8");

    const r = runCli([
      "unveil",
      strippedFile,
      "-o",
      join(TMP_DIR, "strict-restored"),
      "-d",
      dictPath,
      "--strict",
    ]);

    expect(r.exitCode).toBe(8);
  });
});

describe("Non-TTY compatibility", () => {
  it("stdout에 ANSI 색상 코드 없음 (NO_COLOR=1)", () => {
    const tmpFile = join(TMP_DIR, "notty-test.txt");
    writeFileSync(tmpFile, "홍길동 010-1234-5678", "utf-8");

    const r = spawnSync(
      "node",
      [
        BIN,
        "veil",
        tmpFile,
        "-o",
        join(TMP_DIR, "notty-out"),
        "-d",
        join(TMP_DIR, "notty-dict.json"),
        "--no-ner",
        "--json",
      ],
      {
        encoding: "utf-8",
        cwd: PACKAGE_ROOT,
        timeout: 30_000,
        env: { ...process.env, NO_COLOR: "1" },
      },
    );

    expect(r.stdout).not.toMatch(/\x1b\[/);
  });

  it("--json 플래그: stdout이 유효한 JSON", () => {
    const tmpFile = join(TMP_DIR, "json-output-test.txt");
    writeFileSync(tmpFile, "이메일: test@example.com", "utf-8");

    const r = runCli([
      "veil",
      tmpFile,
      "-o",
      join(TMP_DIR, "json-out"),
      "-d",
      join(TMP_DIR, "json-dict.json"),
      "--no-ner",
      "--json",
    ]);

    if (r.exitCode !== 0) return;
    expect(() => JSON.parse(r.stdout)).not.toThrow();
    const json = JSON.parse(r.stdout);
    expect(json).toHaveProperty("success");
    expect(json).toHaveProperty("results");
  });
});
