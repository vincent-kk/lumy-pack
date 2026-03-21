import { map } from '@winglet/common-utils';

import type { HealthReport } from '../types/index.js';

import { gitExec } from './executor.js';

const GIT_VERSION_PATTERN = /git version (\d+\.\d+\.\d+)/;
const BLOOM_FILTER_MIN_VERSION = [2, 27, 0] as const;

function parseGitVersion(versionStr: string): string {
  const match = GIT_VERSION_PATTERN.exec(versionStr);
  return match?.[1] ?? '0.0.0';
}

function isVersionAtLeast(
  version: string,
  minVersion: readonly [number, number, number],
): boolean {
  const parts = map(version.split('.'), Number);
  for (let i = 0; i < 3; i++) {
    if ((parts[i] ?? 0) > minVersion[i]) return true;
    if ((parts[i] ?? 0) < minVersion[i]) return false;
  }
  return true;
}

export async function checkGitHealth(options?: {
  cwd?: string;
}): Promise<HealthReport> {
  const hints: string[] = [];
  let gitVersion = '0.0.0';
  let commitGraph = false;
  let bloomFilter = false;

  try {
    const versionResult = await gitExec(['version'], { cwd: options?.cwd });
    gitVersion = parseGitVersion(versionResult.stdout);
  } catch {
    hints.push('Could not determine git version.');
  }

  try {
    await gitExec(['commit-graph', 'verify'], { cwd: options?.cwd });
    commitGraph = true;
  } catch {
    commitGraph = false;
    hints.push(
      'Run `git commit-graph write --reachable` to enable commit-graph acceleration.',
    );
  }

  bloomFilter = isVersionAtLeast(gitVersion, BLOOM_FILTER_MIN_VERSION);
  if (!bloomFilter) {
    hints.push(
      `Upgrade git to ${BLOOM_FILTER_MIN_VERSION.join('.')}+ for bloom filter support (current: ${gitVersion}).`,
    );
  }

  return { commitGraph, bloomFilter, gitVersion, hints };
}
