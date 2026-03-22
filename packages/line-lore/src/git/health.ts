import { map } from '@winglet/common-utils';

import type { CloneStatus, HealthReport } from '../types/index.js';

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

export async function checkCloneStatus(options?: {
  cwd?: string;
}): Promise<CloneStatus> {
  let partialClone = false;
  let shallow = false;

  try {
    const shallowResult = await gitExec(
      ['rev-parse', '--is-shallow-repository'],
      { cwd: options?.cwd },
    );
    shallow = shallowResult.stdout.trim() === 'true';
  } catch {
    // Older git versions may not support --is-shallow-repository
  }

  try {
    const partialResult = await gitExec(
      ['config', '--get', 'extensions.partialclone'],
      { cwd: options?.cwd },
    );
    partialClone = partialResult.stdout.trim().length > 0;
  } catch {
    // Config key not found (exit 1) or git error — not a partial clone
  }

  return { partialClone, shallow };
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

  const cloneStatus = await checkCloneStatus({ cwd: options?.cwd });

  if (cloneStatus.partialClone) {
    hints.push(
      'Partial clone detected. Patch-ID scan (Strategy 4) will be skipped to avoid blob downloads.',
    );
  }
  if (cloneStatus.shallow) {
    hints.push(
      'Shallow repository detected. Ancestry-path results may be incomplete.',
    );
  }

  return { commitGraph, bloomFilter, gitVersion, hints, ...cloneStatus };
}
