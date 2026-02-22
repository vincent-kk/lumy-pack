import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { handleAstAnalyze } from './tools/ast-analyze.js';
import { handleFractalNavigate } from './tools/fractal-navigate.js';
import { handleDocCompress } from './tools/doc-compress.js';
import { handleTestMetrics } from './tools/test-metrics.js';
import { handleFractalScan } from './tools/fractal-scan.js';
import { handleDriftDetect } from './tools/drift-detect.js';
import { handleLcaResolve } from './tools/lca-resolve.js';
import { handleRuleQuery } from './tools/rule-query.js';
import { handleStructureValidate } from './tools/structure-validate.js';

const TOOL_DEFINITIONS = [
  {
    name: 'ast-analyze',
    description:
      'Analyze TypeScript/JavaScript source code AST. Extract dependencies, calculate LCOM4, cyclomatic complexity, or compute semantic diffs.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        source: { type: 'string', description: 'Source code to analyze' },
        filePath: { type: 'string', description: 'Virtual file path' },
        analysisType: {
          type: 'string',
          enum: ['dependency-graph', 'lcom4', 'cyclomatic-complexity', 'tree-diff', 'full'],
          description: 'Type of analysis to perform',
        },
        className: { type: 'string', description: 'Class name (required for lcom4)' },
        oldSource: { type: 'string', description: 'Old source code (for tree-diff)' },
      },
      required: ['source', 'analysisType'],
    },
  },
  {
    name: 'fractal-navigate',
    description:
      'Navigate the FCA-AI fractal tree structure. Classify directories as fractal/organ, list siblings, or build the full tree.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        action: {
          type: 'string',
          enum: ['classify', 'sibling-list', 'tree'],
          description: 'Action to perform',
        },
        path: { type: 'string', description: 'Target path' },
        entries: {
          type: 'array',
          description: 'Directory/file entries for tree construction',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              path: { type: 'string' },
              type: { type: 'string', enum: ['directory', 'file', 'organ', 'pure-function'] },
              hasClaudeMd: { type: 'boolean' },
              hasSpecMd: { type: 'boolean' },
            },
            required: ['name', 'path', 'type', 'hasClaudeMd', 'hasSpecMd'],
          },
        },
      },
      required: ['action', 'path', 'entries'],
    },
  },
  {
    name: 'doc-compress',
    description:
      'Compress documents for context management. Supports reversible (file reference), lossy (tool call summary), or auto mode.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        mode: {
          type: 'string',
          enum: ['reversible', 'lossy', 'auto'],
          description: 'Compression mode',
        },
        filePath: { type: 'string', description: 'File path (for reversible)' },
        content: { type: 'string', description: 'File content (for reversible)' },
        exports: {
          type: 'array',
          items: { type: 'string' },
          description: 'Exported symbols (for reversible)',
        },
        toolCallEntries: {
          type: 'array',
          description: 'Tool call entries (for lossy)',
          items: {
            type: 'object',
            properties: {
              tool: { type: 'string' },
              path: { type: 'string' },
              timestamp: { type: 'string' },
            },
            required: ['tool', 'path', 'timestamp'],
          },
        },
      },
      required: ['mode'],
    },
  },
  {
    name: 'test-metrics',
    description:
      'Analyze test metrics. Count test cases, check 3+12 rule violations, or run the decision tree for module actions.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        action: {
          type: 'string',
          enum: ['count', 'check-312', 'decide'],
          description: 'Action to perform',
        },
        files: {
          type: 'array',
          description: 'Test files (for count/check-312)',
          items: {
            type: 'object',
            properties: {
              filePath: { type: 'string' },
              content: { type: 'string' },
            },
            required: ['filePath', 'content'],
          },
        },
        decisionInput: {
          type: 'object',
          description: 'Decision parameters (for decide)',
          properties: {
            testCount: { type: 'number' },
            lcom4: { type: 'number' },
            cyclomaticComplexity: { type: 'number' },
          },
          required: ['testCount', 'lcom4', 'cyclomaticComplexity'],
        },
      },
      required: ['action'],
    },
  },
  {
    name: 'fractal-scan',
    description:
      '프로젝트 디렉토리를 스캔하여 프랙탈 구조 트리(FractalTree)를 분석하고 ScanReport를 반환한다. ' +
      '각 디렉토리 노드를 fractal/organ/pure-function/hybrid로 분류하며, ' +
      'includeModuleInfo=true 설정 시 각 모듈의 진입점(index.ts, main.ts) 정보를 포함한다.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: '스캔할 프로젝트 루트 디렉토리의 절대 경로',
        },
        depth: {
          type: 'number',
          description: '스캔할 최대 디렉토리 깊이. 기본값: 10',
          minimum: 1,
          maximum: 20,
        },
        includeModuleInfo: {
          type: 'boolean',
          description: '모듈 진입점 분석 결과 포함 여부. 기본값: false',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'drift-detect',
    description:
      '현재 프로젝트 구조와 filid 프랙탈 구조 규칙 사이의 이격(drift)을 감지한다. ' +
      '각 이격 항목에는 기대값, 실제값, severity(critical/high/medium/low), ' +
      '보정 액션 제안(SyncAction)이 포함된다. ' +
      'generatePlan=true 시 이격 해소를 위한 SyncPlan을 함께 생성한다.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: '이격을 검사할 프로젝트 루트 디렉토리의 절대 경로',
        },
        severity: {
          type: 'string',
          enum: ['critical', 'high', 'medium', 'low'],
          description: '이 severity 이상의 이격만 반환. 생략 시 모든 severity 반환',
        },
        generatePlan: {
          type: 'boolean',
          description: '이격 해소 SyncPlan 생성 여부. 기본값: false',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'lca-resolve',
    description:
      '두 모듈의 Lowest Common Ancestor(LCA)를 프랙탈 트리에서 계산한다. ' +
      '새로운 공유 의존성을 어느 레이어에 배치해야 하는지 결정할 때 사용한다. ' +
      '각 모듈에서 LCA까지의 거리와 권장 배치 경로(suggestedPlacement)를 반환한다.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: '프로젝트 루트 디렉토리의 절대 경로',
        },
        moduleA: {
          type: 'string',
          description: '첫 번째 모듈의 프로젝트 루트 기준 상대 경로 (예: src/features/auth)',
        },
        moduleB: {
          type: 'string',
          description: '두 번째 모듈의 프로젝트 루트 기준 상대 경로 (예: src/features/payment)',
        },
      },
      required: ['path', 'moduleA', 'moduleB'],
    },
  },
  {
    name: 'rule-query',
    description:
      '현재 프로젝트에 적용되는 filid 프랙탈 구조 규칙을 조회하거나, 특정 경로의 규칙 준수 여부를 확인한다. ' +
      "action='list'는 전체 규칙 목록, " +
      "action='get'은 특정 규칙 상세 정보, " +
      "action='check'는 경로의 규칙 평가 결과를 반환한다.",
    inputSchema: {
      type: 'object' as const,
      properties: {
        action: {
          type: 'string',
          enum: ['list', 'get', 'check'],
          description: "수행할 동작: 'list' | 'get' | 'check'",
        },
        path: {
          type: 'string',
          description: '프로젝트 루트 디렉토리의 절대 경로',
        },
        ruleId: {
          type: 'string',
          description: "action='get'일 때 조회할 규칙 ID",
        },
        category: {
          type: 'string',
          enum: ['naming', 'structure', 'dependency', 'documentation', 'index', 'module'],
          description: "action='list'일 때 카테고리 필터",
        },
        targetPath: {
          type: 'string',
          description: "action='check'일 때 검사 대상 경로 (프로젝트 루트 기준 상대 경로)",
        },
      },
      required: ['action', 'path'],
    },
  },
  {
    name: 'structure-validate',
    description:
      '프로젝트 전체 또는 특정 규칙 집합에 대해 프랙탈 구조 유효성을 종합 검증한다. ' +
      '위반 항목 목록과 통과/실패/경고 수를 반환한다. ' +
      'fix=true 설정 시 safe 등급의 위반 항목을 자동으로 수정하고 잔여 위반 항목을 재보고한다.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: '검증할 프로젝트 루트 디렉토리의 절대 경로',
        },
        rules: {
          type: 'array',
          items: { type: 'string' },
          description: '검사할 규칙 ID 목록. 생략 시 모든 활성 규칙 검사',
        },
        fix: {
          type: 'boolean',
          description: 'safe 등급 위반 항목 자동 수정 여부. 기본값: false (현재 미구현 — 향후 지원 예정)',
        },
      },
      required: ['path'],
    },
  },
];

