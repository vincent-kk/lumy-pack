import { createHash } from 'node:crypto';
import { dirname, isAbsolute, relative } from 'node:path';

import { map } from '@winglet/common-utils';

import { isAstAvailable } from '../ast/index.js';
import type { RepoIdentity } from '../cache/index.js';
import { cleanupLegacyCache } from '../cache/index.js';
import { LineLoreError, LineLoreErrorCode } from '../errors.js';
import { gitExec } from '../git/executor.js';
import { checkCloneStatus, checkGitHealth } from '../git/health.js';
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
  RemoteInfo,
  TraceNode,
  TraceOptions,
} from '../types/index.js';
import type { Confidence, TrackingMethod } from '../types/index.js';
import { parseLineRange } from '../utils/line-range.js';

import { traceByAst } from './ast-diff/index.js';
import { analyzeBlameResults, executeBlame } from './blame/index.js';
import { traverseIssueGraph } from './issue-graph/index.js';
import type { ResolvedVia } from './pr-lookup/index.js';
import { lookupPR } from './pr-lookup/index.js';

export interface TraceFullResult {
  nodes: TraceNode[];
  operatingLevel: OperatingLevel;
  featureFlags: FeatureFlags;
  warnings: string[];
}

interface PlatformDetectionResult {
  adapter: PlatformAdapter | null;
  remote: RemoteInfo | null;
  operatingLevel: OperatingLevel;
  warnings: string[];
}

interface BlameAndAuthResult {
  analyzed: Awaited<ReturnType<typeof analyzeBlameResults>>;
  operatingLevel: OperatingLevel;
  warnings: string[];
}

function resolvedViaToTrackingMethod(resolvedVia: ResolvedVia): TrackingMethod {
  switch (resolvedVia) {
    case 'api':
      return 'api';
    case 'ancestry':
      return 'ancestry-path';
    case 'message':
      return 'message-parse';
    case 'patch-id':
      return 'patch-id';
  }
}

