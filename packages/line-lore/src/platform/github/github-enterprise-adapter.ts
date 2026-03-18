import { GitHubAdapter } from './github-adapter.js';
import type { RequestScheduler } from '../scheduler/index.js';

export class GitHubEnterpriseAdapter extends GitHubAdapter {
  override readonly platform = 'github-enterprise' as const;

  constructor(hostname: string, options?: { scheduler?: RequestScheduler }) {
    super({ hostname, scheduler: options?.scheduler });
  }
}
