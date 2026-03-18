import type { OperatingLevel } from './pipeline.js';

export interface NormalizedResponse<T> {
  tool: 'line-lore';
  command: string;
  version: string;
  timestamp: string;
  status: 'success' | 'partial' | 'error';
  operatingLevel: OperatingLevel;
  data?: T;
  error?: {
    code: string;
    message: string;
    stage?: number;
    recoverable: boolean;
    suggestion?: string;
  };
  partialData?: Partial<T>;
  warnings?: string[];
  hints?: {
    canRetryWithFlags?: string[];
    relatedCommands?: string[];
    cacheHit?: boolean;
  };
}
