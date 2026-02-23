import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { VERSION } from '../version.js';

import { handleAstAnalyze } from './tools/ast-analyze.js';
import { handleAstGrepReplace } from './tools/ast-grep-replace.js';
import { handleAstGrepSearch } from './tools/ast-grep-search.js';
import { SUPPORTED_LANGUAGES } from './tools/ast-grep-shared.js';
import { handleCacheManage } from './tools/cache-manage.js';
import { handleDebtManage } from './tools/debt-manage.js';
import { handleDocCompress } from './tools/doc-compress.js';
import { handleDriftDetect } from './tools/drift-detect.js';
import { handleFractalNavigate } from './tools/fractal-navigate.js';
import { handleFractalScan } from './tools/fractal-scan.js';
import { handleLcaResolve } from './tools/lca-resolve.js';
import { handleReviewManage } from './tools/review-manage.js';
import { handleRuleQuery } from './tools/rule-query.js';
import { handleStructureValidate } from './tools/structure-validate.js';
import { handleTestMetrics } from './tools/test-metrics.js';

/** JSON.stringify replacer that converts Map/Set to plain objects/arrays */
function mapReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Map) {
    return Object.fromEntries(value);
  }
  if (value instanceof Set) {
    return [...value];
  }
  return value;
}

function toolResult(result: unknown) {
  return {
    content: [
      { type: 'text' as const, text: JSON.stringify(result, mapReplacer, 2) },
    ],
  };
}

function toolError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: 'text' as const, text: `Error: ${message}` }],
    isError: true as const,
  };
}

/**
 * Create and configure the FCA-AI MCP server.
 */
