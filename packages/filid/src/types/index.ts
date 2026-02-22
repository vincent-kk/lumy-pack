export type {
  CategoryType,
  FractalNode,
  FractalTree,
  DependencyEdge,
  DependencyDAG,
  DirEntry,
  ModuleInfo,
  ModuleExportInfo,
  BarrelPattern,
  PublicApi,
} from './fractal.js';

export type {
  ThreeTierBoundary,
  ClaudeMdSchema,
  SpecMdSchema,
  CompressionMeta,
  ClaudeMdValidation,
  SpecMdValidation,
  DocumentViolation,
} from './documents.js';

export type {
  LCOM4Result,
  CyclomaticComplexityResult,
  TestCaseCount,
  ThreePlusTwelveResult,
  DecisionAction,
  DecisionResult,
  PromotionCandidate,
} from './metrics.js';

export type {
  HookBaseInput,
  PreToolUseInput,
  PostToolUseInput,
  SubagentStartInput,
  UserPromptSubmitInput,
  HookOutput,
  HookInput,
  StructureGuardOutput,
  FractalContextSummary,
} from './hooks.js';

export type {
  ImportInfo,
  ExportInfo,
  CallInfo,
  DependencyInfo,
  MethodInfo,
  ClassInfo,
  TreeDiffChange,
  TreeDiffResult,
} from './ast.js';

export type {
  RuleSeverity,
  RuleCategory,
  RuleContext,
  RuleViolation,
  Rule,
  RuleSet,
  RuleEvaluationResult,
  BuiltinRuleId,
} from './rules.js';
export { BUILTIN_RULE_IDS } from './rules.js';

export type { ScanOptions } from './scan.js';
export { DEFAULT_SCAN_OPTIONS } from './scan.js';

export type {
  DriftSeverity,
  SyncAction,
  DriftItem,
  DriftResult,
  SyncPlanAction,
  SyncPlan,
  DetectDriftOptions,
} from './drift.js';

export type {
  ScanReport,
  ValidationReport,
  DriftReport,
  AnalysisReport,
  AnalyzeOptions,
  RenderedReport,
} from './report.js';

export type {
  Complexity,
  PersonaId,
  CheckpointPhase,
  CheckpointStatus,
  CommitteeElection,
  ReviewSession,
  StateMachineState,
  ReviewVerdict,
} from './review.js';

export type {
  DebtSeverity,
  BiasLevel,
  DebtItem,
  DebtItemCreate,
  BiasResult,
} from './debt.js';
export { DEBT_WEIGHT_CAP, DEBT_BASE_WEIGHT } from './debt.js';
