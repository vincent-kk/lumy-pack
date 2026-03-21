// Public API — Types
export type {
  AstDiffStageResult,
  AstTraceResult,
  AuthStatus,
  BlameResult,
  BlameStageResult,
  CacheEntry,
  ChangeType,
  CommitInfo,
  ComparisonResult,
  Confidence,
  ContentHash,
  CosmeticReason,
  FeatureFlags,
  GraphOptions,
  GraphResult,
  HealthReport,
  IssueInfo,
  LineRange,
  NormalizedResponse,
  OperatingLevel,
  PlatformAdapter,
  PlatformType,
  PRInfo,
  RateLimitInfo,
  RemoteInfo,
  SymbolInfo,
  SymbolKind,
  TraceNode,
  TraceNodeType,
  TraceOptions,
  TraceResult,
  TrackingMethod,
} from './types/index.js';

// Public API — Error handling
export { LineLoreError, LineLoreErrorCode } from './errors.js';

// Public API — Core functions
export { clearCache, graph, health, trace } from './core/core.js';
export type { TraceFullResult } from './core/core.js';

// Public API — Issue graph
export { traverseIssueGraph } from './core/issue-graph/index.js';
export type { GraphTraversalOptions } from './core/issue-graph/index.js';