export function createServer(): McpServer {
  const server = new McpServer({ name: 'filid', version: VERSION });

  server.registerTool(
    'ast_analyze',
    {
      description:
        'Analyze TypeScript/JavaScript source code AST. Extract dependencies, calculate LCOM4, cyclomatic complexity, or compute semantic diffs.',
      inputSchema: z.object({
        source: z.string().describe('Source code to analyze'),
        filePath: z.string().describe('Virtual file path').optional(),
        analysisType: z
          .enum([
            'dependency-graph',
            'lcom4',
            'cyclomatic-complexity',
            'tree-diff',
            'full',
          ])
          .describe('Type of analysis to perform'),
        className: z
          .string()
          .describe('Class name (required for lcom4)')
          .optional(),
        oldSource: z
          .string()
          .describe('Old source code (for tree-diff)')
          .optional(),
      }),
    },
    async (args) => {
      try {
        const result = await handleAstAnalyze(args);
        return toolResult(result);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'fractal_navigate',
    {
      description:
        'Navigate the FCA-AI fractal tree structure. Classify directories as fractal/organ, list siblings, or build the full tree.',
      inputSchema: z.object({
        action: z
          .enum(['classify', 'sibling-list', 'tree'])
          .describe('Action to perform'),
        path: z.string().describe('Target path'),
        entries: z
          .array(
            z.object({
              name: z.string(),
              path: z.string(),
              type: z.enum([
                'fractal',
                'organ',
                'pure-function',
                'hybrid',
                'directory',
              ]),
              hasClaudeMd: z.boolean(),
              hasSpecMd: z.boolean(),
              hasIndex: z.boolean().optional(),
              hasMain: z.boolean().optional(),
            }),
          )
          .describe('Directory/file entries for tree construction'),
      }),
    },
    async (args) => {
      try {
        // 'directory' is accepted as input and resolved via classifyNode() inside the handler
        const result = await handleFractalNavigate(
          args as Parameters<typeof handleFractalNavigate>[0],
        );
        return toolResult(result);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'doc_compress',
    {
      description:
        'Compress documents for context management. Supports reversible (file reference), lossy (tool call summary), or auto mode.',
      inputSchema: z.object({
        mode: z
          .enum(['reversible', 'lossy', 'auto'])
          .describe('Compression mode'),
        filePath: z.string().describe('File path (for reversible)').optional(),
        content: z
          .string()
          .describe('File content (for reversible)')
          .optional(),
        exports: z
          .array(z.string())
          .describe('Exported symbols (for reversible)')
          .optional(),
        toolCallEntries: z
          .array(
            z.object({
              tool: z.string(),
              path: z.string(),
              timestamp: z.string(),
            }),
          )
          .describe('Tool call entries (for lossy)')
          .optional(),
      }),
    },
    async (args) => {
      try {
        const result = await handleDocCompress(args);
        return toolResult(result);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'test_metrics',
    {
      description:
        'Analyze test metrics. Count test cases, check 3+12 rule violations, or run the decision tree for module actions.',
      inputSchema: z.object({
        action: z
          .enum(['count', 'check-312', 'decide'])
          .describe('Action to perform'),
        files: z
          .array(
            z.object({
              filePath: z.string(),
              content: z.string(),
            }),
          )
          .describe('Test files (for count/check-312)')
          .optional(),
        decisionInput: z
          .object({
            testCount: z.number(),
            lcom4: z.number(),
            cyclomaticComplexity: z.number(),
          })
          .describe('Decision parameters (for decide)')
          .optional(),
      }),
    },
    async (args) => {
      try {
        const result = await handleTestMetrics(args);
        return toolResult(result);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'fractal_scan',
    {
      description:
        '프로젝트 디렉토리를 스캔하여 프랙탈 구조 트리(FractalTree)를 분석하고 ScanReport를 반환한다. ' +
        '각 디렉토리 노드를 fractal/organ/pure-function/hybrid로 분류하며, ' +
        'includeModuleInfo=true 설정 시 각 모듈의 진입점(index.ts, main.ts) 정보를 포함한다.',
      inputSchema: z.object({
        path: z.string().describe('스캔할 프로젝트 루트 디렉토리의 절대 경로'),
        depth: z
          .number()
          .min(1)
          .max(20)
          .describe('스캔할 최대 디렉토리 깊이. 기본값: 10')
          .optional(),
        includeModuleInfo: z
          .boolean()
          .describe('모듈 진입점 분석 결과 포함 여부. 기본값: false')
          .optional(),
      }),
    },
    async (args) => {
      try {
        const result = await handleFractalScan(args);
        return toolResult(result);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'drift_detect',
    {
      description:
        '현재 프로젝트 구조와 filid 프랙탈 구조 규칙 사이의 이격(drift)을 감지한다. ' +
        '각 이격 항목에는 기대값, 실제값, severity(critical/high/medium/low), ' +
        '보정 액션 제안(SyncAction)이 포함된다. ' +
        'generatePlan=true 시 이격 해소를 위한 SyncPlan을 함께 생성한다.',
      inputSchema: z.object({
        path: z
          .string()
          .describe('이격을 검사할 프로젝트 루트 디렉토리의 절대 경로'),
        severity: z
          .enum(['critical', 'high', 'medium', 'low'])
          .describe(
            '이 severity 이상의 이격만 반환. 생략 시 모든 severity 반환',
          )
          .optional(),
        generatePlan: z
          .boolean()
          .describe('이격 해소 SyncPlan 생성 여부. 기본값: false')
          .optional(),
      }),
    },
    async (args) => {
      try {
        const result = await handleDriftDetect(args);
        return toolResult(result);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'lca_resolve',
    {
      description:
        '두 모듈의 Lowest Common Ancestor(LCA)를 프랙탈 트리에서 계산한다. ' +
        '새로운 공유 의존성을 어느 레이어에 배치해야 하는지 결정할 때 사용한다. ' +
        '각 모듈에서 LCA까지의 거리와 권장 배치 경로(suggestedPlacement)를 반환한다.',
      inputSchema: z.object({
        path: z.string().describe('프로젝트 루트 디렉토리의 절대 경로'),
        moduleA: z
          .string()
          .describe(
            '첫 번째 모듈의 프로젝트 루트 기준 상대 경로 (예: src/features/auth)',
          ),
        moduleB: z
          .string()
          .describe(
            '두 번째 모듈의 프로젝트 루트 기준 상대 경로 (예: src/features/payment)',
          ),
      }),
    },
    async (args) => {
      try {
        const result = await handleLcaResolve(args);
        return toolResult(result);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'rule_query',
    {
      description:
        '현재 프로젝트에 적용되는 filid 프랙탈 구조 규칙을 조회하거나, 특정 경로의 규칙 준수 여부를 확인한다. ' +
        "action='list'는 전체 규칙 목록, " +
        "action='get'은 특정 규칙 상세 정보, " +
        "action='check'는 경로의 규칙 평가 결과를 반환한다.",
      inputSchema: z.object({
        action: z
          .enum(['list', 'get', 'check'])
          .describe("수행할 동작: 'list' | 'get' | 'check'"),
        path: z.string().describe('프로젝트 루트 디렉토리의 절대 경로'),
        ruleId: z
          .string()
          .describe("action='get'일 때 조회할 규칙 ID")
          .optional(),
        category: z
          .enum([
            'naming',
            'structure',
            'dependency',
            'documentation',
            'index',
            'module',
          ])
          .describe("action='list'일 때 카테고리 필터")
          .optional(),
        targetPath: z
          .string()
          .describe(
            "action='check'일 때 검사 대상 경로 (프로젝트 루트 기준 상대 경로)",
          )
          .optional(),
      }),
    },
    async (args) => {
      try {
        const result = await handleRuleQuery(args);
        return toolResult(result);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'structure_validate',
    {
      description:
        '프로젝트 전체 또는 특정 규칙 집합에 대해 프랙탈 구조 유효성을 종합 검증한다. ' +
        '위반 항목 목록과 통과/실패/경고 수를 반환한다. ' +
        'fix=true 설정 시 safe 등급의 위반 항목을 자동으로 수정하고 잔여 위반 항목을 재보고한다.',
      inputSchema: z.object({
        path: z.string().describe('검증할 프로젝트 루트 디렉토리의 절대 경로'),
        rules: z
          .array(z.string())
          .describe('검사할 규칙 ID 목록. 생략 시 모든 활성 규칙 검사')
          .optional(),
        fix: z
          .boolean()
          .describe(
            'safe 등급 위반 항목 자동 수정 여부. 기본값: false (현재 미구현 — 향후 지원 예정)',
          )
          .optional(),
      }),
    },
    async (args) => {
      try {
        const result = await handleStructureValidate(args);
        return toolResult(result);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'review_manage',
    {
      description:
        '코드 리뷰 거버넌스 세션을 관리한다. ' +
        "action='normalize-branch': 브랜치명을 파일시스템 안전 문자열로 변환. " +
        "action='ensure-dir': 리뷰 디렉토리 생성(.filid/review/<normalized>). " +
        "action='checkpoint': 리뷰 진행 단계(A/B/C/DONE) 감지. " +
        "action='elect-committee': 변경 복잡도 기반 위원회 선출. " +
        "action='cleanup': 리뷰 디렉토리 삭제.",
      inputSchema: z.object({
        action: z
          .enum([
            'normalize-branch',
            'ensure-dir',
            'checkpoint',
            'elect-committee',
            'cleanup',
          ])
          .describe('수행할 동작'),
        projectRoot: z.string().describe('프로젝트 루트 디렉토리 절대 경로'),
        branchName: z
          .string()
          .describe(
            'normalize-branch / ensure-dir / checkpoint / cleanup 액션에서 사용할 브랜치명',
          )
          .optional(),
        changedFilesCount: z
          .number()
          .describe('elect-committee 액션에서 사용할 변경 파일 수')
          .optional(),
        changedFractalsCount: z
          .number()
          .describe('elect-committee 액션에서 사용할 변경 프랙탈 수')
          .optional(),
        hasInterfaceChanges: z
          .boolean()
          .describe('elect-committee 액션에서 사용할 인터페이스 변경 여부')
          .optional(),
      }),
    },
    async (args) => {
      try {
        const result = await handleReviewManage(args);
        return toolResult(result);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'debt_manage',
    {
      description:
        '기술 부채 항목을 관리한다. ' +
        "action='create': 새 부채 항목을 .filid/debt/<id>.md 파일로 생성. " +
        "action='list': 부채 목록 조회 (fractalPath로 필터 가능). " +
        "action='resolve': 부채 항목 파일 삭제(해결 처리). " +
        "action='calculate-bias': 변경된 프랙탈 경로 기반으로 가중치 재계산 및 바이어스 수준 산출.",
      inputSchema: z.object({
        action: z
          .enum(['create', 'list', 'resolve', 'calculate-bias'])
          .describe('수행할 동작'),
        projectRoot: z.string().describe('프로젝트 루트 디렉토리 절대 경로'),
        debtItem: z
          .object({
            fractal_path: z.string(),
            file_path: z.string(),
            created_at: z.string(),
            review_branch: z.string(),
            original_fix_id: z.string(),
            severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
            rule_violated: z.string(),
            metric_value: z.string(),
            title: z.string(),
            original_request: z.string(),
            developer_justification: z.string(),
            refined_adr: z.string(),
          })
          .describe("action='create'일 때 생성할 부채 항목")
          .optional(),
        fractalPath: z
          .string()
          .describe("action='list'일 때 필터링할 프랙탈 경로")
          .optional(),
        debtId: z
          .string()
          .describe("action='resolve'일 때 삭제할 부채 ID")
          .optional(),
        debts: z
          .array(
            z.object({
              id: z.string(),
              fractal_path: z.string(),
              file_path: z.string(),
              created_at: z.string(),
              review_branch: z.string(),
              original_fix_id: z.string(),
              severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
              weight: z.number(),
              touch_count: z.number(),
              last_review_commit: z.string().nullable(),
              rule_violated: z.string(),
              metric_value: z.string(),
              title: z.string(),
              original_request: z.string(),
              developer_justification: z.string(),
              refined_adr: z.string(),
            }),
          )
          .describe("action='calculate-bias'일 때 평가할 부채 목록")
          .optional(),
        changedFractalPaths: z
          .array(z.string())
          .describe("action='calculate-bias'일 때 변경된 프랙탈 경로 목록")
          .optional(),
        currentCommitSha: z
          .string()
          .describe("action='calculate-bias'일 때 현재 커밋 SHA (멱등성 보호)")
          .optional(),
      }),
    },
    async (args) => {
      try {
        const result = await handleDebtManage(args);
        return toolResult(result);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'cache_manage',
    {
      description:
        'Manage the filid incremental cache. ' +
        "action='compute-hash': compute a project fingerprint hash from source file paths and mtimes. " +
        "action='save-hash': persist a skill run hash to disk for incremental mode. " +
        "action='get-hash': retrieve the last saved run hash for a skill.",
      inputSchema: z.object({
        action: z
          .enum(['compute-hash', 'save-hash', 'get-hash'])
          .describe('Action to perform'),
        cwd: z.string().describe('Project root directory (absolute path)'),
        skillName: z
          .string()
          .describe('Skill identifier (required for save-hash and get-hash)')
          .optional(),
        hash: z
          .string()
          .describe('Hash value to store (required for save-hash)')
          .optional(),
      }),
    },
    async (args) => {
      try {
        const result = await handleCacheManage(args);
        return toolResult(result);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // AST Grep tools — gracefully degrade if @ast-grep/napi is unavailable
  server.registerTool(
    'ast_grep_search',
    {
      description:
        'Search for code patterns using AST matching. More precise than text search.\n\n' +
        'Use meta-variables in patterns:\n' +
        '- $NAME - matches any single AST node (identifier, expression, etc.)\n' +
        '- $$$ARGS - matches multiple nodes (for function arguments, list items, etc.)\n\n' +
        'Examples:\n' +
        '- "function $NAME($$$ARGS)" - find all function declarations\n' +
        '- "console.log($MSG)" - find all console.log calls\n' +
        '- "if ($COND) { $$$BODY }" - find all if statements\n' +
        '- "$X === null" - find null equality checks\n' +
        '- "import $$$IMPORTS from \'$MODULE\'" - find imports',
      inputSchema: z.object({
        pattern: z
          .string()
          .describe('AST pattern with meta-variables ($VAR, $$$VARS)'),
        language: z.enum(SUPPORTED_LANGUAGES).describe('Programming language'),
        path: z
          .string()
          .optional()
          .describe('Directory or file to search (default: current directory)'),
        context: z
          .number()
          .int()
          .min(0)
          .max(10)
          .optional()
          .describe('Lines of context around matches (default: 2)'),
        max_results: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe('Maximum results to return (default: 20)'),
      }),
    },
    async (args) => {
      try {
        const result = await handleAstGrepSearch(args);
        if ('error' in result) {
          return {
            content: [{ type: 'text' as const, text: result.error }],
          };
        }
        return toolResult(result);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'ast_grep_replace',
    {
      description:
        'Replace code patterns using AST matching. Preserves matched content via meta-variables.\n\n' +
        'Use meta-variables in both pattern and replacement:\n' +
        '- $NAME in pattern captures a node, use $NAME in replacement to insert it\n' +
        '- $$$ARGS captures multiple nodes\n\n' +
        'Examples:\n' +
        '- Pattern: "console.log($MSG)" → Replacement: "logger.info($MSG)"\n' +
        '- Pattern: "var $NAME = $VALUE" → Replacement: "const $NAME = $VALUE"\n\n' +
        'IMPORTANT: dry_run=true (default) only previews changes. Set dry_run=false to apply.',
      inputSchema: z.object({
        pattern: z.string().describe('Pattern to match'),
        replacement: z
          .string()
          .describe('Replacement pattern (use same meta-variables)'),
        language: z.enum(SUPPORTED_LANGUAGES).describe('Programming language'),
        path: z
          .string()
          .optional()
          .describe('Directory or file to search (default: current directory)'),
        dry_run: z
          .boolean()
          .optional()
          .describe("Preview only, don't apply changes (default: true)"),
      }),
    },
    async (args) => {
      try {
        const result = await handleAstGrepReplace(args);
        if ('error' in result) {
          return {
            content: [{ type: 'text' as const, text: result.error }],
          };
        }
        return toolResult(result);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  return server;
}

/** Start the MCP server with stdio transport */
export async function startServer(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
