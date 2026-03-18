import type { RateLimitInfo } from '../../types/index.js';

export interface SchedulerOptions {
  rateLimitThreshold?: number;
}

export class RequestScheduler {
  private rateLimitInfo: RateLimitInfo | null = null;
  private readonly threshold: number;
  private etagCache = new Map<string, string>();
  private responseCache = new Map<string, string>();

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

  setEtag(url: string, etag: string, response: string): void {
    this.etagCache.set(url, etag);
    this.responseCache.set(url, response);
  }

  getEtag(url: string): string | null {
    return this.etagCache.get(url) ?? null;
  }

  getCachedResponse(url: string): string | null {
    return this.responseCache.get(url) ?? null;
  }
}
