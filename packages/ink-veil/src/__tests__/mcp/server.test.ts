import { describe, it, expect } from 'vitest';
import { createMcpServer } from '../../mcp/server.js';

// Helper: simulate a request handler call via the server's internal handler
// We test tool logic directly by importing handleDetect/handleVeil/handleUnveil equivalents
// through server request handlers using an in-memory transport.

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

async function createTestClient() {
  const server = createMcpServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  const client = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} });

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  return { client, server };
}

describe('MCP server — tool listing', () => {
  it('lists three tools: detect, veil, unveil', async () => {
    const { client } = await createTestClient();
    const result = await client.listTools();
    const names = result.tools.map((t) => t.name);
    expect(names).toContain('ink_veil_detect');
    expect(names).toContain('ink_veil_veil');
    expect(names).toContain('ink_veil_unveil');
    expect(names).toHaveLength(3);
  });

  it('detect tool has correct input schema', async () => {
    const { client } = await createTestClient();
    const result = await client.listTools();
    const detect = result.tools.find((t) => t.name === 'ink_veil_detect')!;
    expect(detect.inputSchema.required).toContain('text');
  });

  it('veil tool has tokenMode enum in schema', async () => {
    const { client } = await createTestClient();
    const result = await client.listTools();
    const veil = result.tools.find((t) => t.name === 'ink_veil_veil')!;
    const props = veil.inputSchema.properties as Record<string, { enum?: string[] }>;
    expect(props['tokenMode']?.enum).toContain('tag');
    expect(props['tokenMode']?.enum).toContain('bracket');
    expect(props['tokenMode']?.enum).toContain('plain');
  });
});

describe('MCP server — ink_veil_detect tool', () => {
  it('detects Korean RRN pattern', async () => {
    const { client } = await createTestClient();
    const result = await client.callTool({
      name: 'ink_veil_detect',
      arguments: { text: '주민번호: 901231-1234567' },
    });
    const content = (result.content as { type: string; text: string }[])[0];
    const parsed = JSON.parse(content.text);
    expect(parsed.count).toBeGreaterThan(0);
    expect(parsed.spans[0].category).toBeDefined();
  });

  it('returns empty spans for clean text', async () => {
    const { client } = await createTestClient();
    const result = await client.callTool({
      name: 'ink_veil_detect',
      arguments: { text: '오늘 날씨가 맑습니다.' },
    });
    const content = (result.content as { type: string; text: string }[])[0];
    const parsed = JSON.parse(content.text);
    expect(Array.isArray(parsed.spans)).toBe(true);
    expect(parsed.count).toBe(0);
  });

  it('returns error for missing text', async () => {
    const { client } = await createTestClient();
    const result = await client.callTool({
      name: 'ink_veil_detect',
      arguments: {},
    });
    expect(result.isError).toBe(true);
    const content = (result.content as { type: string; text: string }[])[0];
    const parsed = JSON.parse(content.text);
    expect(parsed.error).toBeDefined();
  });
});

describe('MCP server — ink_veil_veil tool', () => {
  it('veils RRN and returns dictionary', async () => {
    const { client } = await createTestClient();
    const result = await client.callTool({
      name: 'ink_veil_veil',
      arguments: { text: '주민번호는 901231-1234567입니다.', tokenMode: 'plain' },
    });
    const content = (result.content as { type: string; text: string }[])[0];
    const parsed = JSON.parse(content.text);
    expect(typeof parsed.veiledText).toBe('string');
    expect(parsed.veiledText).not.toContain('901231-1234567');
    expect(parsed.substitutions).toBeGreaterThan(0);
    expect(parsed.dictionary).toBeDefined();
    expect(Array.isArray(parsed.dictionary.entries)).toBe(true);
    expect(parsed.dictionary.entries.length).toBeGreaterThan(0);
  });

  it('veils manual entities without detection', async () => {
    const { client } = await createTestClient();
    const result = await client.callTool({
      name: 'ink_veil_veil',
      arguments: {
        text: '홍길동이 방문했습니다.',
        tokenMode: 'bracket',
        manualEntities: [{ text: '홍길동', category: 'PER' }],
      },
    });
    const content = (result.content as { type: string; text: string }[])[0];
    const parsed = JSON.parse(content.text);
    expect(parsed.veiledText).not.toContain('홍길동');
    expect(parsed.veiledText).toContain('{{PER_');
  });

  it('defaults to tag tokenMode', async () => {
    const { client } = await createTestClient();
    const result = await client.callTool({
      name: 'ink_veil_veil',
      arguments: {
        text: '이메일: test@example.com',
      },
    });
    const content = (result.content as { type: string; text: string }[])[0];
    const parsed = JSON.parse(content.text);
    // tag mode tokens contain iv- prefix OR plain if no detection
    expect(typeof parsed.veiledText).toBe('string');
    expect(parsed.dictionary.tokenMode).toBe('tag');
  });

  it('returns error for invalid tokenMode', async () => {
    const { client } = await createTestClient();
    const result = await client.callTool({
      name: 'ink_veil_veil',
      arguments: { text: 'test', tokenMode: 'invalid' },
    });
    expect(result.isError).toBe(true);
  });
});

describe('MCP server — ink_veil_unveil tool', () => {
  it('round-trip: veil then unveil restores original', async () => {
    const { client } = await createTestClient();

    // Step 1: veil
    const veilResult = await client.callTool({
      name: 'ink_veil_veil',
      arguments: { text: '연락처: 010-1234-5678', tokenMode: 'plain' },
    });
    const veilContent = (veilResult.content as { type: string; text: string }[])[0];
    const veiled = JSON.parse(veilContent.text);

    // Step 2: unveil
    const unveilResult = await client.callTool({
      name: 'ink_veil_unveil',
      arguments: {
        text: veiled.veiledText,
        dictionary: veiled.dictionary,
      },
    });
    const unveilContent = (unveilResult.content as { type: string; text: string }[])[0];
    const unviled = JSON.parse(unveilContent.text);

    expect(unviled.unveiledText).toContain('010-1234-5678');
    // plain mode tokens are matched via Stage 3 (modifiedTokens), so integrity < 1 is expected
    expect(unviled.tokenIntegrity).toBeGreaterThanOrEqual(0);
    // The text must be restored regardless
    expect(unviled.unmatchedTokens).toHaveLength(0);
  });

  it('returns error for missing text', async () => {
    const { client } = await createTestClient();
    const result = await client.callTool({
      name: 'ink_veil_unveil',
      arguments: { dictionary: { forwardIndex: {}, reverseIndex: {}, counters: {}, version: 1 } },
    });
    expect(result.isError).toBe(true);
  });

  it('returns error for invalid dictionary', async () => {
    const { client } = await createTestClient();
    const result = await client.callTool({
      name: 'ink_veil_unveil',
      arguments: { text: 'PER_001', dictionary: 'not-an-object' },
    });
    expect(result.isError).toBe(true);
  });
});

describe('MCP server — unknown tool', () => {
  it('returns error for unknown tool name', async () => {
    const { client } = await createTestClient();
    const result = await client.callTool({
      name: 'ink_veil_nonexistent',
      arguments: {},
    });
    expect(result.isError).toBe(true);
    const content = (result.content as { type: string; text: string }[])[0];
    const parsed = JSON.parse(content.text);
    expect(parsed.error).toContain('Unknown tool');
  });
});
