import { isTruthy, map } from '@winglet/common-utils';

import { detectLanguage } from '../../ast/index.js';
import { gitExec } from '../../git/executor.js';
import type {
  AstTraceResult,
  ComparisonResult,
  GitExecOptions,
  SymbolInfo,
} from '../../types/index.js';

import { compareSymbolMaps } from './comparison/index.js';
import {
  computeContentHash,
  extractSymbols,
  findContainingSymbol,
} from './extraction/index.js';

const MAX_TRAVERSAL_DEPTH = 50;

export async function traceByAst(
  file: string,
  line: number,
  startCommitSha: string,
  options?: GitExecOptions & { maxDepth?: number },
): Promise<AstTraceResult | null> {
  const lang = detectLanguage(file);
  if (!lang) return null;

  const maxDepth = options?.maxDepth ?? MAX_TRAVERSAL_DEPTH;
  const changes: ComparisonResult[] = [];

  let currentSha = startCommitSha;
  let currentSymbol: SymbolInfo | null = null;

  try {
    const content = await getFileAtCommit(currentSha, file, options);
    const symbols = await extractSymbols(content, lang);
    currentSymbol = findContainingSymbol(symbols, line);

    if (!currentSymbol) return null;
  } catch {
    return null;
  }

  let originSha = currentSha;
  let originSymbol = currentSymbol;

  for (let depth = 0; depth < maxDepth; depth++) {
    const parentSha = await getParentCommit(currentSha, options);
    if (!parentSha) break;

    try {
      const parentContent = await getFileAtCommit(parentSha, file, options);
      const parentSymbols = await extractSymbols(parentContent, lang);

      const currentMap = new Map(
        [currentSymbol]
          .filter(isTruthy)
          .map((s) => [s!.name, computeContentHash(s!.bodyText)]),
      );

      const parentMap = new Map(
        map(parentSymbols, (s) => [s.name, computeContentHash(s.bodyText)]),
      );

      const comparison = compareSymbolMaps(currentMap, parentMap);

      if (comparison.length > 0) {
        const result = comparison[0];
        changes.push(result);

        if (result.change === 'identical') {
          originSha = parentSha;
          const parentSymbol = parentSymbols.find(
            (s) => s.name === currentSymbol!.name,
          );
          if (parentSymbol) {
            originSymbol = parentSymbol;
            currentSymbol = parentSymbol;
          }
        } else if (result.change === 'rename' && result.fromName) {
          originSha = parentSha;
          const parentSymbol = parentSymbols.find(
            (s) => s.name === result.fromName,
          );
          if (parentSymbol) {
            originSymbol = parentSymbol;
            currentSymbol = parentSymbol;
          }
        } else if (result.change === 'new') {
          break;
        } else {
          break;
        }
      } else {
        break;
      }

      currentSha = parentSha;
    } catch {
      break;
    }
  }

  const lastChange = changes[changes.length - 1];

  return {
    originSha,
    originSymbol,
    trackingMethod: 'ast-signature',
    confidence: lastChange?.confidence ?? 'exact',
    changes,
  };
}

async function getFileAtCommit(
  sha: string,
  file: string,
  options?: GitExecOptions,
): Promise<string> {
  const result = await gitExec(['show', `${sha}:${file}`], options);
  return result.stdout;
}

async function getParentCommit(
  sha: string,
  options?: GitExecOptions,
): Promise<string | null> {
  try {
    const result = await gitExec(['log', '-1', '--format=%P', sha], options);
    const parents = result.stdout.trim().split(/\s+/);
    return parents[0] || null;
  } catch {
    return null;
  }
}
