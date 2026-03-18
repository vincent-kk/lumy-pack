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
