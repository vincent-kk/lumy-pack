#!/usr/bin/env node
/**
 * ink-veil CLI E2E test runner
 *
 * 각 픽스처 파일에 대해:
 *   1. veil (--no-ner, regex only)
 *   2. LLM mutation 시뮬레이션 (5가지 변형)
 *   3. unveil 및 tokenIntegrity 집계
 *   4. 결과를 .samples/test-results/ 에 저장
 *
 * 사용법:
 *   node .samples/run-tests.mjs [--bin <path>]
 *
 * 예시:
 *   node .samples/run-tests.mjs
 *   node .samples/run-tests.mjs --bin ./node_modules/.bin/ink-veil
 */

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const FIXTURES_DIR = join(__dirname, "fixtures");
const RESULTS_DIR = join(__dirname, "test-results");
const DICT_PATH = join(RESULTS_DIR, "e2e-dict.json");

// CLI bin 경로 결정
const args = process.argv.slice(2);
const binIdx = args.indexOf("--bin");
const INK_VEIL_BIN =
  binIdx !== -1 ? args[binIdx + 1] : join(ROOT, "dist", "cli.mjs");

/** LLM mutation 시뮬레이션 함수들 */
const mutations = {
  /** Mutation 1: id="001" -> id='001' (quote style change) */
  quoteStyleChange(text) {
    return text.replace(/<iv-(\w+) id="(\d+)">/g, "<iv-$1 id='$2'>");
  },

  /** Mutation 2: <iv-per id="001"> -> <iv-per  id="001"> (extra whitespace) */
  whitespaceInsertion(text) {
    return text.replace(/<iv-(\w+) id=/g, "<iv-$1  id=");
  },

  /** Mutation 3: <iv-per id="001">PER_001</iv-per> -> PER_001 (XML structure removal) */
  xmlStructureRemoval(text) {
    return text.replace(/<iv-\w+ id=["']\d+["']>([A-Z]+_\d+)<\/iv-\w+>/g, "$1");
  },

  /** Mutation 4: 일부 토큰 삭제 (token omission) */
  tokenOmission(text) {
    let count = 0;
    return text.replace(/<iv-\w+[^>]*>[A-Z]+_\d+<\/iv-\w+>/g, (match) => {
      count++;
      // 짝수 번째 토큰만 삭제
      return count % 2 === 0 ? "" : match;
    });
  },

  /** Mutation 5: 존재하지 않는 PER_099 삽입 (token hallucination) */
  tokenHallucination(text) {
    return (
      text +
      '\n\n[참고: <iv-per id="099">PER_099</iv-per>와도 관련이 있습니다.]'
    );
  },

  /** No mutation (clean round-trip baseline) */
  none(text) {
    return text;
  },
};

function runCli(args, input) {
  const result = spawnSync("node", [INK_VEIL_BIN, ...args], {
    input: input ? Buffer.from(input, "utf-8") : undefined,
    encoding: "utf-8",
    cwd: ROOT,
    timeout: 30_000,
  });
  return {
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    exitCode: result.status ?? -1,
  };
}

function veilFile(fixturePath, outputPath) {
  return runCli([
    "veil",
    fixturePath,
    "-o",
    dirname(outputPath),
    "-d",
    DICT_PATH,
    "--no-ner",
    "--json",
  ]);
}

function unveilFile(filePath, outputDir) {
  mkdirSync(outputDir, { recursive: true });
  return runCli([
    "unveil",
    filePath,
    "-o",
    outputDir,
    "-d",
    DICT_PATH,
    "--json",
  ]);
}

function formatResult(fixture, mutation, veilResult, unveilResult) {
  let veilData = null;
  let unveilData = null;

  try {
    veilData = JSON.parse(veilResult.stdout);
  } catch {
    /* ignore */
  }
  try {
    unveilData = JSON.parse(unveilResult.stdout);
  } catch {
    /* ignore */
  }

  return {
    fixture: basename(fixture),
    mutation,
    veil: {
      exitCode: veilResult.exitCode,
      success: veilData?.success ?? false,
      entitiesFound: veilData?.results?.[0]?.entitiesFound ?? 0,
      stderr: veilResult.stderr.slice(0, 200),
    },
    unveil: {
      exitCode: unveilResult.exitCode,
      success: unveilData?.success ?? false,
      tokenIntegrity: unveilData?.results?.[0]?.tokenIntegrity ?? null,
      substitutions: unveilData?.results?.[0]?.substitutions ?? 0,
      stderr: unveilResult.stderr.slice(0, 200),
    },
  };
}

async function main() {
  console.log("ink-veil E2E CLI test runner");
  console.log("============================");
  console.log(`bin: ${INK_VEIL_BIN}`);
  console.log(`dict: ${DICT_PATH}`);
  console.log("");

  mkdirSync(RESULTS_DIR, { recursive: true });

  // 딕셔너리 초기화
  if (existsSync(DICT_PATH)) {
    console.log("기존 딕셔너리 삭제 후 재생성...");
  }

  const fixtures = [
    join(FIXTURES_DIR, "korean-pii.txt"),
    join(FIXTURES_DIR, "mixed-data.csv"),
    join(FIXTURES_DIR, "config-data.json"),
    join(FIXTURES_DIR, "structured.xml"),
    join(FIXTURES_DIR, "settings.yaml"),
    join(FIXTURES_DIR, "README.md"),
    join(FIXTURES_DIR, "data.tsv"),
  ];

  const mutationNames = Object.keys(mutations);
  const allResults = [];
  let totalPass = 0;
  let totalFail = 0;

  for (const fixture of fixtures) {
    if (!existsSync(fixture)) {
      console.warn(`  SKIP (not found): ${basename(fixture)}`);
      continue;
    }

    console.log(`\n[${basename(fixture)}]`);

    // 1. Veil 수행
    const veiledOutputDir = join(RESULTS_DIR, "veiled");
    mkdirSync(veiledOutputDir, { recursive: true });
    const veiledPath = join(veiledOutputDir, basename(fixture));

    const veilResult = veilFile(fixture, veiledPath);

    if (veilResult.exitCode !== 0) {
      console.log(
        `  VEIL FAIL (exit ${veilResult.exitCode}): ${veilResult.stderr.slice(0, 100)}`,
      );
      allResults.push({
        fixture: basename(fixture),
        mutation: "veil_step",
        veilFailed: true,
      });
      totalFail++;
      continue;
    }

    // veiled 텍스트 읽기
    let veiledText;
    try {
      veiledText = readFileSync(veiledPath, "utf-8");
    } catch {
      // veil이 stdout으로 출력했을 수도 있음
      try {
        const veilJson = JSON.parse(veilResult.stdout);
        veiledText = veilJson?.results?.[0]?.veiledText || "";
      } catch {
        veiledText = "";
      }
    }

    if (!veiledText) {
      console.log(`  VEIL: 출력 없음 (exit ${veilResult.exitCode})`);
    } else {
      console.log(`  VEIL: OK (exit 0)`);
    }

    // 2. 각 mutation 시뮬레이션 후 unveil
    for (const mutName of mutationNames) {
      const mutFn = mutations[mutName];
      const mutatedText = veiledText ? mutFn(veiledText) : "";

      // mutation 텍스트를 파일로 저장 후 file-based unveil
      const mutDir = join(RESULTS_DIR, "mutated");
      mkdirSync(mutDir, { recursive: true });
      const mutFile = join(mutDir, `${basename(fixture, extname(fixture))}-${mutName}${extname(fixture)}`);
      writeFileSync(mutFile, mutatedText, "utf-8");

      const restoreDir = join(RESULTS_DIR, "restored", mutName);
      const unveilResult = unveilFile(mutFile, restoreDir);
      const result = formatResult(fixture, mutName, veilResult, unveilResult);
      allResults.push(result);

      const integrity = result.unveil.tokenIntegrity;
      const intStr =
        integrity !== null
          ? `integrity=${integrity.toFixed(2)}`
          : "integrity=N/A";
      const status =
        unveilResult.exitCode === 0 || unveilResult.exitCode === 8
          ? "OK"
          : "FAIL";

      if (status === "OK") totalPass++;
      else totalFail++;

      console.log(
        `  [${mutName.padEnd(20)}] ${status} ${intStr} substitutions=${result.unveil.substitutions}`,
      );
    }
  }

  // 결과 저장
  const report = {
    timestamp: new Date().toISOString(),
    bin: INK_VEIL_BIN,
    summary: {
      total: totalPass + totalFail,
      pass: totalPass,
      fail: totalFail,
    },
    results: allResults,
  };

  const reportPath = join(RESULTS_DIR, "report.json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");

  console.log("\n============================");
  console.log(`결과: ${totalPass} pass / ${totalFail} fail`);
  console.log(`리포트: ${reportPath}`);

  process.exit(totalFail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("E2E runner 오류:", err);
  process.exit(1);
});
