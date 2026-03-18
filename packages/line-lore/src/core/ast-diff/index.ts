export { traceByAst } from './ast-diff.js';
export {
  compareSymbolMaps,
  findMatchAcrossFiles,
} from './comparison/index.js';
export type { SymbolMap } from './comparison/index.js';
export {
  computeContentHash,
  computeExactHash,
  computeStructuralHash,
  extractSymbols,
  findContainingSymbol,
} from './extraction/index.js';
