import { map } from '@winglet/common-utils';

import { isAstAvailable } from '../ast/index.js';
import { LineLoreError, LineLoreErrorCode } from '../errors.js';
import { checkGitHealth } from '../git/health.js';
import { detectPlatformAdapter } from '../platform/index.js';
import type {
  AuthStatus,
  FeatureFlags,
  GitExecOptions,
  GraphOptions,
  GraphResult,
  HealthReport,
  OperatingLevel,
  PlatformAdapter,
  TraceNode,
  TraceOptions,
} from '../types/index.js';
import { parseLineRange } from '../utils/line-range.js';

import { traceByAst } from './ast-diff/index.js';
import { analyzeBlameResults, executeBlame } from './blame/index.js';
import { traverseIssueGraph } from './issue-graph/index.js';
import { lookupPR } from './pr-lookup/index.js';

export interface TraceFullResult {
  nodes: TraceNode[];
  operatingLevel: OperatingLevel;
  featureFlags: FeatureFlags;
  warnings: string[];
}

interface PlatformDetectionResult {
  adapter: PlatformAdapter | null;
  operatingLevel: OperatingLevel;
  warnings: string[];
}

interface BlameAndAuthResult {
  analyzed: Awaited<ReturnType<typeof analyzeBlameResults>>;
  operatingLevel: OperatingLevel;
  warnings: string[];
}

function computeFeatureFlags(
  operatingLevel: OperatingLevel,
  options: TraceOptions,
): FeatureFlags {
  return {
    astDiff: isAstAvailable() && !options.noAst,
    deepTrace: operatingLevel === 2 && (options.deep ?? false),
    commitGraph: false,
    graphql: operatingLevel === 2,
  };
}

async function detectPlatform(
  options: TraceOptions,
): Promise<PlatformDetectionResult> {
  const warnings: string[] = [];
  let adapter: PlatformAdapter | null = null;
  let operatingLevel: OperatingLevel = 0;

  try {
    const { adapter: detectedAdapter } = await detectPlatformAdapter({
      remoteName: options.remote,
    });
    adapter = detectedAdapter;
  } catch {
    operatingLevel = 0;
    warnings.push('Could not detect platform. Running in Level 0 (git only).');
  }

  return { adapter, operatingLevel, warnings };
}

async function runBlameAndAuth(
  adapter: PlatformAdapter | null,
  options: TraceOptions,
  execOptions: GitExecOptions,
): Promise<BlameAndAuthResult> {
  const warnings: string[] = [];

  const lineRange = parseLineRange(
    options.endLine ? `${options.line},${options.endLine}` : `${options.line}`,
  );

  const blameChain = executeBlame(options.file, lineRange, execOptions).then(
    (results) => analyzeBlameResults(results, options.file, execOptions),
  );

  const [authResult, blameResult] = await Promise.allSettled([
    adapter
      ? adapter.checkAuth()
      : Promise.resolve({ authenticated: false } as AuthStatus),
    blameChain,
  ]);

  let operatingLevel: OperatingLevel = 0;
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

  if (blameResult.status === 'rejected') {
    throw blameResult.reason;
  }

  return { analyzed: blameResult.value, operatingLevel, warnings };
}

async function processEntry(
  entry: Awaited<ReturnType<typeof analyzeBlameResults>>[number],
  featureFlags: FeatureFlags,
  adapter: PlatformAdapter | null,
  options: TraceOptions,
  execOptions: GitExecOptions,
): Promise<TraceNode[]> {
  const nodes: TraceNode[] = [];

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

  const targetSha = nodes[nodes.length - 1].sha;
  if (targetSha) {
    const prInfo = await lookupPR(targetSha, adapter, {
      ...execOptions,
      noCache: options.noCache,
      deep: featureFlags.deepTrace,
    });
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

  return nodes;
}

async function buildTraceNodes(
  analyzed: Awaited<ReturnType<typeof analyzeBlameResults>>,
  featureFlags: FeatureFlags,
  adapter: PlatformAdapter | null,
  options: TraceOptions,
  execOptions: GitExecOptions,
): Promise<TraceNode[]> {
  const results = await Promise.allSettled(
    map(analyzed, (entry) =>
      processEntry(entry, featureFlags, adapter, options, execOptions),
    ),
  );

  return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
}

export async function trace(options: TraceOptions): Promise<TraceFullResult> {
  const execOptions: GitExecOptions = { cwd: undefined };

  const platform = await detectPlatform(options);
  const blameAuth = await runBlameAndAuth(
    platform.adapter,
    options,
    execOptions,
  );

  const operatingLevel = blameAuth.operatingLevel || platform.operatingLevel;
  const warnings = [...platform.warnings, ...blameAuth.warnings];
  const featureFlags = computeFeatureFlags(operatingLevel, options);

  const nodes = await buildTraceNodes(
    blameAuth.analyzed,
    featureFlags,
    platform.adapter,
    options,
    execOptions,
  );

  return { nodes, operatingLevel, featureFlags, warnings };
}

export async function graph(options: GraphOptions): Promise<GraphResult> {
  const { adapter } = await detectPlatformAdapter({
    remoteName: options.remote,
  });
  const auth = await adapter.checkAuth();
  if (!auth.authenticated) {
    throw new LineLoreError(
      LineLoreErrorCode.CLI_NOT_AUTHENTICATED,
      'Platform CLI is not authenticated. Run "gh auth login" or set the appropriate token.',
    );
  }
  return traverseIssueGraph(adapter, options.type, options.number, {
    maxDepth: options.depth,
  });
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
