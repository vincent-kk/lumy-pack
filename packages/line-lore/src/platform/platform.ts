import { getRemoteInfo } from '../git/remote.js';
import type { PlatformAdapter, RemoteInfo } from '../types/index.js';

import { GitHubAdapter } from './github/index.js';
import { GitHubEnterpriseAdapter } from './github/index.js';
import { GitLabAdapter } from './gitlab/index.js';
import { GitLabSelfHostedAdapter } from './gitlab/index.js';

export async function detectPlatformAdapter(options?: {
  cwd?: string;
  remoteName?: string;
}): Promise<{ adapter: PlatformAdapter; remote: RemoteInfo }> {
  const remote = await getRemoteInfo(options?.remoteName, {
    cwd: options?.cwd,
  });

  const adapter = createAdapter(remote, options?.remoteName);
  return { adapter, remote };
}

export function createAdapter(
  remote: RemoteInfo,
  remoteName?: string,
): PlatformAdapter {
  switch (remote.platform) {
    case 'github':
      return new GitHubAdapter({ hostname: remote.host, remoteName });
    case 'github-enterprise':
      return new GitHubEnterpriseAdapter(remote.host, { remoteName });
    case 'gitlab':
      return new GitLabAdapter({ hostname: remote.host, remoteName });
    case 'gitlab-self-hosted':
      return new GitLabSelfHostedAdapter(remote.host, { remoteName });
    case 'unknown':
      // Try GitHub first for unknown hosts (enterprise)
      return new GitHubEnterpriseAdapter(remote.host, { remoteName });
  }
}
