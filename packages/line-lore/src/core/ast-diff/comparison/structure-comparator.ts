import type {
  ComparisonResult,
  Confidence,
  ContentHash,
} from '../../../types/index.js';

export type SymbolMap = Map<string, ContentHash>;

export function compareSymbolMaps(
  current: SymbolMap,
  parent: SymbolMap,
): ComparisonResult[] {
  const results: ComparisonResult[] = [];

  for (const [name, hash] of current) {
    const parentHash = parent.get(name);

    if (parentHash) {
      if (parentHash.exact === hash.exact) {
        results.push({ change: 'identical', confidence: 'exact' });
      } else if (parentHash.structural === hash.structural) {
        results.push({
          change: 'modified',
          fromName: name,
          toName: name,
          confidence: 'structural',
        });
      } else {
        results.push({
          change: 'modified',
          fromName: name,
          toName: name,
          confidence: 'heuristic',
        });
      }
      continue;
    }

    // Name not found in parent — check for rename (different name, same hash)
    const renameMatch = findHashMatch(hash, parent);
    if (renameMatch) {
      results.push({
        change: 'rename',
        fromName: renameMatch.name,
        toName: name,
        confidence: renameMatch.confidence,
      });
    } else {
      results.push({ change: 'new', toName: name, confidence: 'exact' });
    }
  }

  return results;
}

export function findMatchAcrossFiles(
  targetHash: ContentHash,
  parentFileMaps: Map<string, SymbolMap>,
): ComparisonResult | null {
  for (const [filePath, symbolMap] of parentFileMaps) {
    const match = findHashMatch(targetHash, symbolMap);
    if (match) {
      return {
        change: 'move',
        fromName: match.name,
        fromFile: filePath,
        confidence: match.confidence,
      };
    }
  }
  return null;
}

function findHashMatch(
  target: ContentHash,
  map: SymbolMap,
): { name: string; confidence: Confidence } | null {
  for (const [name, hash] of map) {
    if (hash.exact === target.exact) {
      return { name, confidence: 'exact' };
    }
  }
  for (const [name, hash] of map) {
    if (hash.structural === target.structural) {
      return { name, confidence: 'structural' };
    }
  }
  return null;
}
