import type { ChangeType } from './ast.js';
import type { BlameResult } from './blame.js';
import type { Confidence } from './pipeline.js';

export type CosmeticReason = 'whitespace' | 'import-order' | 'formatting';

export interface BlameStageResult {
  blame: BlameResult;
  isCosmetic: boolean;
  cosmeticReason?: CosmeticReason;
}

export interface AstDiffStageResult {
  originalSha: string;
  confidence: Confidence;
  changeType: ChangeType;
}
