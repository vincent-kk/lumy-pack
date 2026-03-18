import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RepoBuilder } from '../helpers/repo-builder.js';
import { createMockPlatformAdapter } from '../helpers/mock-platform.js';

vi.mock('@/platform/index.js', () => ({
  detectPlatformAdapter: vi.fn(),
}));

vi.mock('@/ast/index.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/ast/index.js')>();
  return { ...original, isAstAvailable: vi.fn().mockReturnValue(true) };
});

vi.mock('@/cache/file-cache.js', () => ({
  FileCache: class {
    private store = new Map<string, unknown>();
    async get(key: string) { return this.store.get(key) ?? null; }
    async set(key: string, value: unknown) { this.store.set(key, value); }
    async clear() { this.store.clear(); }
  },
}));

import { trace } from '@/core/core.js';
import { detectPlatformAdapter } from '@/platform/index.js';
import { isAstAvailable } from '@/ast/index.js';

const mockDetectPlatform = detectPlatformAdapter as ReturnType<typeof vi.fn>;
const mockIsAstAvailable = isAstAvailable as ReturnType<typeof vi.fn>;

// A: large processOrder with inline validation logic
const SERVICE_ORIGINAL = `function processOrder(order: { id: string; items: string[]; total: number }) {
  if (!order.id) {
    throw new Error('Order ID is required');
  }
  if (order.items.length === 0) {
    throw new Error('Order must have items');
  }
  if (order.total <= 0) {
    throw new Error('Order total must be positive');
  }
  return { orderId: order.id, status: 'processed' };
}

export { processOrder };
`;

// B: extract validation into validateOrder()
const SERVICE_EXTRACTED = `function validateOrder(order: { id: string; items: string[]; total: number }) {
  if (!order.id) {
    throw new Error('Order ID is required');
  }
  if (order.items.length === 0) {
    throw new Error('Order must have items');
  }
  if (order.total <= 0) {
    throw new Error('Order total must be positive');
  }
}

function processOrder(order: { id: string; items: string[]; total: number }) {
  validateOrder(order);
  return { orderId: order.id, status: 'processed' };
}

export { processOrder, validateOrder };
`;

describe('E6: Method extraction detection', { timeout: 30000 }, () => {
  let repo: RepoBuilder;
  let originalCwd: string;

  beforeEach(async () => {
    repo = await RepoBuilder.create();
    repo.addRemote('origin', 'https://github.com/test/repo.git');
    originalCwd = process.cwd();
    process.chdir(repo.path);
    vi.clearAllMocks();

    const mockAdapter = createMockPlatformAdapter({ authenticated: false });
    mockDetectPlatform.mockResolvedValue({ adapter: mockAdapter });
    mockIsAstAvailable.mockReturnValue(true);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await repo.cleanup();
  });

  it('blame points to a known commit for the extracted function body', async () => {
    // A: original service with inline validation
    const originalSha = repo.commit({ 'src/service.ts': SERVICE_ORIGINAL }, 'feat: add processOrder');
    // B: extract validation
    const extractSha = repo.commit(
      { 'src/service.ts': SERVICE_EXTRACTED },
      'refactor: extract validateOrder from processOrder',
    );

    // line 3 is inside validateOrder body (throw new Error('Order ID is required'))
    const result = await trace({ file: 'src/service.ts', line: 3 });

    expect(result.nodes.length).toBeGreaterThanOrEqual(1);
    const firstNode = result.nodes[0];
    // blame -C -C -M may trace to extract commit or original — both are valid
    expect([originalSha, extractSha]).toContain(firstNode.sha);
  });

  it('extraction commit is classified as original_commit (not cosmetic)', async () => {
    repo.commit({ 'src/service.ts': SERVICE_ORIGINAL }, 'feat: add processOrder');
    repo.commit(
      { 'src/service.ts': SERVICE_EXTRACTED },
      'refactor: extract validateOrder from processOrder',
    );

    const result = await trace({ file: 'src/service.ts', line: 3 });

    expect(result.nodes[0].type).toBe('original_commit');
    const cosmeticNodes = result.nodes.filter((n) => n.type === 'cosmetic_commit');
    expect(cosmeticNodes).toHaveLength(0);
  });

  it('featureFlags.astDiff is true when isAstAvailable is mocked true', async () => {
    repo.commit({ 'src/service.ts': SERVICE_ORIGINAL }, 'feat: add processOrder');
    repo.commit(
      { 'src/service.ts': SERVICE_EXTRACTED },
      'refactor: extract validateOrder from processOrder',
    );

    const result = await trace({ file: 'src/service.ts', line: 3 });

    expect(result.featureFlags.astDiff).toBe(true);
  });

  it('tracing processOrder (line 14 after extraction) returns the extraction commit', async () => {
    repo.commit({ 'src/service.ts': SERVICE_ORIGINAL }, 'feat: add processOrder');
    const extractSha = repo.commit(
      { 'src/service.ts': SERVICE_EXTRACTED },
      'refactor: extract validateOrder from processOrder',
    );

    // line 14 is processOrder body after extraction: validateOrder(order);
    const result = await trace({ file: 'src/service.ts', line: 14 });

    expect(result.nodes.length).toBeGreaterThanOrEqual(1);
    expect(result.nodes[0].sha).toBe(extractSha);
  });

  it('trace result has trackingMethod blame-CMw for the first node', async () => {
    repo.commit({ 'src/service.ts': SERVICE_ORIGINAL }, 'feat: add processOrder');
    repo.commit(
      { 'src/service.ts': SERVICE_EXTRACTED },
      'refactor: extract validateOrder from processOrder',
    );

    const result = await trace({ file: 'src/service.ts', line: 3 });

    expect(result.nodes[0].trackingMethod).toBe('blame-CMw');
    expect(result.nodes[0].confidence).toBe('exact');
  });
});
