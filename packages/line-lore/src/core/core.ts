import { isAstAvailable } from '../ast/index.js';
import { checkGitHealth } from '../git/health.js';
import { detectPlatformAdapter } from '../platform/index.js';
import type {
  AuthStatus,
  FeatureFlags,
  GitExecOptions,
  HealthReport,
  OperatingLevel,
  PlatformAdapter,
  TraceNode,
  TraceOptions,
} from '../types/index.js';
import { parseLineRange } from '../utils/line-range.js';

import { traceByAst } from './ast-diff/index.js';
import { analyzeBlameResults, executeBlame } from './blame/index.js';
import { lookupPR } from './pr-lookup/index.js';

export interface TraceFullResult {
  nodes: TraceNode[];
  operatingLevel: OperatingLevel;
  featureFlags: FeatureFlags;
  warnings: string[];
}

export async function trace(options: TraceOptions): Promise<TraceFullResult> {
  const warnings: string[] = [];
  const nodes: TraceNode[] = [];

  const execOptions: GitExecOptions = { cwd: undefined };

  // Detect platform and operating level
  let adapter: PlatformAdapter | null = null;
  let operatingLevel: OperatingLevel = 0;

  // Stage 1: Platform detection (local git operation — must complete before auth)
  try {
    const { adapter: detectedAdapter } = await detectPlatformAdapter({
      remoteName: options.remote,
    });
    adapter = detectedAdapter;
  } catch {
    operatingLevel = 0;
    warnings.push('Could not detect platform. Running in Level 0 (git only).');
  }

  // Stage 2: Auth check + Blame run in parallel (independent operations)
  const lineRange = parseLineRange(
    options.endLine ? `${options.line},${options.endLine}` : `${options.line}`,
  );

  const blameChain = executeBlame(options.file, lineRange, execOptions).then(
    (results) => analyzeBlameResults(results, execOptions),
  );

  const [authResult, blameResult] = await Promise.allSettled([
    adapter
      ? adapter.checkAuth()
      : Promise.resolve({ authenticated: false } as AuthStatus),
    blameChain,
  ]);

  // Determine operating level from auth result
  if (adapter && authResult.status === 'fulfilled') {
    if (authResult.value.authenticated) {
      operatingLevel = 2;
    } else {
      operatingLevel = 1;
      warnings.push(
        'Platform CLI not authenticated. Running in Level 1 (local only).',
      );
    }
  }

  // Extract blame results (rethrow if blame failed — it's critical)
  if (blameResult.status === 'rejected') {
    throw blameResult.reason;
  }
  const analyzed = blameResult.value;

  const featureFlags: FeatureFlags = {
    astDiff: isAstAvailable() && !options.noAst,
    deepTrace: operatingLevel === 2 && (options.deep ?? false),
    commitGraph: false,
    issueGraph: operatingLevel === 2 && (options.graphDepth ?? 0) > 0,
    graphql: operatingLevel === 2,
  };

  for (const entry of analyzed) {
    const commitNode: TraceNode = {
      type: entry.isCosmetic ? 'cosmetic_commit' : 'original_commit',
      sha: entry.blame.commitHash,
      trackingMethod: 'blame-CMw',
      confidence: 'exact',
      note: entry.cosmeticReason
        ? `Cosmetic change: ${entry.cosmeticReason}`
        : undefined,
    };
    nodes.push(commitNode);

    // Stage 1-B: AST trace for cosmetic commits
    if (entry.isCosmetic && featureFlags.astDiff) {
      const astResult = await traceByAst(
        options.file,
        options.line,
        entry.blame.commitHash,
        execOptions,
      );

      if (astResult) {
        nodes.push({
          type: 'original_commit',
          sha: astResult.originSha,
          trackingMethod: 'ast-signature',
          confidence: astResult.confidence,
        });
      }
    }

    // Stage 2-4: Commit → PR
    const targetSha = nodes[nodes.length - 1].sha;
    if (targetSha) {
      const prInfo = await lookupPR(targetSha, adapter, execOptions);
      if (prInfo) {
        nodes.push({
          type: 'pull_request',
          sha: prInfo.mergeCommit,
          trackingMethod: prInfo.url ? 'api' : 'message-parse',
          confidence: prInfo.url ? 'exact' : 'heuristic',
          prNumber: prInfo.number,
          prUrl: prInfo.url || undefined,
          prTitle: prInfo.title || undefined,
          mergedAt: prInfo.mergedAt,
        });
      }
    }
  }

  return { nodes, operatingLevel, featureFlags, warnings };
}

export async function health(options?: {
  cwd?: string;
}): Promise<HealthReport & { operatingLevel: OperatingLevel }> {
  const healthReport = await checkGitHealth(options);

  let operatingLevel: OperatingLevel = 0;
  try {
    const { adapter } = await detectPlatformAdapter({ cwd: options?.cwd });
    const auth = await adapter.checkAuth();
    operatingLevel = auth.authenticated ? 2 : 1;
  } catch {
    operatingLevel = 0;
  }

  return { ...healthReport, operatingLevel };
}

export async function clearCache(): Promise<void> {
  const { resetPRCache } = await import('./pr-lookup/index.js');
  const { resetPatchIdCache } = await import('./patch-id/index.js');
  resetPRCache();
  resetPatchIdCache();
}
