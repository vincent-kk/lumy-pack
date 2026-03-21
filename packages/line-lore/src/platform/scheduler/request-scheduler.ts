import type { RateLimitInfo } from '../../types/index.js';

export interface SchedulerOptions {
  rateLimitThreshold?: number;
}

export class RequestScheduler {
  private rateLimitInfo: RateLimitInfo | null = null;
  private readonly threshold: number;

  constructor(options?: SchedulerOptions) {
    this.threshold = options?.rateLimitThreshold ?? 10;
  }

  updateRateLimit(info: RateLimitInfo): void {
    this.rateLimitInfo = info;
  }

  isRateLimited(): boolean {
    if (!this.rateLimitInfo) return false;
    return this.rateLimitInfo.remaining < this.threshold;
  }

  getRateLimit(): RateLimitInfo | null {
    return this.rateLimitInfo;
  }
}
