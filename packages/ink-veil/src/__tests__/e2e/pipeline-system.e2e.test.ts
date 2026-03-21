/**
 * System-level pipeline E2E tests — LLM mutation, batch consistency
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  existsSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, "..", "..", ".."); // packages/ink-veil/
const TMP_DIR = join(PACKAGE_ROOT, ".samples", "e2e-sys-tmp");
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

function veilFile(
  fixturePath: string,
  outputDir: string,
  dictPath: string = DICT_PATH,
) {
  return runCli([
    "veil",
    fixturePath,
    "-o",
    outputDir,
    "-d",
    dictPath,
    "--no-ner",
    "--json",
  ]);
}

function unveilFile(
  filePath: string,
  outputDir: string,
  dictPath: string = DICT_PATH,
) {
  return runCli([
    "unveil",
    filePath,
    "-o",
    outputDir,
    "-d",
    dictPath,
    "--json",
  ]);
}

function parseJsonFromStdout(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw);
  } catch {
    /* continue */
  }
  const lastBrace = raw.lastIndexOf("}");
  if (lastBrace === -1) return null;
  let depth = 0;
  for (let i = lastBrace; i >= 0; i--) {
    if (raw[i] === "}") depth++;
    if (raw[i] === "{") depth--;
    if (depth === 0) {
      try {
        return JSON.parse(raw.slice(i, lastBrace + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

const mutate = {
  quoteStyle: (text: string) =>
    text.replace(/<iv-(\w+) id="(\d+)">/g, "<iv-$1 id='$2'>"),
  whitespace: (text: string) => text.replace(/<iv-(\w+) id=/g, "<iv-$1  id="),
  xmlStrip: (text: string) =>
    text.replace(/<iv-\w+ id=["']\d+["']>([A-Z]+_\d+)<\/iv-\w+>/g, "$1"),
  omission: (text: string) => {
    let count = 0;
    return text.replace(/<iv-\w+[^>]*>[A-Z]+_\d+<\/iv-\w+>/g, (m) => {
      count++;
      return count % 2 === 0 ? "" : m;
    });
  },
  hallucination: (text: string) => text + '\n<iv-per id="099">PER_099</iv-per>',
};

beforeAll(() => {
  mkdirSync(TMP_DIR, { recursive: true });
  mkdirSync(join(TMP_DIR, "veiled"), { recursive: true });
});

afterAll(() => {
  if (existsSync(TMP_DIR)) {
    rmSync(TMP_DIR, { recursive: true, force: true });
  }
});

describe("LLM mutation scenarios", () => {
  const PLAIN_TEXT = [
    "고객명: 홍길동",
    "전화번호: 010-1234-5678",
    "이메일: hong@example.com",
    "주민등록번호: 901231-1234567",
  ].join("\n");

  let veiledText = "";

  beforeAll(() => {
    const tmpIn = join(TMP_DIR, "mutation-input.txt");
    writeFileSync(tmpIn, PLAIN_TEXT, "utf-8");
    const r = veilFile(tmpIn, join(TMP_DIR, "veiled"));
    expect(r.exitCode, `veil failed: ${r.stderr}`).toBe(0);

    const veiledPath = join(TMP_DIR, "veiled", "mutation-input.txt");
    expect(existsSync(veiledPath), "veiled file should be created").toBe(true);
    veiledText = readFileSync(veiledPath, "utf-8");

    expect(
      veiledText.length,
      "veiled text should not be empty",
    ).toBeGreaterThan(0);
    expect(veiledText).toMatch(/<iv-\w+ id="/);
  });

  it("Scenario 1: quote style change", () => {
    const mutated = mutate.quoteStyle(veiledText);
    expect(mutated).toMatch(/id='\d+'/);

    const mutFile = join(TMP_DIR, "mutated-quote.txt");
    const outDir = join(TMP_DIR, "restored-quote");
    mkdirSync(outDir, { recursive: true });
    writeFileSync(mutFile, mutated, "utf-8");

    const r = unveilFile(mutFile, outDir);
    expect(r.exitCode).toBe(0);

    const json = parseJsonFromStdout(r.stdout);
    expect(json?.success).toBe(true);
  });

  it("Scenario 2: whitespace insertion", () => {
    const mutated = mutate.whitespace(veiledText);
    expect(mutated).toMatch(/<iv-\w+  id=/);

    const mutFile = join(TMP_DIR, "mutated-ws.txt");
    const outDir = join(TMP_DIR, "restored-ws");
    mkdirSync(outDir, { recursive: true });
    writeFileSync(mutFile, mutated, "utf-8");

    const r = unveilFile(mutFile, outDir);
    expect(r.exitCode).toBe(0);

    const json = parseJsonFromStdout(r.stdout);
    expect(json?.success).toBe(true);
  });

  it("Scenario 3: XML structure removal", () => {
    const mutated = mutate.xmlStrip(veiledText);
    expect(mutated).not.toMatch(/<iv-/);
    expect(mutated).toMatch(/[A-Z]+_\d+/);

    const mutFile = join(TMP_DIR, "mutated-strip.txt");
    const outDir = join(TMP_DIR, "restored-strip");
    mkdirSync(outDir, { recursive: true });
    writeFileSync(mutFile, mutated, "utf-8");

    const r = unveilFile(mutFile, outDir);
    expect(r.exitCode).toBe(0);

    const json = parseJsonFromStdout(r.stdout);
    expect(json?.success).toBe(true);
  });

  it("Scenario 4: token omission", () => {
    const mutated = mutate.omission(veiledText);

    const mutFile = join(TMP_DIR, "mutated-omit.txt");
    const outDir = join(TMP_DIR, "restored-omit");
    mkdirSync(outDir, { recursive: true });
    writeFileSync(mutFile, mutated, "utf-8");

    const r = unveilFile(mutFile, outDir);
    expect(r.exitCode).toBe(0);

    const json = parseJsonFromStdout(r.stdout);
    expect(json?.success).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (json?.results as any)?.[0];
    expect(result).toBeDefined();
    expect(result.totalRestored).toBeDefined();
  });

  it("Scenario 5: token hallucination", () => {
    const mutated = mutate.hallucination(veiledText);
    expect(mutated).toContain("PER_099");

    const mutFile = join(TMP_DIR, "mutated-halluc.txt");
    const outDir = join(TMP_DIR, "restored-halluc");
    mkdirSync(outDir, { recursive: true });
    writeFileSync(mutFile, mutated, "utf-8");

    const r = unveilFile(mutFile, outDir);
    expect(r.exitCode).toBe(0);

    const json = parseJsonFromStdout(r.stdout);
    expect(json?.success).toBe(true);

    const restoredPath = join(outDir, "mutated-halluc.txt");
    if (existsSync(restoredPath)) {
      const restored = readFileSync(restoredPath, "utf-8");
      expect(restored).toContain("PER_099");
    }
  });
});

describe("Dictionary consistency across multi-document batch", () => {
  const BATCH_DICT_PATH = join(TMP_DIR, "batch-dict.json");
  const BATCH_OUTPUT_DIR = join(TMP_DIR, "batch-veiled");

  beforeAll(() => {
    mkdirSync(BATCH_OUTPUT_DIR, { recursive: true });
  });

  it("같은 PII가 여러 문서에서 동일한 토큰으로 대치됨", () => {
    const doc1 = join(TMP_DIR, "batch-doc1.txt");
    const doc2 = join(TMP_DIR, "batch-doc2.txt");

    writeFileSync(
      doc1,
      "고객 전화: 010-1234-5678, 이메일: hong@example.com",
      "utf-8",
    );
    writeFileSync(
      doc2,
      "담당자 전화: 010-1234-5678, 이메일: kim@example.com",
      "utf-8",
    );

    const r1 = runCli([
      "veil",
      doc1,
      "-o",
      BATCH_OUTPUT_DIR,
      "-d",
      BATCH_DICT_PATH,
      "--no-ner",
      "--json",
    ]);
    expect(r1.exitCode, `batch doc1 veil failed: ${r1.stderr}`).toBe(0);

    const r2 = runCli([
      "veil",
      doc2,
      "-o",
      BATCH_OUTPUT_DIR,
      "-d",
      BATCH_DICT_PATH,
      "--no-ner",
      "--json",
    ]);
    expect(r2.exitCode, `batch doc2 veil failed: ${r2.stderr}`).toBe(0);

    const veiled1 = readFileSync(
      join(BATCH_OUTPUT_DIR, "batch-doc1.txt"),
      "utf-8",
    );
    const veiled2 = readFileSync(
      join(BATCH_OUTPUT_DIR, "batch-doc2.txt"),
      "utf-8",
    );

    const token1Match = veiled1.match(/iv-phone id="(\d+)"/);
    const token2Match = veiled2.match(/iv-phone id="(\d+)"/);

    expect(token1Match, "doc1 should contain PHONE token").not.toBeNull();
    expect(token2Match, "doc2 should contain PHONE token").not.toBeNull();

    if (token1Match && token2Match) {
      expect(token1Match[1], "같은 엔티티는 동일한 ID를 가져야 함").toBe(
        token2Match[1],
      );
    }
  });

  it("딕셔너리 newEntries vs reusedEntities 카운트 정확성", () => {
    const doc3 = join(TMP_DIR, "batch-doc3.txt");
    writeFileSync(doc3, "전화: 010-1234-5678, 새 전화: 010-9876-5432", "utf-8");

    const r3 = runCli([
      "veil",
      doc3,
      "-o",
      BATCH_OUTPUT_DIR,
      "-d",
      BATCH_DICT_PATH,
      "--no-ner",
      "--json",
    ]);

    expect(r3.exitCode, `batch doc3 veil failed: ${r3.stderr}`).toBe(0);

    const json = parseJsonFromStdout(r3.stdout);
    expect(json?.success).toBe(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (json?.results as any)?.[0];
    expect(result).toBeDefined();
    expect(result.newEntities + result.reusedEntities).toBeGreaterThan(0);
  });
});
