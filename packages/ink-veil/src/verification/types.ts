import type { FidelityTier } from '../types.js';

export interface VerificationResult {
  passed: boolean | null;
  method: string;
  tier: FidelityTier;
  detail: string;
  hashOriginal?: string;
  hashRestored?: string;
}
