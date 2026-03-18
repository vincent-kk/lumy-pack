import { gitExec } from '../../git/executor.js';
import type { GitExecOptions } from '../../types/index.js';

export interface AncestryResult {
  mergeCommitSha: string;
  parentShas: string[];
  subject: string;
}

export async function findMergeCommit(
  commitSha: string,
  options?: GitExecOptions & { ref?: string },
): Promise<AncestryResult | null> {
  const ref = options?.ref ?? 'HEAD';

  try {
    const result = await gitExec(
      [
        'log',
        '--merges',
        '--ancestry-path',
        `${commitSha}..${ref}`,
        '--topo-order',
        '--reverse',
        '--format=%H %P %s',
      ],
      { cwd: options?.cwd, timeout: options?.timeout },
    );

    const lines = result.stdout.trim().split('\n').filter(Boolean);
    if (lines.length === 0) return null;

    // First merge commit in topo-order is the closest
    const firstLine = lines[0];
    const parts = firstLine.split(' ');
    if (parts.length < 3) return null;

    const mergeCommitSha = parts[0];
    // Parents are between SHA and subject. Merge commits have 2+ parents.
    // Format: %H %P %s where %P can be "parent1 parent2"
    // We need to find where subject starts - parents are 40-char hex strings
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

  return null;
}
