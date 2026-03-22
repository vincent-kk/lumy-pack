import { filter, isTruthy } from '@winglet/common-utils';

import { gitExec } from '../../git/executor.js';
import type { GitExecOptions } from '../../types/index.js';

export interface AncestryResult {
  mergeCommitSha: string;
  parentShas: string[];
  subject: string;
}

export const DEFAULT_ANCESTRY_TIMEOUT = 30_000;
const MAX_CANDIDATES = 10;

export async function findMergeCommit(
  commitSha: string,
  options?: GitExecOptions & { ref?: string },
): Promise<AncestryResult | null> {
  const ref = options?.ref ?? 'HEAD';
  const budget = options?.timeout ?? DEFAULT_ANCESTRY_TIMEOUT;
  const startTime = Date.now();

  // Try first-parent first — avoids base-update merges (main→feature direction)
  const firstParentResult = await findMergeCommitWithArgs(
    commitSha,
    ref,
    ['--first-parent'],
    { ...options, timeout: budget },
  );
  if (firstParentResult) return firstParentResult;

  // Calculate remaining budget for fallback
  const elapsed = Date.now() - startTime;
  const remaining = budget - elapsed;
  if (remaining <= 0) return null;

  // Fallback: full ancestry-path without first-parent restriction
  return findMergeCommitWithArgs(commitSha, ref, [], {
    ...options,
    timeout: remaining,
  });
}

/**
 * Verify that a merge commit actually introduced the target commit
 * through its branch side (non-first parent), not from the mainline.
 *
 * Dual condition:
 * 1. Target IS an ancestor of at least one non-first parent (branch side)
 * 2. Target is NOT an ancestor of the first parent (mainline side)
 *
 * Returns true on git command failure (fail-open policy).
 */
export async function verifyMergeIntroducesCommit(
  targetSha: string,
  mergeResult: AncestryResult,
  options?: GitExecOptions,
): Promise<boolean> {
  if (mergeResult.parentShas.length < 2) return true;

  const firstParent = mergeResult.parentShas[0];
  const branchParents = mergeResult.parentShas.slice(1);

  // Check if target is ancestor of first parent (mainline)
  // If yes, the merge did NOT introduce the target — it was already on mainline
  const onMainline = await isAncestor(targetSha, firstParent, options);
  if (onMainline === null) return true; // fail-open
  if (onMainline) return false;

  // Check if target is ancestor of any non-first parent (branch side)
  for (const branchParent of branchParents) {
    const onBranch = await isAncestor(targetSha, branchParent, options);
    if (onBranch === null) return true; // fail-open
    if (onBranch) return true;
  }

  return false;
}

/** Returns true/false for ancestry check, null on git failure. */
async function isAncestor(
  commitA: string,
  commitB: string,
  options?: GitExecOptions,
): Promise<boolean | null> {
  try {
    const result = await gitExec(
      ['merge-base', '--is-ancestor', commitA, commitB],
      {
        cwd: options?.cwd,
        timeout: options?.timeout ?? 5_000,
        allowExitCodes: [1],
      },
    );
    // exit code 0 = is ancestor, exit code 1 = not ancestor
    return result.exitCode === 0;
  } catch {
    return null; // git failure — fail-open
  }
}

async function findMergeCommitWithArgs(
  commitSha: string,
  ref: string,
  extraArgs: string[],
  options?: GitExecOptions,
): Promise<AncestryResult | null> {
  try {
    const result = await gitExec(
      [
        'log',
        '--merges',
        '--ancestry-path',
        ...extraArgs,
        `${commitSha}..${ref}`,
        '--topo-order',
        '--reverse',
        '--format=%H %P %s',
      ],
      { cwd: options?.cwd, timeout: options?.timeout },
    );

    const lines = filter(result.stdout.trim().split('\n'), isTruthy);
    if (lines.length === 0) return null;

    // Iterate candidates and verify each one introduces the target commit
    const candidateCount = Math.min(lines.length, MAX_CANDIDATES);
    for (let i = 0; i < candidateCount; i++) {
      const candidate = parseMergeLogLine(lines[i]);
      if (!candidate) continue;

      const verified = await verifyMergeIntroducesCommit(
        commitSha,
        candidate,
        options,
      );
      if (verified) return candidate;
    }

    return null;
  } catch {
    return null;
  }
}

function parseMergeLogLine(line: string): AncestryResult | null {
  const parts = line.split(' ');
  if (parts.length < 3) return null;

  const mergeCommitSha = parts[0];
  const parentShas: string[] = [];
  let subjectStart = 1;

  for (let i = 1; i < parts.length; i++) {
    if (/^[0-9a-f]{40}$/.test(parts[i])) {
      parentShas.push(parts[i]);
      subjectStart = i + 1;
    } else {
      break;
    }
  }

  const subject = parts.slice(subjectStart).join(' ');
  return { mergeCommitSha, parentShas, subject };
}

/** Retrieve the subject line of a single commit. Returns null on git failure. */
export async function getCommitSubject(
  sha: string,
  options?: GitExecOptions,
): Promise<string | null> {
  try {
    const result = await gitExec(['log', '-1', '--format=%s', sha], {
      cwd: options?.cwd,
      timeout: options?.timeout ?? 5_000,
    });
    const subject = result.stdout.trim();
    return subject || null;
  } catch {
    return null;
  }
}

export function extractPRFromMergeMessage(subject: string): number | null {
  // "Merge pull request #123 from ..." (GitHub merge commit)
  const ghMatch = /Merge pull request #(\d+)/.exec(subject);
  if (ghMatch) return parseInt(ghMatch[1], 10);

  // "feat: something (#123)" (squash merge convention)
  const squashMatch = /\(#(\d+)\)\s*$/.exec(subject);
  if (squashMatch) return parseInt(squashMatch[1], 10);

  // "See merge request group/project!123" (GitLab merge commit)
  const glMatch = /!(\d+)\s*$/.exec(subject);
  if (glMatch) return parseInt(glMatch[1], 10);

  // "Merged PR 99: Add feature" (Azure DevOps merge commit)
  const adoMatch = /Merged PR (\d+):/.exec(subject);
  if (adoMatch) return parseInt(adoMatch[1], 10);

  return null;
}
