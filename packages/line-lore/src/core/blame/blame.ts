import { gitExec } from '../../git/executor.js';
import type {
  BlameResult,
  BlameStageResult,
  GitExecOptions,
  LineRange,
} from '../../types/index.js';

import { getCosmeticDiff, isCosmeticDiff } from './detection/index.js';
import { parsePorcelainOutput } from './parsing/index.js';

export async function executeBlame(
  file: string,
  lineRange: LineRange,
  options?: GitExecOptions,
): Promise<BlameResult[]> {
  const lineSpec = `${lineRange.start},${lineRange.end}`;

  const result = await gitExec(
    ['blame', '-w', '-C', '-C', '-M', '--porcelain', '-L', lineSpec, file],
    options,
  );

  return parsePorcelainOutput(result.stdout);
}

export async function analyzeBlameResults(
  results: BlameResult[],
  filePath: string,
  options?: GitExecOptions,
): Promise<BlameStageResult[]> {
  const uniqueShas = [...new Set(results.map((r) => r.commitHash))];
  const cosmeticMap = new Map<string, ReturnType<typeof isCosmeticDiff>>();

  const zeroSha = '0'.repeat(40);
  await Promise.all(
    uniqueShas
      .filter((sha) => sha !== zeroSha)
      .map(async (sha) => {
        try {
          const blameResult = results.find((r) => r.commitHash === sha);
          if (!blameResult) return;
          const file = blameResult.originalFile ?? filePath;

          const diff = await getCosmeticDiff(sha, file, options);
          cosmeticMap.set(sha, isCosmeticDiff(diff));
        } catch {
          cosmeticMap.set(sha, { isCosmetic: false });
        }
      }),
  );

  return results.map((blame) => {
    const cosmetic = cosmeticMap.get(blame.commitHash);
    return {
      blame,
      isCosmetic: cosmetic?.isCosmetic ?? false,
      cosmeticReason: cosmetic?.reason,
    };
  });
}
