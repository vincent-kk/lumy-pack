import { readFileSync } from 'node:fs';

/** 개별 벤치마크 결과 */
export interface BenchResult {
  name: string;
  hz: number;
  mean: number;
  min: number;
  max: number;
  p75: number;
  p99: number;
  samples: number;
  suite?: string;
}

/** 비교 결과 항목 */
export interface ComparisonEntry {
  name: string;
  baseline: number;
  current: number;
  delta: number;
  deltaPercent: number;
  faster: boolean;
}

/** 비교 리포트 */
export interface ComparisonReport {
  summary: string;
  entries: ComparisonEntry[];
  improved: number;
  regressed: number;
  unchanged: number;
}

/** Vitest bench JSON 출력 파싱 */
export function parseBenchOutput(jsonPath: string): BenchResult[] {
  const raw = readFileSync(jsonPath, 'utf-8');
  const data = JSON.parse(raw) as unknown;

  if (!data || typeof data !== 'object') {
    return [];
  }

  const results: BenchResult[] = [];

  // Vitest bench JSON 구조: { testResults: [...] }
  const testResults = (data as Record<string, unknown>).testResults;
  if (!Array.isArray(testResults)) {
    return [];
  }

  for (const suite of testResults) {
    if (!suite || typeof suite !== 'object') continue;

    const suiteRecord = suite as Record<string, unknown>;
    const assertionResults = suiteRecord.assertionResults;
    if (!Array.isArray(assertionResults)) continue;

    const suiteName =
      typeof suiteRecord.testFilePath === 'string'
        ? (suiteRecord.testFilePath
            .split('/')
            .pop()
            ?.replace('.bench.ts', '') ?? '')
        : '';

    for (const test of assertionResults) {
      if (!test || typeof test !== 'object') continue;

      const testRecord = test as Record<string, unknown>;
      const benchData = testRecord.benchData as
        | Record<string, unknown>
        | undefined;

      if (!benchData) continue;

      results.push({
        name:
          typeof testRecord.fullName === 'string'
            ? testRecord.fullName
            : String(testRecord.title ?? ''),
        hz: Number(benchData.hz ?? 0),
        mean: Number(benchData.mean ?? 0),
        min: Number(benchData.min ?? 0),
        max: Number(benchData.max ?? 0),
        p75: Number(benchData.p75 ?? 0),
        p99: Number(benchData.p99 ?? 0),
        samples: Number(benchData.samples ?? 0),
        suite: suiteName,
      });
    }
  }

  return results;
}

/** 결과를 마크다운 테이블로 변환 */
export function toMarkdownTable(results: BenchResult[]): string {
  if (results.length === 0) {
    return '_No benchmark results found._\n';
  }

  const header =
    '| Benchmark | ops/sec | mean (ns) | min (ns) | max (ns) | p75 (ns) | p99 (ns) | samples |';
  const separator =
    '|-----------|---------|-----------|----------|----------|----------|----------|---------|';

  const rows = results.map((r) => {
    const opsPerSec = r.hz.toFixed(0);
    const meanNs = (r.mean * 1e6).toFixed(2);
    const minNs = (r.min * 1e6).toFixed(2);
    const maxNs = (r.max * 1e6).toFixed(2);
    const p75Ns = (r.p75 * 1e6).toFixed(2);
    const p99Ns = (r.p99 * 1e6).toFixed(2);
    return `| ${r.name} | ${opsPerSec} | ${meanNs} | ${minNs} | ${maxNs} | ${p75Ns} | ${p99Ns} | ${r.samples} |`;
  });

  return [header, separator, ...rows].join('\n') + '\n';
}

/** 베이스라인과 현재 결과 비교 */
export function compareBenchResults(
  baseline: BenchResult[],
  current: BenchResult[],
): ComparisonReport {
  const baselineMap = new Map(baseline.map((r) => [r.name, r]));

  const entries: ComparisonEntry[] = [];
  let improved = 0;
  let regressed = 0;
  let unchanged = 0;

  for (const curr of current) {
    const base = baselineMap.get(curr.name);
    if (!base) continue;

    const delta = curr.hz - base.hz;
    const deltaPercent = base.hz !== 0 ? (delta / base.hz) * 100 : 0;
    const faster = delta > 0;

    // 5% 이상 변화만 의미 있는 변화로 판단
    if (Math.abs(deltaPercent) >= 5) {
      if (faster) improved++;
      else regressed++;
    } else {
      unchanged++;
    }

    entries.push({
      name: curr.name,
      baseline: base.hz,
      current: curr.hz,
      delta,
      deltaPercent,
      faster,
    });
  }

  const summaryParts: string[] = [];
  if (improved > 0) summaryParts.push(`${improved} improved`);
  if (regressed > 0) summaryParts.push(`${regressed} regressed`);
  if (unchanged > 0) summaryParts.push(`${unchanged} unchanged`);

  const summary =
    summaryParts.length > 0
      ? summaryParts.join(', ')
      : 'No comparable benchmarks found';

  return { summary, entries, improved, regressed, unchanged };
}
