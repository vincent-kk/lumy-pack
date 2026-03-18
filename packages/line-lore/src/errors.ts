export const LineLoreErrorCode = {
  // Existing
  NOT_GIT_REPO: 'NOT_GIT_REPO',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  INVALID_LINE: 'INVALID_LINE',
  GIT_BLAME_FAILED: 'GIT_BLAME_FAILED',
  PR_NOT_FOUND: 'PR_NOT_FOUND',
  UNKNOWN: 'UNKNOWN',
  // Git executor
  GIT_COMMAND_FAILED: 'GIT_COMMAND_FAILED',
  GIT_TIMEOUT: 'GIT_TIMEOUT',
  // Pipeline stages
  ANCESTRY_PATH_FAILED: 'ANCESTRY_PATH_FAILED',
  PATCH_ID_NO_MATCH: 'PATCH_ID_NO_MATCH',
  AST_PARSE_FAILED: 'AST_PARSE_FAILED',
  AST_ENGINE_UNAVAILABLE: 'AST_ENGINE_UNAVAILABLE',
  // Platform
  PLATFORM_UNKNOWN: 'PLATFORM_UNKNOWN',
  CLI_NOT_INSTALLED: 'CLI_NOT_INSTALLED',
  CLI_NOT_AUTHENTICATED: 'CLI_NOT_AUTHENTICATED',
  API_RATE_LIMITED: 'API_RATE_LIMITED',
  API_REQUEST_FAILED: 'API_REQUEST_FAILED',
  GRAPHQL_NOT_SUPPORTED: 'GRAPHQL_NOT_SUPPORTED',
  ENTERPRISE_VERSION_UNSUPPORTED: 'ENTERPRISE_VERSION_UNSUPPORTED',
  // Issue graph
  ISSUE_NOT_FOUND: 'ISSUE_NOT_FOUND',
  GRAPH_DEPTH_EXCEEDED: 'GRAPH_DEPTH_EXCEEDED',
  GRAPH_CYCLE_DETECTED: 'GRAPH_CYCLE_DETECTED',
  // Cache
  CACHE_CORRUPTED: 'CACHE_CORRUPTED',
  // Remote
  INVALID_REMOTE_URL: 'INVALID_REMOTE_URL',
} as const;

export type LineLoreErrorCode =
  (typeof LineLoreErrorCode)[keyof typeof LineLoreErrorCode];

export class LineLoreError extends Error {
  readonly code: LineLoreErrorCode;
  readonly context?: Record<string, unknown>;

  constructor(
    code: LineLoreErrorCode,
    message: string,
    context?: Record<string, unknown>,
  ) {
    super(message);
    this.code = code;
    this.context = context;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
