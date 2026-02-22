import { scanProject } from '../../core/fractal-tree.js';
import { analyzeModule } from '../../core/module-main-analyzer.js';
import type { FractalTree, ModuleInfo } from '../../types/fractal.js';
import type { ScanReport } from '../../types/report.js';

export interface FractalScanInput {
  path: string;
  depth?: number;
  includeModuleInfo?: boolean;
}

/**
 * Handle fractal-scan MCP tool calls.
 *
 * Scans a project directory to build a FractalTree, classifying each
 * directory node as fractal / organ / pure-function / hybrid.
 * When includeModuleInfo is true, also analyses each node's entry points.
 */
export async function handleFractalScan(args: unknown): Promise<ScanReport> {
  const input = args as FractalScanInput;

  if (!input.path) {
    throw new Error('path is required');
  }

  const startTime = Date.now();

  const tree: FractalTree = await scanProject(input.path, {
    maxDepth: input.depth ?? 10,
  });

  let modules: ModuleInfo[] = [];
  if (input.includeModuleInfo) {
    const nodePaths = Array.from(tree.nodes.keys());
    const results = await Promise.allSettled(
      nodePaths.map((nodePath) => analyzeModule(nodePath)),
    );
    modules = results
      .filter(
        (r): r is PromiseFulfilledResult<ModuleInfo> =>
          r.status === 'fulfilled',
      )
      .map((r) => r.value);
  }

  return {
    tree,
    modules,
    timestamp: new Date().toISOString(),
    duration: Date.now() - startTime,
  };
}
