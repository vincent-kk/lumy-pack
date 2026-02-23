/**
 * @lumy-pack/filid
 *
 * FCA-AI (Fractal Context Architecture for AI Agents) rule
 * enforcement plugin for Claude Code agent workflows.
 */

// Type exports
export type * from './types/index.js';

// Core modules
export { validateClaudeMd, validateSpecMd } from './core/document-validator.js';
export {
  classifyNode,
  isInfraOrgDirectoryByPattern,
  KNOWN_ORGAN_DIR_NAMES,
} from './core/organ-classifier.js';
export {
  buildFractalTree,
  findNode,
  getAncestors,
  getDescendants,
  getFractalsUnderOrgans,
  scanProject,
  shouldExclude,
} from './core/fractal-tree.js';
export {
  buildDAG,
  topologicalSort,
  detectCycles,
  getDirectDependencies,
} from './core/dependency-graph.js';
export { ChangeQueue } from './core/change-queue.js';
export {
  validateStructure,
  validateNode,
  validateDependencies,
} from './core/fractal-validator.js';
export {
  detectDrift,
  compareCurrent,
  calculateSeverity,
  generateSyncPlan,
} from './core/drift-detector.js';
export {
  analyzeProject,
  calculateHealthScore,
  generateReport,
} from './core/project-analyzer.js';
export {
  loadBuiltinRules,
  evaluateRules,
  evaluateRule,
  getActiveRules,
} from './core/rule-engine.js';
export {
  analyzeModule,
  findEntryPoint,
  extractImports,
  extractPublicApi,
} from './core/module-main-analyzer.js';
export { analyzeIndex, extractModuleExports } from './core/index-analyzer.js';
export {
  findLCA,
  getModulePlacement,
  getAncestorPaths,
} from './core/lca-calculator.js';

// Metrics
export { countTestCases } from './metrics/test-counter.js';
export { check312Rule } from './metrics/three-plus-twelve.js';
export { decide } from './metrics/decision-tree.js';
export { checkPromotionEligibility } from './metrics/promotion-tracker.js';

// Compression
export {
  compactReversible,
  restoreFromCompacted,
} from './compress/reversible-compactor.js';
export { summarizeLossy } from './compress/lossy-summarizer.js';

// AST analysis
export { parseSource, parseFile } from './ast/parser.js';
export { extractDependencies } from './ast/dependency-extractor.js';
export { calculateLCOM4, extractClassInfo } from './ast/lcom4.js';
export { calculateCC } from './ast/cyclomatic-complexity.js';
export { computeTreeDiff } from './ast/tree-diff.js';

// Hooks
export { validatePreToolUse } from './hooks/pre-tool-validator.js';
export { guardStructure } from './hooks/structure-guard.js';
/** @deprecated Disabled in hooks.json. Entry stub uses no-op queue. */
export { trackChange } from './hooks/change-tracker.js';
export { enforceAgentRole } from './hooks/agent-enforcer.js';
export { injectContext } from './hooks/context-injector.js';

// Cache manager
export {
  cwdHash,
  getCacheDir,
  readCachedContext,
  writeCachedContext,
  sessionIdHash,
  isFirstInSession,
  pruneOldSessions,
  removeSessionFiles,
  markSessionInjected,
  saveRunHash,
  getLastRunHash,
} from './core/cache-manager.js';
export { computeProjectHash } from './core/project-hash.js';

// AST Grep tools (pattern matching via @ast-grep/napi)
export { handleAstGrepSearch } from './mcp/tools/ast-grep-search.js';
export { handleAstGrepReplace } from './mcp/tools/ast-grep-replace.js';
export {
  getSgModule,
  getSgLoadError,
  SUPPORTED_LANGUAGES as AST_GREP_LANGUAGES,
  EXT_TO_LANG,
  getFilesForLanguage,
  formatMatch,
  toLangEnum,
} from './ast/ast-grep-shared.js';

// MCP tool handlers
export { handleAstAnalyze } from './mcp/tools/ast-analyze.js';
export { handleFractalNavigate } from './mcp/tools/fractal-navigate.js';
export { handleDocCompress } from './mcp/tools/doc-compress.js';
export { handleTestMetrics } from './mcp/tools/test-metrics.js';
export { handleFractalScan } from './mcp/tools/fractal-scan.js';
export { handleDriftDetect } from './mcp/tools/drift-detect.js';
export { handleLcaResolve } from './mcp/tools/lca-resolve.js';
export { handleRuleQuery } from './mcp/tools/rule-query.js';
export { handleStructureValidate } from './mcp/tools/structure-validate.js';
export { handleReviewManage } from './mcp/tools/review-manage.js';
export { handleDebtManage } from './mcp/tools/debt-manage.js';
export { handleCacheManage } from './mcp/tools/cache-manage.js';

// MCP server
export { createServer, startServer } from './mcp/server.js';
