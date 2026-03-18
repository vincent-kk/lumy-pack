import { GitLabAdapter } from './gitlab-adapter.js';
import type { RequestScheduler } from '../scheduler/index.js';

export class GitLabSelfHostedAdapter extends GitLabAdapter {
  override readonly platform = 'gitlab-self-hosted' as const;

  constructor(hostname: string, options?: { scheduler?: RequestScheduler }) {
    super({ hostname, scheduler: options?.scheduler });
  }
}
