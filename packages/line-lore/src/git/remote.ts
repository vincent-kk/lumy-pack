import { LineLoreError, LineLoreErrorCode } from '../errors.js';
import type { RemoteInfo } from '../types/index.js';

import { gitExec } from './executor.js';

const SSH_PATTERN = /^(?:ssh:\/\/)?git@([^:/]+)[:/]([^/]+)\/(.+?)(?:\.git)?$/;
const HTTPS_PATTERN = /^https?:\/\/([^/]+)\/([^/]+)\/(.+?)(?:\.git)?$/;

export function parseRemoteUrl(url: string): RemoteInfo {
  let match = SSH_PATTERN.exec(url);
  if (match) {
    const [, host, owner, repo] = match;
    return { host, owner, repo, platform: detectPlatform(host) };
  }

  match = HTTPS_PATTERN.exec(url);
  if (match) {
    const [, host, owner, repo] = match;
    return { host, owner, repo, platform: detectPlatform(host) };
  }

  throw new LineLoreError(
    LineLoreErrorCode.INVALID_REMOTE_URL,
    `Cannot parse remote URL: ${url}`,
    { url },
  );
}

export function detectPlatform(host: string): RemoteInfo['platform'] {
  if (host === 'github.com') return 'github';
  if (host === 'gitlab.com') return 'gitlab';
  return 'unknown';
}

export async function getRemoteInfo(
  remoteName = 'origin',
  options?: { cwd?: string },
): Promise<RemoteInfo> {
  const result = await gitExec(['remote', 'get-url', remoteName], {
    cwd: options?.cwd,
  });
  return parseRemoteUrl(result.stdout.trim());
}
