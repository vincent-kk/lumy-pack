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

  const adapter = createAdapter(remote);
  return { adapter, remote };
}

export function createAdapter(remote: RemoteInfo): PlatformAdapter {
  switch (remote.platform) {
    case 'github':
      return new GitHubAdapter({ hostname: remote.host });
    case 'github-enterprise':
      return new GitHubEnterpriseAdapter(remote.host);
    case 'gitlab':
      return new GitLabAdapter({ hostname: remote.host });
    case 'gitlab-self-hosted':
      return new GitLabSelfHostedAdapter(remote.host);
    case 'unknown':
      // Try GitHub first for unknown hosts (enterprise)
      return new GitHubEnterpriseAdapter(remote.host);
  }
}
