#!/usr/bin/env node
/**
 * scene-sieve 파라미터 테스트 러너
 * 다양한 설정값 조합으로 extractScenes API를 실행하고 결과를 수집합니다.
 */
import { extractScenes } from '../dist/index.mjs';
import { mkdirSync, writeFileSync, readdirSync, statSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLES_DIR = __dirname;
const MOV = join(SAMPLES_DIR, 'screenRecord1.mov');
const GIF = join(SAMPLES_DIR, 'screenRecord2.gif');
const RESULTS_DIR = join(SAMPLES_DIR, 'test-results');

// Clean and create results dir
try { rmSync(RESULTS_DIR, { recursive: true }); } catch {}
mkdirSync(RESULTS_DIR, { recursive: true });

/** @type {Array<{id: string, category: string, input: string, opts: Record<string, any>, description: string}>} */
const TEST_CASES = [
  // === 1. Baseline ===
  { id: 'B1', category: 'Baseline', input: MOV, opts: {}, description: 'MOV 기본값' },
  { id: 'B2', category: 'Baseline', input: GIF, opts: {}, description: 'GIF 기본값' },

  // === 2. count 변화 (count-only 모드) ===
  { id: 'C1', category: 'Count', input: MOV, opts: { count: 3 }, description: 'count=3 극소' },
  { id: 'C2', category: 'Count', input: MOV, opts: { count: 10 }, description: 'count=10 중간' },
  { id: 'C3', category: 'Count', input: MOV, opts: { count: 50 }, description: 'count=50 초과' },
  { id: 'C4', category: 'Count', input: GIF, opts: { count: 5 }, description: 'GIF count=5' },

  // === 3. threshold 변화 (threshold-only 모드) ===
  { id: 'T1', category: 'Threshold', input: MOV, opts: { threshold: 0.1 }, description: 'threshold=0.1 낮음' },
  { id: 'T2', category: 'Threshold', input: MOV, opts: { threshold: 0.3 }, description: 'threshold=0.3 중간' },
  { id: 'T3', category: 'Threshold', input: MOV, opts: { threshold: 0.7 }, description: 'threshold=0.7 높음' },
  { id: 'T4', category: 'Threshold', input: MOV, opts: { threshold: 0.9 }, description: 'threshold=0.9 극단' },
  { id: 'T5', category: 'Threshold', input: GIF, opts: { threshold: 0.3 }, description: 'GIF threshold=0.3' },

  // === 4. threshold + count 조합 (threshold-with-cap 모드) ===
  { id: 'TC1', category: 'Threshold+Count', input: MOV, opts: { threshold: 0.2, count: 5 }, description: 't=0.2 n=5 캡' },
  { id: 'TC2', category: 'Threshold+Count', input: MOV, opts: { threshold: 0.7, count: 20 }, description: 't=0.7 n=20 여유' },
  { id: 'TC3', category: 'Threshold+Count', input: GIF, opts: { threshold: 0.3, count: 8 }, description: 'GIF t=0.3 n=8' },

  // === 5. FPS / max-frames 변화 ===
  { id: 'F1', category: 'FPS', input: MOV, opts: { fps: 1 }, description: 'fps=1 저밀도' },
  { id: 'F2', category: 'FPS', input: MOV, opts: { fps: 10 }, description: 'fps=10 고밀도' },
  { id: 'F3', category: 'FPS', input: MOV, opts: { maxFrames: 50 }, description: 'maxFrames=50 제한' },
  { id: 'F4', category: 'FPS', input: MOV, opts: { fps: 10, maxFrames: 500 }, description: 'fps=10 mf=500 최대' },

  // === 6. scale 변화 ===
  { id: 'S1', category: 'Scale', input: MOV, opts: { scale: 360 }, description: 'scale=360 저해상도' },
  { id: 'S2', category: 'Scale', input: MOV, opts: { scale: 1080 }, description: 'scale=1080 고해상도' },

  // === 7. IoU / Animation 파라미터 ===
  { id: 'A1', category: 'Animation', input: MOV, opts: { iouThreshold: 0.5, animationThreshold: 3 }, description: 'IoU=0.5 anim=3 민감' },
  { id: 'A2', category: 'Animation', input: MOV, opts: { iouThreshold: 0.95, animationThreshold: 10 }, description: 'IoU=0.95 anim=10 둔감' },
  { id: 'A3', category: 'Animation', input: GIF, opts: { iouThreshold: 0.5, animationThreshold: 3 }, description: 'GIF IoU=0.5 anim=3' },

  // === 8. quality 변화 ===
  { id: 'Q1', category: 'Quality', input: MOV, opts: { quality: 30, count: 5 }, description: 'quality=30 저품질' },
  { id: 'Q2', category: 'Quality', input: MOV, opts: { quality: 100, count: 5 }, description: 'quality=100 최고' },

  // === 9. debug 모드 ===
  { id: 'D1', category: 'Debug', input: MOV, opts: { count: 5, debug: true }, description: 'debug 모드' },
];

/** 디렉토리 내 파일 총 크기(bytes) */
function dirSize(dir) {
  let total = 0;
  try {
    for (const f of readdirSync(dir)) {
      const fp = join(dir, f);
      const st = statSync(fp);
      if (st.isFile()) total += st.size;
    }
  } catch {}
  return total;
}

async function runTest(tc) {
  const outDir = join(RESULTS_DIR, tc.id);
  mkdirSync(outDir, { recursive: true });

  const baseOpts = {
    mode: 'file',
    inputPath: tc.input,
    outputPath: outDir,
    fps: tc.opts.fps ?? 5,
    maxFrames: tc.opts.maxFrames ?? 300,
    scale: tc.opts.scale ?? 720,
    quality: tc.opts.quality ?? 80,
    debug: tc.opts.debug ?? false,
  };

  // count/threshold는 지정된 경우에만 포함
  if (tc.opts.count !== undefined) baseOpts.count = tc.opts.count;
  if (tc.opts.threshold !== undefined) baseOpts.threshold = tc.opts.threshold;
  if (tc.opts.iouThreshold !== undefined) baseOpts.iouThreshold = tc.opts.iouThreshold;
  if (tc.opts.animationThreshold !== undefined) baseOpts.animationThreshold = tc.opts.animationThreshold;
  if (tc.opts.maxSegmentDuration !== undefined) baseOpts.maxSegmentDuration = tc.opts.maxSegmentDuration;
  if (tc.opts.concurrency !== undefined) baseOpts.concurrency = tc.opts.concurrency;

  const start = Date.now();
  try {
    const result = await extractScenes(baseOpts);
    const elapsed = Date.now() - start;
    const outputSize = dirSize(outDir);

    return {
      ...tc,
      success: result.success,
      originalFrames: result.originalFramesCount,
      prunedFrames: result.prunedFramesCount,
      animationsCount: result.animations?.length ?? 0,
      executionTimeMs: elapsed,
      apiTimeMs: result.executionTimeMs,
      outputFiles: result.outputFiles?.length ?? 0,
      outputSizeKB: Math.round(outputSize / 1024),
      error: null,
    };
  } catch (err) {
    return {
      ...tc,
      success: false,
      originalFrames: 0,
      prunedFrames: 0,
      animationsCount: 0,
      executionTimeMs: Date.now() - start,
      apiTimeMs: 0,
      outputFiles: 0,
      outputSizeKB: 0,
      error: err.message,
    };
  }
}

function generateSummary(results) {
  const lines = [];
  lines.push('# scene-sieve 테스트 결과 요약');
  lines.push('');
  lines.push(`실행 시각: ${new Date().toISOString()}`);
  lines.push(`총 테스트: ${results.length}개`);
  lines.push(`성공: ${results.filter(r => r.success).length}개`);
  lines.push(`실패: ${results.filter(r => !r.success).length}개`);
  lines.push('');

  // 카테고리별 그룹화
  const categories = [...new Set(results.map(r => r.category))];

  for (const cat of categories) {
    const catResults = results.filter(r => r.category === cat);
    lines.push(`## ${cat}`);
    lines.push('');
    lines.push('| ID | 설명 | 성공 | 추출 프레임 | 선택 프레임 | 애니메이션 | 시간(s) | 출력크기(KB) | 비고 |');
    lines.push('|----|------|------|------------|------------|-----------|---------|-------------|------|');

    for (const r of catResults) {
      const status = r.success ? 'O' : 'X';
      const time = (r.executionTimeMs / 1000).toFixed(1);
      const note = r.error ? `Error: ${r.error.substring(0, 40)}` : '';
      lines.push(`| ${r.id} | ${r.description} | ${status} | ${r.originalFrames} | ${r.prunedFrames} | ${r.animationsCount} | ${time} | ${r.outputSizeKB} | ${note} |`);
    }
    lines.push('');
  }

  // 검증 분석
  lines.push('## 검증 분석');
  lines.push('');

  // count 검증
  const countTests = results.filter(r => r.category === 'Count' && r.success);
  if (countTests.length > 0) {
    lines.push('### count 제한 검증');
    for (const r of countTests) {
      const pass = r.prunedFrames <= (r.opts.count ?? 20);
      lines.push(`- ${r.id}: count=${r.opts.count}, 선택=${r.prunedFrames} → ${pass ? 'PASS' : 'FAIL'}`);
    }
    lines.push('');
  }

  // threshold 단조감소 검증
  const threshTests = results.filter(r => r.category === 'Threshold' && r.success && r.input === results[0]?.input);
  if (threshTests.length > 1) {
    lines.push('### threshold 단조감소 경향 검증');
    const sorted = [...threshTests].sort((a, b) => a.opts.threshold - b.opts.threshold);
    let monotonic = true;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].prunedFrames > sorted[i-1].prunedFrames) {
        monotonic = false;
        break;
      }
    }
    for (const r of sorted) {
      lines.push(`- ${r.id}: threshold=${r.opts.threshold}, 선택=${r.prunedFrames}`);
    }
    lines.push(`- 단조감소: ${monotonic ? 'PASS' : 'FAIL (비단조)'}`);
    lines.push('');
  }

  // quality 검증 (프레임 선택 동일해야 함)
  const qualTests = results.filter(r => r.category === 'Quality' && r.success);
  if (qualTests.length === 2) {
    lines.push('### quality 무관성 검증 (프레임 선택 수 동일)');
    const same = qualTests[0].prunedFrames === qualTests[1].prunedFrames;
    lines.push(`- Q1(q=30): ${qualTests[0].prunedFrames}장, Q2(q=100): ${qualTests[1].prunedFrames}장 → ${same ? 'PASS' : 'FAIL'}`);
    lines.push(`- 파일 크기: Q1=${qualTests[0].outputSizeKB}KB vs Q2=${qualTests[1].outputSizeKB}KB`);
    lines.push('');
  }

  return lines.join('\n');
}

// === Main ===
console.log(`\n=== scene-sieve 파라미터 테스트 시작 ===`);
console.log(`테스트 케이스: ${TEST_CASES.length}개\n`);

const results = [];

for (const tc of TEST_CASES) {
  const inputName = tc.input.includes('mov') ? 'MOV' : 'GIF';
  process.stdout.write(`[${tc.id}] ${tc.description} (${inputName})... `);

  const result = await runTest(tc);
  results.push(result);

  if (result.success) {
    console.log(`OK (${result.originalFrames}→${result.prunedFrames} frames, ${(result.executionTimeMs/1000).toFixed(1)}s)`);
  } else {
    console.log(`FAIL: ${result.error}`);
  }
}

// 결과 저장
const summaryMd = generateSummary(results);
writeFileSync(join(RESULTS_DIR, 'summary.md'), summaryMd);
writeFileSync(join(RESULTS_DIR, 'results.json'), JSON.stringify(results, null, 2));

console.log(`\n=== 완료 ===`);
console.log(`성공: ${results.filter(r => r.success).length}/${results.length}`);
console.log(`결과: ${RESULTS_DIR}/summary.md`);
console.log(`원본: ${RESULTS_DIR}/results.json\n`);
