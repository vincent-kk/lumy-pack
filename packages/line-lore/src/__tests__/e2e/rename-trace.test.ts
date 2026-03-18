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

// Initial utils.ts with calcTotal
const UTILS_ORIGINAL = `function calcTotal(items: Array<{ price: number }>) {
  return items.reduce((s, i) => s + i.price, 0);
}

function formatCurrency(amount: number) {
  return '$' + amount.toFixed(2);
}

export { calcTotal, formatCurrency };
`;

// Another file change (unrelated, to build up history)
const HELPER_V1 = `export function noop() {}
`;

// Rename: calcTotal → calculateTotal (body identical)
const UTILS_RENAMED = `function calculateTotal(items: Array<{ price: number }>) {
  return items.reduce((s, i) => s + i.price, 0);
}

function formatCurrency(amount: number) {
  return '$' + amount.toFixed(2);
}

export { calculateTotal, formatCurrency };
`;

describe('E5: Function rename detection', { timeout: 30000 }, () => {
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

  it('blame points to rename commit for the renamed function body', async () => {
    // A: initial commit
    repo.commit({ 'src/utils.ts': UTILS_ORIGINAL }, 'feat: add calcTotal');
    // B: unrelated change
    repo.commit({ 'src/helper.ts': HELPER_V1 }, 'chore: add helper');
    // R: rename calcTotal → calculateTotal
    repo.commit({ 'src/utils.ts': UTILS_RENAMED }, 'refactor: rename calcTotal to calculateTotal');

    // line 2 is the body of calculateTotal
    const result = await trace({ file: 'src/utils.ts', line: 2 });

    expect(result.nodes.length).toBeGreaterThanOrEqual(1);
    const firstNode = result.nodes[0];
    // Rename changes tokens, so isCosmeticDiff returns false → original_commit
    expect(firstNode.type).toBe('original_commit');
    expect(firstNode.trackingMethod).toBe('blame-CMw');
  });

  it('rename commit is NOT classified as cosmetic (code identity changed)', async () => {
    repo.commit({ 'src/utils.ts': UTILS_ORIGINAL }, 'feat: add calcTotal');
    repo.commit({ 'src/utils.ts': UTILS_RENAMED }, 'refactor: rename calcTotal to calculateTotal');

    const result = await trace({ file: 'src/utils.ts', line: 2 });

    const cosmeticNodes = result.nodes.filter((n) => n.type === 'cosmetic_commit');
    expect(cosmeticNodes).toHaveLength(0);
  });

  it('featureFlags.astDiff is true when isAstAvailable is mocked true', async () => {
    repo.commit({ 'src/utils.ts': UTILS_ORIGINAL }, 'feat: add calcTotal');
    repo.commit({ 'src/utils.ts': UTILS_RENAMED }, 'refactor: rename calcTotal to calculateTotal');

    const result = await trace({ file: 'src/utils.ts', line: 2 });

    expect(result.featureFlags.astDiff).toBe(true);
  });

  it('trace returns at least one node with a valid commit SHA from the repo', async () => {
    const originalSha = repo.commit({ 'src/utils.ts': UTILS_ORIGINAL }, 'feat: add calcTotal');
    const renameSha = repo.commit(
      { 'src/utils.ts': UTILS_RENAMED },
      'refactor: rename calcTotal to calculateTotal',
    );

    const result = await trace({ file: 'src/utils.ts', line: 2 });

    const commitNodes = result.nodes.filter((n) =>
      n.type === 'original_commit' || n.type === 'cosmetic_commit',
    );
    expect(commitNodes.length).toBeGreaterThanOrEqual(1);
    // blame -C -C -M may attribute to rename commit or original — both are valid
    expect([originalSha, renameSha]).toContain(commitNodes[0].sha);
  });

  it('tracing function declaration line (line 1) also returns a commit node', async () => {
    repo.commit({ 'src/utils.ts': UTILS_ORIGINAL }, 'feat: add calcTotal');
    repo.commit({ 'src/utils.ts': UTILS_RENAMED }, 'refactor: rename calcTotal to calculateTotal');

    const result = await trace({ file: 'src/utils.ts', line: 1 });

    expect(result.nodes.length).toBeGreaterThanOrEqual(1);
    expect(result.nodes[0].sha).toBeDefined();
  });
});
