import {
  extractSymbolsFromText,
  findSymbols,
  isAstAvailable,
} from '../../../ast/index.js';
import type { SymbolInfo } from '../../../types/index.js';

export async function extractSymbols(
  source: string,
  lang: string,
): Promise<SymbolInfo[]> {
  if (isAstAvailable()) {
    const symbols = await findSymbols(source, lang);
    if (symbols.length > 0) return symbols;
  }
  return extractSymbolsFromText(source, lang);
}

export function findContainingSymbol(
  symbols: SymbolInfo[],
  line: number,
): SymbolInfo | null {
  let best: SymbolInfo | null = null;

  for (const symbol of symbols) {
    if (line >= symbol.startLine && line <= symbol.endLine) {
      if (
        !best ||
        symbol.endLine - symbol.startLine < best.endLine - best.startLine
      ) {
        best = symbol;
      }
    }
  }

  return best;
}
