export {
  analyzeBlameResults,
  executeBlame,
  isCosmeticDiff,
  parsePorcelainOutput,
} from './blame/index.js';

export {
  compareSymbolMaps,
  computeContentHash,
  computeExactHash,
  computeStructuralHash,
  extractSymbols,
  findContainingSymbol,
  findMatchAcrossFiles,
  traceByAst,
} from './ast-diff/index.js';

export {
  extractPRFromMergeMessage,
  findMergeCommit,
} from './ancestry/index.js';
export type { AncestryResult } from './ancestry/index.js';

export {
  computePatchId,
  findPatchIdMatch,
  resetPatchIdCache,
} from './patch-id/index.js';
export type { PatchIdResult } from './patch-id/index.js';

export { lookupPR, resetPRCache } from './pr-lookup/index.js';

export { clearCache, health, trace } from './core.js';
export type { TraceFullResult } from './core.js';
