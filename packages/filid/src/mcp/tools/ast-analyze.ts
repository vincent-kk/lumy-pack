/**
 * MCP tool handler: ast-analyze
 * Wraps AST analysis modules (dependency-extractor, lcom4, cyclomatic-complexity, tree-diff).
 * Requires @ast-grep/napi — returns helpful error if not installed.
 */
import { calculateCC } from '../../ast/cyclomatic-complexity.js';
import { extractDependencies } from '../../ast/dependency-extractor.js';
import { calculateLCOM4 } from '../../ast/lcom4.js';
import { computeTreeDiff } from '../../ast/tree-diff.js';
import { getSgLoadError, getSgModule } from '../../ast/ast-grep-shared.js';

export interface AstAnalyzeInput {
  /** Source code to analyze */
  source: string;
  /** Virtual file path */
  filePath?: string;
  /** Analysis type */
  analysisType:
    | 'dependency-graph'
    | 'lcom4'
    | 'cyclomatic-complexity'
    | 'tree-diff'
    | 'full';
  /** Class name (required for lcom4) */
  className?: string;
  /** Old source (required for tree-diff) */
  oldSource?: string;
}

/**
 * Handle AST analysis requests.
 */
export async function handleAstAnalyze(
  input: AstAnalyzeInput,
): Promise<Record<string, unknown>> {
  const sg = await getSgModule();
  if (!sg) {
    return {
      error: `@ast-grep/napi is not available. Install it with: npm install -g @ast-grep/napi`,
      sgLoadError: getSgLoadError(),
    };
  }

  const filePath = input.filePath ?? 'anonymous.ts';

  switch (input.analysisType) {
    case 'dependency-graph': {
      const info = await extractDependencies(input.source, filePath);
      return {
        imports: info.imports,
        exports: info.exports,
        calls: info.calls,
      };
    }

    case 'lcom4': {
      if (!input.className) {
        throw new Error('className is required for lcom4 analysis');
      }
      const result = await calculateLCOM4(input.source, input.className);
      return {
        value: result.value,
        components: result.components,
        methodCount: result.methodCount,
        fieldCount: result.fieldCount,
      };
    }

    case 'cyclomatic-complexity': {
      const result = await calculateCC(input.source, filePath);
      return {
        value: result.value,
        fileTotal: result.fileTotal,
        perFunction: Object.fromEntries(result.perFunction),
      };
    }

    case 'tree-diff': {
      const oldSource = input.oldSource ?? '';
      const result = await computeTreeDiff(oldSource, input.source, filePath);
      return {
        changes: result.changes,
        hasSemanticChanges: result.hasSemanticChanges,
        formattingOnlyChanges: result.formattingOnlyChanges,
      };
    }

    case 'full': {
      const deps = await extractDependencies(input.source, filePath);
      const cc = await calculateCC(input.source, filePath);
      const result: Record<string, unknown> = {
        dependencies: {
          imports: deps.imports,
          exports: deps.exports,
          calls: deps.calls,
        },
        cyclomaticComplexity: {
          value: cc.value,
          fileTotal: cc.fileTotal,
          perFunction: Object.fromEntries(cc.perFunction),
        },
      };

      if (input.className) {
        const lcom4 = await calculateLCOM4(input.source, input.className);
        result.lcom4 = {
          value: lcom4.value,
          components: lcom4.components,
          methodCount: lcom4.methodCount,
          fieldCount: lcom4.fieldCount,
        };
      }

      return result;
    }
  }
}
