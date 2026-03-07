/**
 * MCP Server for ink-veil.
 * Exposes three tools: ink_veil_detect, ink_veil_veil, ink_veil_unveil.
 * Uses stdio transport (MCP standard).
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
  type CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';
import { Dictionary } from '../dictionary/dictionary.js';
import { DetectionPipeline } from '../detection/index.js';
import { veilTextFromSpans } from '../transform/veil-from-spans.js';
import { veilTextFromDictionary } from '../transform/veil-from-dictionary.js';
import { unveilText } from '../transform/unveil.js';
import type { TokenMode } from '../types.js';

// ── Tool schema definitions ────────────────────────────────────────────────

const DETECT_TOOL: Tool = {
  name: 'ink_veil_detect',
  description: 'Detect Korean PII entities in text using regex patterns. Returns an array of detected spans with category, position, and confidence.',
  inputSchema: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: 'Text to analyze for Korean PII entities.',
      },
    },
    required: ['text'],
  },
};

const VEIL_TOOL: Tool = {
  name: 'ink_veil_veil',
  description: 'Veil (anonymize) Korean PII entities in text. Detects entities and replaces them with tokens. Returns veiled text and the token dictionary.',
  inputSchema: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: 'Text containing Korean PII to veil.',
      },
      tokenMode: {
        type: 'string',
        enum: ['tag', 'bracket', 'plain'],
        description: "Token format. 'tag': XML tag (default, best LLM preservation). 'bracket': {{PER_001}}. 'plain': PER_001.",
        default: 'tag',
      },
      manualEntities: {
        type: 'array',
        description: 'Optional list of known entities to veil without detection.',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Entity text to veil.' },
            category: { type: 'string', description: 'Entity category (e.g. PER, ORG, LOC).' },
          },
          required: ['text', 'category'],
        },
      },
    },
    required: ['text'],
  },
};

const UNVEIL_TOOL: Tool = {
  name: 'ink_veil_unveil',
  description: 'Unveil (de-anonymize) previously veiled text using a token dictionary. Supports fuzzy matching for LLM-altered token formats.',
  inputSchema: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: 'Veiled text with tokens to restore.',
      },
      dictionary: {
        type: 'object',
        description: 'Token dictionary produced by ink_veil_veil. Must contain forwardIndex and reverseIndex.',
        properties: {
          forwardIndex: {
            type: 'object',
            description: 'Map from composite key to entry.',
          },
          reverseIndex: {
            type: 'object',
            description: 'Map from plain token ID to entry.',
          },
          counters: {
            type: 'object',
            description: 'Per-category token counters.',
          },
          version: {
            type: 'number',
            description: 'Dictionary schema version.',
          },
          tokenMode: {
            type: 'string',
            description: 'Token mode used during veil.',
          },
        },
        required: ['forwardIndex', 'reverseIndex', 'counters', 'version'],
      },
    },
    required: ['text', 'dictionary'],
  },
};

// ── Tool implementations ───────────────────────────────────────────────────

function handleDetect(args: Record<string, unknown>): CallToolResult {
  const text = args['text'];
  if (typeof text !== 'string') {
    return mcpError('text must be a string');
  }

  const pipeline = new DetectionPipeline();
  const spans = pipeline.detect(text);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          spans: spans.map((s) => ({
            text: s.text,
            category: s.category,
            start: s.start,
            end: s.end,
            method: s.method,
            confidence: s.confidence,
          })),
          count: spans.length,
        }, null, 2),
      },
    ],
  };
}

function handleVeil(args: Record<string, unknown>): CallToolResult {
  const text = args['text'];
  if (typeof text !== 'string') {
    return mcpError('text must be a string');
  }

  const tokenMode = (args['tokenMode'] as TokenMode | undefined) ?? 'tag';
  const validModes: TokenMode[] = ['tag', 'bracket', 'plain', 'faker'];
  if (!validModes.includes(tokenMode)) {
    return mcpError(`tokenMode must be one of: ${validModes.join(', ')}`);
  }

  const dict = Dictionary.create(tokenMode);

  // Apply manual entities first if provided — register into dictionary
  const manualEntities = args['manualEntities'];
  if (Array.isArray(manualEntities)) {
    for (const entity of manualEntities) {
      if (
        entity &&
        typeof entity === 'object' &&
        typeof (entity as Record<string, unknown>)['text'] === 'string' &&
        typeof (entity as Record<string, unknown>)['category'] === 'string'
      ) {
        const e = entity as { text: string; category: string };
        dict.addEntity(e.text, e.category, 'MANUAL', 1.0);
      }
    }
  }

  let veiledText: string;
  let substitutions: number;

  const dictLike = { addEntity: (t: string, c: string) => dict.addEntity(t, c, 'REGEX', 1.0).token };

  if (Array.isArray(manualEntities) && manualEntities.length > 0) {
    // When manual entities are provided, use dictionary-based veil (no detection)
    const result = veilTextFromDictionary(text, dict);
    // Also run detection pipeline for auto-discovered entities
    const pipeline = new DetectionPipeline();
    const spans = pipeline.detect(text, dictLike);
    if (spans.length > 0) {
      const detected = veilTextFromSpans(result.text, spans, dict, 'mcp');
      veiledText = detected.text;
      substitutions = result.substitutions + detected.substitutions;
    } else {
      veiledText = result.text;
      substitutions = result.substitutions;
    }
  } else {
    // Pure detection-based veil
    const pipeline = new DetectionPipeline();
    const spans = pipeline.detect(text, dictLike);
    const result = veilTextFromSpans(text, spans, dict, 'mcp');
    veiledText = result.text;
    substitutions = result.substitutions;
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          veiledText,
          substitutions,
          dictionary: dict.toJSON(),
        }, null, 2),
      },
    ],
  };
}

function handleUnveil(args: Record<string, unknown>): CallToolResult {
  const text = args['text'];
  if (typeof text !== 'string') {
    return mcpError('text must be a string');
  }

  const dictData = args['dictionary'];
  if (!dictData || typeof dictData !== 'object') {
    return mcpError('dictionary must be an object');
  }

  let dict: Dictionary;
  try {
    dict = Dictionary.fromJSON(dictData as Parameters<typeof Dictionary.fromJSON>[0]);
  } catch (e) {
    return mcpError(`Invalid dictionary format: ${e instanceof Error ? e.message : String(e)}`);
  }

  const result = unveilText(text, dict);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          unveiledText: result.text,
          matchedTokens: result.matchedTokens,
          modifiedTokens: result.modifiedTokens,
          unmatchedTokens: result.unmatchedTokens,
          tokenIntegrity: result.tokenIntegrity,
        }, null, 2),
      },
    ],
  };
}

// ── Error helper ───────────────────────────────────────────────────────────

function mcpError(message: string): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

// ── Server factory ─────────────────────────────────────────────────────────

export function createMcpServer(): Server {
  const server = new Server(
    { name: 'ink-veil', version: '0.0.1' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [DETECT_TOOL, VEIL_TOOL, UNVEIL_TOOL],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const safeArgs = (args ?? {}) as Record<string, unknown>;

    switch (name) {
      case 'ink_veil_detect':
        return handleDetect(safeArgs);
      case 'ink_veil_veil':
        return handleVeil(safeArgs);
      case 'ink_veil_unveil':
        return handleUnveil(safeArgs);
      default:
        return mcpError(`Unknown tool: ${name}`);
    }
  });

  return server;
}

/** Start the MCP server on stdio transport. */
export async function startMcpServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
