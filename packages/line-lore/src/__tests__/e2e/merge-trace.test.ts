import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { RepoBuilder } from '../helpers/repo-builder.js';
import { createMockPlatformAdapter, createPRInfo, createUnauthenticatedAdapter } from '../helpers/mock-platform.js';

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

import { trace, clearCache } from '@/core/core.js';
import { detectPlatformAdapter } from '@/platform/index.js';

const mockDetectPlatform = detectPlatformAdapter as ReturnType<typeof vi.fn>;

describe('E1: Merge Commit trace', { timeout: 30000 }, () => {
  let repo: RepoBuilder;
  let originalCwd: string;

  beforeEach(async () => {
    repo = await RepoBuilder.create();
    repo.addRemote('origin', 'https://github.com/test/repo.git');
    originalCwd = process.cwd();
    process.chdir(repo.path);
    vi.clearAllMocks();
    await clearCache();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await repo.cleanup();
  });

  it('blame finds the feature branch commit that introduced the line', async () => {
    // A: initial file
    repo.commit(
      { 'src/utils.ts': 'export function existing(): void {}\n' },
      'chore: initial commit',
    );

    // B: unrelated change on main
    repo.commit(
      { 'src/utils.ts': 'export function existing(): void {}\nexport const VERSION = 1;\n' },
      'chore: add version constant',
    );

    // feature branch: C adds a function at line 3
    repo.branch('feature/add-helper');
    const commitC = repo.commit(
      {
        'src/utils.ts':
          'export function existing(): void {}\nexport const VERSION = 1;\nexport function helper(): string { return "hello"; }\n',
      },
      'feat: add helper function',
    );

    // M: merge back into main
    repo.checkout('main');
    const mergeCommit = repo.merge('feature/add-helper', 'Merge pull request #42 from feature/add-helper');

    const prMap = new Map();
    prMap.set(mergeCommit, createPRInfo({ number: 42, mergeCommit }));
    const adapter = createMockPlatformAdapter({ prMap });
    mockDetectPlatform.mockResolvedValue({
      adapter,
      remote: { platform: 'github', host: 'github.com', owner: 'test', repo: 'repo' },
    });

    const result = await trace({ file: 'src/utils.ts', line: 3 });

    // blame should point to commitC (the feature branch commit)
    const originalNode = result.nodes.find((n) => n.type === 'original_commit');
    expect(originalNode).toBeDefined();
    expect(originalNode!.sha).toBe(commitC);
    expect(originalNode!.trackingMethod).toBe('blame-CMw');
    expect(originalNode!.confidence).toBe('exact');
  });

  it('finds PR via merge commit ancestry-path (Level 1 — no API)', async () => {
    repo.commit(
      { 'src/utils.ts': 'export function a(): void {}\n' },
      'chore: initial',
    );

    repo.branch('feature/thing');
    repo.commit(
      { 'src/utils.ts': 'export function a(): void {}\nexport function b(): void {}\n' },
      'feat: add b',
    );

    repo.checkout('main');
    repo.merge('feature/thing', 'Merge pull request #42 from feature/thing');

    // Level 1: unauthenticated adapter — falls back to message-parse
    const adapter = createUnauthenticatedAdapter();
    mockDetectPlatform.mockResolvedValue({
      adapter,
      remote: { platform: 'github', host: 'github.com', owner: 'test', repo: 'repo' },
    });

    const result = await trace({ file: 'src/utils.ts', line: 2 });

    expect(result.operatingLevel).toBe(1);

    const prNode = result.nodes.find((n) => n.type === 'pull_request');
    expect(prNode).toBeDefined();
    expect(prNode!.prNumber).toBe(42);
    expect(prNode!.trackingMethod).toBe('message-parse');
    expect(prNode!.confidence).toBe('heuristic');
  });

  it('finds PR via API with full details (Level 2)', async () => {
    repo.commit(
      { 'src/utils.ts': 'export function a(): void {}\n' },
      'chore: initial',
    );

    repo.branch('feature/thing');
    const commitC = repo.commit(
      { 'src/utils.ts': 'export function a(): void {}\nexport function b(): void {}\n' },
      'feat: add b',
    );

    repo.checkout('main');
    const mergeCommit = repo.merge('feature/thing', 'Merge pull request #42 from feature/thing');

    const prInfo = createPRInfo({
      number: 42,
      mergeCommit,
      title: 'feat: add b function',
      url: 'https://github.com/test/repo/pull/42',
    });
    const prMap = new Map();
    prMap.set(mergeCommit, prInfo);
    const adapter = createMockPlatformAdapter({ prMap });
    mockDetectPlatform.mockResolvedValue({
      adapter,
      remote: { platform: 'github', host: 'github.com', owner: 'test', repo: 'repo' },
    });

    const result = await trace({ file: 'src/utils.ts', line: 2 });

    expect(result.operatingLevel).toBe(2);

    const originalNode = result.nodes.find((n) => n.type === 'original_commit');
    expect(originalNode!.sha).toBe(commitC);

    const prNode = result.nodes.find((n) => n.type === 'pull_request');
    expect(prNode).toBeDefined();
    expect(prNode!.prNumber).toBe(42);
    expect(prNode!.prUrl).toBe('https://github.com/test/repo/pull/42');
    expect(prNode!.prTitle).toBe('feat: add b function');
    expect(prNode!.trackingMethod).toBe('api');
    expect(prNode!.confidence).toBe('exact');
    expect(prNode!.sha).toBe(mergeCommit);
  });

  it('returns only original_commit node when no merge commit and no adapter', async () => {
    // Straight commit to main — no branch, no PR
    repo.commit(
      { 'src/utils.ts': 'export const x = 1;\n' },
      'chore: initial',
    );
    const directCommit = repo.commit(
      { 'src/utils.ts': 'export const x = 1;\nexport const y = 2;\n' },
      'fix: add y directly on main',
    );

    mockDetectPlatform.mockRejectedValue(new Error('no platform'));

    const result = await trace({ file: 'src/utils.ts', line: 2 });

    expect(result.operatingLevel).toBe(0);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].type).toBe('original_commit');
    expect(result.nodes[0].sha).toBe(directCommit);
  });

  it('result nodes contain original_commit followed by pull_request', async () => {
    repo.commit(
      { 'src/utils.ts': 'line1\n' },
      'chore: init',
    );

    repo.branch('feature/pr');
    const commitC = repo.commit(
      { 'src/utils.ts': 'line1\nline2\n' },
      'feat: line2',
    );

    repo.checkout('main');
    const mergeCommit = repo.merge('feature/pr', 'Merge pull request #99 from feature/pr');

    const prMap = new Map();
    prMap.set(mergeCommit, createPRInfo({ number: 99, mergeCommit }));
    const adapter = createMockPlatformAdapter({ prMap });
    mockDetectPlatform.mockResolvedValue({
      adapter,
      remote: { platform: 'github', host: 'github.com', owner: 'test', repo: 'repo' },
    });

    const result = await trace({ file: 'src/utils.ts', line: 2 });

    expect(result.nodes).toHaveLength(2);
    expect(result.nodes[0].type).toBe('original_commit');
    expect(result.nodes[0].sha).toBe(commitC);
    expect(result.nodes[1].type).toBe('pull_request');
    expect(result.nodes[1].prNumber).toBe(99);
  });
});
