import { forEach, map } from '@winglet/common-utils';

import { gitExec } from '../../git/executor.js';
import type {
  BlameExecOptions,
  BlameResult,
  BlameStageResult,
  DualBlameResult,
  GitExecOptions,
  LineRange,
} from '../../types/index.js';

import { getCosmeticDiff, isCosmeticDiff } from './detection/index.js';
import { parsePorcelainOutput } from './parsing/index.js';

export async function executeBlame(
  file: string,
  lineRange: LineRange,
  options?: BlameExecOptions,
): Promise<BlameResult[]> {
  const lineSpec = `${lineRange.start},${lineRange.end}`;

  const args =
    options?.mode === 'change'
      ? ['blame', '-w', '--porcelain', '-L', lineSpec, file]
      : ['blame', '-w', '-C', '-C', '-M', '--porcelain', '-L', lineSpec, file];

  const result = await gitExec(args, options);

  return parsePorcelainOutput(result.stdout);
}

/**
 * Run dual blame for origin mode: origin blame (-C -C -M) and change blame (-w)
 * in parallel. For change mode, only runs the single blame.
 *
 * Assumes both blames on the same -L range produce results in the same
 * finalLine order (guaranteed by git blame line-ordered output).
 */
export async function executeDualBlame(
  file: string,
  lineRange: LineRange,
  options?: BlameExecOptions,
): Promise<DualBlameResult> {
  if (options?.mode === 'change') {
    const results = await executeBlame(file, lineRange, options);
    return { blame: results, changeBlame: [] };
  }

  const [originResult, changeResult] = await Promise.allSettled([
    executeBlame(file, lineRange, options),
    executeBlame(file, lineRange, { ...options, mode: 'change' }),
  ]);

  const blame =
    originResult.status === 'fulfilled' ? originResult.value : [];
  const changeBlame =
    changeResult.status === 'fulfilled' ? changeResult.value : [];

  if (originResult.status === 'rejected') {
    throw originResult.reason;
  }

  return { blame, changeBlame };
}

/**
 * Verify whether a file was actually renamed from originalFile to currentFile
 * using git log --diff-filter=R.
 */
async function verifyRename(
  originalFile: string,
  currentFile: string,
  options?: GitExecOptions,
): Promise<boolean> {
  try {
    const result = await gitExec(
      [
        'log',
        '--diff-filter=R',
        '--find-renames',
        '--format=%H',
        '--',
        originalFile,
        currentFile,
      ],
      options,
    );
    return result.stdout.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Cross-validate origin blame against change blame (change-first policy).
 * When commitHash differs, change result is used by default.
 * Origin result is kept only when a real rename is verified.
 */
function crossValidateBlame(
  originResults: BlameResult[],
  changeResults: BlameResult[],
): {
  validated: BlameResult[];
  renameChecks: Array<{
    originalFile: string;
    lineIndex: number;
  }>;
  crossValidatedFlags: boolean[];
  changeFallbackFlags: boolean[];
} {
  const changeMap = new Map<number, BlameResult>();
  for (const r of changeResults) {
    changeMap.set(r.finalLine, r);
  }

  const validated: BlameResult[] = [];
  const crossValidatedFlags: boolean[] = [];
  const changeFallbackFlags: boolean[] = [];
  const renameChecks: Array<{
    originalFile: string;
    lineIndex: number;
  }> = [];

  for (let i = 0; i < originResults.length; i++) {
    const origin = originResults[i];
    const change = changeMap.get(origin.finalLine);

    if (!change) {
      validated.push(origin);
      crossValidatedFlags.push(false);
      changeFallbackFlags.push(false);
      continue;
    }

    if (origin.commitHash === change.commitHash) {
      validated.push(origin);
      crossValidatedFlags.push(true);
      changeFallbackFlags.push(false);
      continue;
    }

    // Change-first policy: default to change result.
    // If origin detected a file rename, defer async verification.
    if (origin.originalFile) {
      renameChecks.push({
        originalFile: origin.originalFile,
        lineIndex: i,
      });
    }

    validated.push(change);
    crossValidatedFlags.push(true);
    changeFallbackFlags.push(true);
  }

  return { validated, renameChecks, crossValidatedFlags, changeFallbackFlags };
}

export async function analyzeBlameResults(
  results: BlameResult[],
  filePath: string,
  options?: GitExecOptions,
  changeResults?: BlameResult[],
): Promise<BlameStageResult[]> {
  // Cross-validate origin vs change blame when changeResults are provided
  let effectiveResults = results;
  let crossValidatedFlags: boolean[] | undefined;
  let changeFallbackFlagsResult: boolean[] | undefined;

  if (changeResults && changeResults.length > 0) {
    const { validated, renameChecks, crossValidatedFlags: cvFlags, changeFallbackFlags } =
      crossValidateBlame(results, changeResults);

    // Process rename checks asynchronously
    if (renameChecks.length > 0) {
      const pendingChecks = new Map<string, Promise<boolean>>();
      for (const check of renameChecks) {
        const cacheKey = `${check.originalFile}:${filePath}`;
        if (!pendingChecks.has(cacheKey)) {
          pendingChecks.set(cacheKey, verifyRename(check.originalFile, filePath, options));
        }
      }

      // Await all unique rename verifications
      const renameResults = new Map<string, boolean>();
      for (const [key, promise] of pendingChecks) {
        renameResults.set(key, await promise);
      }

      // Re-apply: if rename verified, swap back to origin result
      for (const check of renameChecks) {
        const cacheKey = `${check.originalFile}:${filePath}`;
        if (renameResults.get(cacheKey)) {
          validated[check.lineIndex] = results[check.lineIndex];
          changeFallbackFlags[check.lineIndex] = false;
        }
      }
    }

    effectiveResults = validated;
    crossValidatedFlags = cvFlags;
    changeFallbackFlagsResult = changeFallbackFlags;
  }

  const uniqueShas = [...new Set(map(effectiveResults, (r) => r.commitHash))];
  const cosmeticMap = new Map<string, ReturnType<typeof isCosmeticDiff>>();
  const zeroSha = '0'.repeat(40);

  const tasks: Promise<void>[] = [];
  forEach(uniqueShas, (sha) => {
    if (sha === zeroSha) return;
    tasks.push(
      (async () => {
        try {
          const blameResult = effectiveResults.find((r) => r.commitHash === sha);
          if (!blameResult) return;
          const file = blameResult.originalFile ?? filePath;

          const diff = await getCosmeticDiff(sha, file, options);
          cosmeticMap.set(sha, isCosmeticDiff(diff));
        } catch {
          cosmeticMap.set(sha, { isCosmetic: false });
        }
      })(),
    );
  });
  await Promise.all(tasks);

  return map(effectiveResults, (blame, i) => {
    const cosmetic = cosmeticMap.get(blame.commitHash);
    return {
      blame,
      isCosmetic: cosmetic?.isCosmetic ?? false,
      cosmeticReason: cosmetic?.reason,
      crossValidated: crossValidatedFlags?.[i],
      usedChangeFallback: changeFallbackFlagsResult?.[i],
    };
  });
}
