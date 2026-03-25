import type { ChangeType } from './ast.js';
import type { BlameResult } from './blame.js';
import type { Confidence } from './pipeline.js';

export type CosmeticReason = 'whitespace' | 'import-order' | 'formatting';

export interface BlameStageResult {
  blame: BlameResult;
  isCosmetic: boolean;
  cosmeticReason?: CosmeticReason;
  /** Whether this result was cross-validated against change blame (origin mode only) */
  crossValidated?: boolean;
  /** Whether the change blame result was used instead of origin (false positive filtered) */
  usedChangeFallback?: boolean;
}

export interface AstDiffStageResult {
  originalSha: string;
  confidence: Confidence;
  changeType: ChangeType;
}
