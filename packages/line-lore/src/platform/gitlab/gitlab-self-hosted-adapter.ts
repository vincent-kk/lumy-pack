import type { RequestScheduler } from '../scheduler/index.js';

import { GitLabAdapter } from './gitlab-adapter.js';

export class GitLabSelfHostedAdapter extends GitLabAdapter {
  override readonly platform = 'gitlab-self-hosted' as const;

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