/**
 * Create and configure the FCA-AI MCP server.
 */
export function createServer(): Server {
  const server = new Server(
    { name: 'filid', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_DEFINITIONS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result: unknown;

      switch (name) {
        case 'ast-analyze':
          result = await handleAstAnalyze(args as any);
          break;
        case 'fractal-navigate':
          result = await handleFractalNavigate(args as any);
          break;
        case 'doc-compress':
          result = await handleDocCompress(args as any);
          break;
        case 'test-metrics':
          result = await handleTestMetrics(args as any);
          break;
        case 'fractal-scan':
          result = await handleFractalScan(args);
          break;
        case 'drift-detect':
          result = await handleDriftDetect(args);
          break;
        case 'lca-resolve':
          result = await handleLcaResolve(args);
          break;
        case 'rule-query':
          result = await handleRuleQuery(args);
          break;
        case 'structure-validate':
          result = await handleStructureValidate(args);
          break;
        default:
          return {
            content: [{ type: 'text', text: `Unknown tool: ${name}` }],
            isError: true,
          };
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(result, mapReplacer, 2) }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Error: ${message}` }],
        isError: true,
      };
    }
  });

  return server;
}

/** JSON.stringify replacer that converts Map to plain objects */
function mapReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Map) {
    return Object.fromEntries(value);
  }
  return value;
}

/** Start the MCP server with stdio transport */
export async function startServer(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
