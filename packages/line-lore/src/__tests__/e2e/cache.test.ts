import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { RepoBuilder } from '../helpers/repo-builder.js';
import { createMockPlatformAdapter, createPRInfo } from '../helpers/mock-platform.js';

vi.mock('@/platform/index.js', () => ({
  detectPlatformAdapter: vi.fn(),
}));

vi.mock('@/ast/index.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/ast/index.js')>();
  return { ...original, isAstAvailable: vi.fn().mockReturnValue(false) };
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

const mockDetectPlatform = detectPlatformAdapter as ReturnType<typeof vi.fn>;

describe('E11: Cache hit/miss behavior', { timeout: 30000 }, () => {
  let repo: RepoBuilder;
  let originalCwd: string;

  beforeEach(async () => {
    repo = await RepoBuilder.create();
    repo.addRemote('origin', 'https://github.com/test/repo.git');
    originalCwd = process.cwd();
    process.chdir(repo.path);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await repo.cleanup();
  });

  it('repeated trace on the same file/line returns consistent results', async () => {
    repo.commit(
      { 'src/app.ts': 'export const NAME = "app";\n' },
      'chore: initial',
    );

    repo.branch('feature/name');
    repo.commit(
      { 'src/app.ts': 'export const NAME = "app";\nexport const VERSION = "1.0.0";\n' },
      'feat: add VERSION',
    );

    repo.checkout('main');
    const mergeCommit = repo.merge('feature/name', 'Merge pull request #7 from feature/name');

    const prMap = new Map();
    prMap.set(mergeCommit, createPRInfo({ number: 7, mergeCommit }));
    const adapter = createMockPlatformAdapter({ prMap });
    mockDetectPlatform.mockResolvedValue({
      adapter,
      remote: { platform: 'github', host: 'github.com', owner: 'test', repo: 'repo' },
    });

    const result1 = await trace({ file: 'src/app.ts', line: 2 });
    const result2 = await trace({ file: 'src/app.ts', line: 2 });

    // Both traces should return the same PR number
    const pr1 = result1.nodes.find((n) => n.type === 'pull_request');
    const pr2 = result2.nodes.find((n) => n.type === 'pull_request');

    expect(pr1).toBeDefined();
    expect(pr2).toBeDefined();
    expect(pr1!.prNumber).toBe(7);
    expect(pr2!.prNumber).toBe(7);

    // Operating levels should be consistent
    expect(result1.operatingLevel).toBe(result2.operatingLevel);
  });

  it('different file/line produces separate cache entries with independent results', async () => {
    repo.commit(
      { 'src/a.ts': 'export const A = 1;\n', 'src/b.ts': 'export const B = 1;\n' },
      'chore: initial',
    );

    // Feature for file A
    repo.branch('feature/a');
    repo.commit(
      { 'src/a.ts': 'export const A = 1;\nexport const A2 = 2;\n' },
      'feat: add A2',
    );
    repo.checkout('main');
    const mergeA = repo.merge('feature/a', 'Merge pull request #11 from feature/a');

    // Feature for file B
    repo.branch('feature/b');
    repo.commit(
      { 'src/b.ts': 'export const B = 1;\nexport const B2 = 2;\n' },
      'feat: add B2',
    );
    repo.checkout('main');
    const mergeB = repo.merge('feature/b', 'Merge pull request #22 from feature/b');

    const prMap = new Map();
    prMap.set(mergeA, createPRInfo({ number: 11, mergeCommit: mergeA }));
    prMap.set(mergeB, createPRInfo({ number: 22, mergeCommit: mergeB }));
    const adapter = createMockPlatformAdapter({ prMap });
    mockDetectPlatform.mockResolvedValue({
      adapter,
      remote: { platform: 'github', host: 'github.com', owner: 'test', repo: 'repo' },
    });

    const resultA = await trace({ file: 'src/a.ts', line: 2 });
    const resultB = await trace({ file: 'src/b.ts', line: 2 });

    const prA = resultA.nodes.find((n) => n.type === 'pull_request');
    const prB = resultB.nodes.find((n) => n.type === 'pull_request');

    expect(prA!.prNumber).toBe(11);
    expect(prB!.prNumber).toBe(22);

    // The two results are independent
    expect(prA!.prNumber).not.toBe(prB!.prNumber);
  });

  it('in-memory FileCache mock stores and retrieves values correctly', async () => {
    // Verify the FileCache mock itself works as expected
    const { FileCache } = await import('@/cache/file-cache.js');
    const cache = new (FileCache as new (name: string) => {
      get(key: string): Promise<unknown>;
      set(key: string, value: unknown): Promise<void>;
      clear(): Promise<void>;
    })('test.json');

    expect(await cache.get('missing-key')).toBeNull();

    await cache.set('sha-abc', { number: 99, title: 'Test PR' });
    expect(await cache.get('sha-abc')).toEqual({ number: 99, title: 'Test PR' });

    // Different keys are independent
    expect(await cache.get('sha-xyz')).toBeNull();

    await cache.clear();
    expect(await cache.get('sha-abc')).toBeNull();
  });

  it('trace result nodes are structurally consistent across repeated calls', async () => {
    repo.commit(
      { 'src/index.ts': 'export const INIT = true;\n' },
      'chore: init',
    );

    repo.branch('feature/flag');
    const featureSha = repo.commit(
      { 'src/index.ts': 'export const INIT = true;\nexport const FLAG = false;\n' },
      'feat: add FLAG',
    );

    repo.checkout('main');
    const mergeCommit = repo.merge('feature/flag', 'Merge pull request #3 from feature/flag');

    const prMap = new Map();
    prMap.set(mergeCommit, createPRInfo({ number: 3, mergeCommit }));
    const adapter = createMockPlatformAdapter({ prMap });
    mockDetectPlatform.mockResolvedValue({
      adapter,
      remote: { platform: 'github', host: 'github.com', owner: 'test', repo: 'repo' },
    });

    const run1 = await trace({ file: 'src/index.ts', line: 2 });
    const run2 = await trace({ file: 'src/index.ts', line: 2 });

    // Node types should be identical
    expect(run1.nodes.map((n) => n.type)).toEqual(run2.nodes.map((n) => n.type));

    // SHAs should be identical
    const commit1 = run1.nodes.find((n) => n.type === 'original_commit');
    const commit2 = run2.nodes.find((n) => n.type === 'original_commit');
    expect(commit1!.sha).toBe(featureSha);
    expect(commit2!.sha).toBe(featureSha);
  });
});
