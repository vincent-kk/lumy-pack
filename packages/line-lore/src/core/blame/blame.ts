import type {
  BlameResult,
  BlameStageResult,
  GitExecOptions,
  LineRange,
} from '../../types/index.js';

import { gitExec } from '../../git/executor.js';

import { getCosmeticDiff, isCosmeticDiff } from './detection/index.js';
import { parsePorcelainOutput } from './parsing/index.js';

export async function executeBlame(
  file: string,
  lineRange: LineRange,
  options?: GitExecOptions,
): Promise<BlameResult[]> {
  const lineSpec = lineRange.start === lineRange.end
    ? `${lineRange.start},${lineRange.end}`
    : `${lineRange.start},${lineRange.end}`;

  const result = await gitExec(
    ['blame', '-w', '-C', '-C', '-M', '--porcelain', '-L', lineSpec, file],
    options,
  );

  return parsePorcelainOutput(result.stdout);
}

export async function analyzeBlameResults(
  results: BlameResult[],
  options?: GitExecOptions,
): Promise<BlameStageResult[]> {
  const uniqueShas = [...new Set(results.map((r) => r.commitHash))];
  const cosmeticMap = new Map<string, ReturnType<typeof isCosmeticDiff>>();

  for (const sha of uniqueShas) {
    if (sha === '0'.repeat(40)) continue;
    try {
      const blameResult = results.find((r) => r.commitHash === sha);
      if (!blameResult) continue;
      const file =
        blameResult.originalFile ??
        results.find((r) => r.commitHash === sha)?.lineContent;

      // Try to get diff for this commit
      const diff = await getCosmeticDiff(sha, file ?? '', options);
      cosmeticMap.set(sha, isCosmeticDiff(diff));
    } catch {
      cosmeticMap.set(sha, { isCosmetic: false });
    }
  }

  return results.map((blame) => {
    const cosmetic = cosmeticMap.get(blame.commitHash);
    return {
      blame,
      isCosmetic: cosmetic?.isCosmetic ?? false,
      cosmeticReason: cosmetic?.reason,
    };
  });
}
