import type { NormalizedResponse, OperatingLevel } from '../types/index.js';
import { VERSION } from '../version.js';

export function createSuccessResponse<T>(
  command: string,
  data: T,
  operatingLevel: OperatingLevel,
  options?: { warnings?: string[]; cacheHit?: boolean },
): NormalizedResponse<T> {
  return {
    tool: 'line-lore',
    command,
    version: VERSION,
    timestamp: new Date().toISOString(),
    status: 'success',
    operatingLevel,
    data,
    warnings: options?.warnings,
    hints:
      options?.cacheHit != null ? { cacheHit: options.cacheHit } : undefined,
  };
}

export function createPartialResponse<T>(
  command: string,
  partialData: Partial<T>,
  operatingLevel: OperatingLevel,
  warnings: string[],
): NormalizedResponse<T> {
  return {
    tool: 'line-lore',
    command,
    version: VERSION,
    timestamp: new Date().toISOString(),
    status: 'partial',
    operatingLevel,
    partialData,
    warnings,
  };
}

export function createErrorResponse(
  command: string,
  code: string,
  message: string,
  operatingLevel: OperatingLevel,
  options?: {
    stage?: number;
    recoverable?: boolean;
    suggestion?: string;
  },
): NormalizedResponse<never> {
  return {
    tool: 'line-lore',
    command,
    version: VERSION,
    timestamp: new Date().toISOString(),
    status: 'error',
    operatingLevel,
    error: {
      code,
      message,
      stage: options?.stage,
      recoverable: options?.recoverable ?? false,
      suggestion: options?.suggestion,
    },
  };
}
