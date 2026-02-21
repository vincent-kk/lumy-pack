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
];

/**
 * Create and configure the FCA-AI MCP server.
 */
export function createServer(): Server {
  const server = new Server(
    { name: 'filid', version: '1.0.0' },
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
          result = handleAstAnalyze(args as any);
          break;
        case 'fractal-navigate':
          result = handleFractalNavigate(args as any);
          break;
        case 'doc-compress':
          result = handleDocCompress(args as any);
          break;
        case 'test-metrics':
          result = handleTestMetrics(args as any);
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
