export type {
  NodeType,
  FractalNode,
  FractalTree,
  DependencyEdge,
  DependencyDAG,
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