function resolvedViaToConfidence(resolvedVia: ResolvedVia): Confidence {
  switch (resolvedVia) {
    case 'api':
    case 'ancestry':
      return 'exact';
    case 'message':
    case 'patch-id':
      return 'heuristic';
  }
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

async function resolveRepoIdentity(cwd?: string): Promise<RepoIdentity> {
  try {
    const result = await gitExec(['rev-parse', '--show-toplevel'], { cwd });
    const hash = createHash('sha256')
      .update(result.stdout.trim())
      .digest('hex')
      .slice(0, 16);
    return { host: '_local', owner: '_', repo: hash };
  } catch {
    return { host: '_local', owner: '_', repo: '_unknown' };
  }
}

async function resolveFileContext(
  file: string,
  cwd?: string,
): Promise<{ file: string; cwd?: string }> {
  if (cwd || !isAbsolute(file)) return { file, cwd };

  const fileDir = dirname(file);

  try {
    const result = await gitExec(['rev-parse', '--show-toplevel'], {
      cwd: fileDir,
    });
    const repoRoot = result.stdout.trim();
    return {
      file: relative(repoRoot, file),
      cwd: repoRoot,
    };
  } catch {
    return { file, cwd };
  }
}

async function detectPlatform(
  options: TraceOptions,
): Promise<PlatformDetectionResult> {
  const warnings: string[] = [];
  let adapter: PlatformAdapter | null = null;
  let remote: RemoteInfo | null = null;
  let operatingLevel: OperatingLevel = 0;

  try {
    const detected = await detectPlatformAdapter({
      remoteName: options.remote,
      cwd: options.cwd,
    });
    adapter = detected.adapter;
    remote = detected.remote;
  } catch {
    operatingLevel = 0;
    warnings.push('Could not detect platform. Running in Level 0 (git only).');
  }

  return { adapter, remote, operatingLevel, warnings };
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
  repoId: RepoIdentity,
  skipPatchIdScan?: boolean,
  preferredBase?: string,
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
      cacheOnly: options.cacheOnly,
      deep: featureFlags.deepTrace,
      repoId,
      skipPatchIdScan,
      preferredBase,
      platform: adapter?.platform,
    });
    if (prInfo) {
      nodes.push({
        type: 'pull_request',
        sha: prInfo.mergeCommit,
        trackingMethod: resolvedViaToTrackingMethod(prInfo.resolvedVia),
        confidence: resolvedViaToConfidence(prInfo.resolvedVia),
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
  repoId: RepoIdentity,
  skipPatchIdScan?: boolean,
  preferredBase?: string,
): Promise<TraceNode[]> {
  const results = await Promise.allSettled(
    map(analyzed, (entry) =>
      processEntry(
        entry,
        featureFlags,
        adapter,
        options,
        execOptions,
        repoId,
        skipPatchIdScan,
        preferredBase,
      ),
    ),
  );

  return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
}

let legacyCacheCleaned = false;

export async function trace(options: TraceOptions): Promise<TraceFullResult> {
  const { file, cwd } = await resolveFileContext(options.file, options.cwd);
  const warnings: string[] = [];
  const execOptions: GitExecOptions = { cwd, warnings };

  if (!legacyCacheCleaned) {
    legacyCacheCleaned = true;
    cleanupLegacyCache().catch(() => {});
  }

  const platform = await detectPlatform({ ...options, cwd });

  let repoId: RepoIdentity;
  if (platform.remote) {
    repoId = {
      host: platform.remote.host,
      owner: platform.remote.owner,
      repo: platform.remote.repo,
    };
  } else {
    repoId = await resolveRepoIdentity(cwd);
  }

  const blameAuth = await runBlameAndAuth(
    platform.adapter,
    { ...options, file, cwd },
    execOptions,
  );

  const operatingLevel = blameAuth.operatingLevel || platform.operatingLevel;
  warnings.push(...platform.warnings, ...blameAuth.warnings);

  if (options.cacheOnly && options.noCache) {
    warnings.push(
      'Both cacheOnly and noCache are set. cacheOnly takes precedence — cache reads are enabled.',
    );
  }
  const featureFlags = computeFeatureFlags(operatingLevel, options);

  let cloneStatus = { partialClone: false, shallow: false };
  try {
    const result = await checkCloneStatus({ cwd });
    if (result) cloneStatus = result;
  } catch {
    // Ignore — defaults are safe
  }
  if (cloneStatus.partialClone) {
    warnings.push(
      'Partial clone detected. Patch-ID scan (Strategy 5) will be skipped to avoid blob downloads.',
    );
  }
  if (cloneStatus.shallow) {
    warnings.push(
      'Shallow repository detected. Ancestry-path results may be incomplete.',
    );
  }

  // Detect current branch for PR selection context (once per trace call)
  let preferredBase: string | undefined;
  try {
    const branchResult = await gitExec(
      ['rev-parse', '--abbrev-ref', 'HEAD'],
      execOptions,
    );
    const branch = branchResult.stdout.trim();
    if (branch && branch !== 'HEAD') {
      preferredBase = branch;
    }
  } catch {
    // Detached HEAD or git failure — preferredBase stays undefined (oldest PR fallback)
  }

  const nodes = await buildTraceNodes(
    blameAuth.analyzed,
    featureFlags,
    platform.adapter,
    { ...options, file, cwd },
    execOptions,
    repoId,
    cloneStatus.partialClone || undefined,
    preferredBase,
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
  const { rm } = await import('node:fs/promises');
  const { homedir } = await import('node:os');
  const { join } = await import('node:path');
  const { resetPRCache } = await import('./pr-lookup/index.js');
  const { resetPatchIdCache } = await import('./patch-id/index.js');
  resetPRCache();
  resetPatchIdCache();
  try {
    await rm(join(homedir(), '.line-lore', 'cache'), {
      recursive: true,
      force: true,
    });
  } catch {
    // ignored
  }
}
