import type { RequestScheduler } from '../scheduler/index.js';

import { GitHubAdapter } from './github-adapter.js';

export class GitHubEnterpriseAdapter extends GitHubAdapter {
  override readonly platform = 'github-enterprise' as const;

  constructor(
    hostname: string,
    options?: { scheduler?: RequestScheduler; remoteName?: string },
  ) {
    super({
      hostname,
      scheduler: options?.scheduler,
      remoteName: options?.remoteName,
    });
  }
}
