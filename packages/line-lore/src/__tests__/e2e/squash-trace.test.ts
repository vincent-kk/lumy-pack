import { execFileSync } from 'node:child_process';
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

/**
 * RepoBuilder.create() sets merge.ff=false globally which conflicts with
 * `git merge --squash`. Override it to 'true' before calling squashMerge().
 */
function enableFFMerge(repoPath: string): void {
  execFileSync('git', ['config', 'merge.ff', 'true'], {
    cwd: repoPath,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

describe('E2: Squash Merge trace', { timeout: 30000 }, () => {
  let repo: RepoBuilder;
  let originalCwd: string;

  beforeEach(async () => {
    await clearCache();
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

  it('blame finds the squash commit S directly (not the original feature commits)', async () => {
    // A: initial
    repo.commit(
      { 'src/auth.ts': 'export function login(): void {}\n' },
      'chore: initial',
    );

    // Feature branch: C1, C2, C3
    repo.branch('feature/auth');
    repo.commit(
      { 'src/auth.ts': 'export function login(): void {}\nexport function logout(): void {}\n' },
      'feat: add logout',
    );
    repo.commit(
      {
        'src/auth.ts':
          'export function login(): void {}\nexport function logout(): void {}\nexport function refresh(): void {}\n',
      },
      'feat: add refresh',
    );
    repo.commit(
      {
        'src/auth.ts':
          'export function login(): void {}\nexport function logout(): void {}\nexport function refresh(): void {}\nexport function validate(): boolean { return true; }\n',
      },
      'feat: add validate',
    );

    // S: squash merge onto main
    repo.checkout('main');
    enableFFMerge(repo.path);
    const squashCommit = repo.squashMerge('feature/auth', 'feat: add validation (#55)');

    const prMap = new Map();
    prMap.set(squashCommit, createPRInfo({ number: 55, mergeCommit: squashCommit }));
    const adapter = createMockPlatformAdapter({ prMap });
    mockDetectPlatform.mockResolvedValue({
      adapter,
      remote: { platform: 'github', host: 'github.com', owner: 'test', repo: 'repo' },
    });

    const result = await trace({ file: 'src/auth.ts', line: 4 });

    // blame must point to the squash commit, not the original C3
    const originalNode = result.nodes.find((n) => n.type === 'original_commit');
    expect(originalNode).toBeDefined();
    expect(originalNode!.sha).toBe(squashCommit);
    expect(originalNode!.trackingMethod).toBe('blame-CMw');
    expect(originalNode!.confidence).toBe('exact');
  });

  it('no merge commit node exists — squash leaves a single commit on main', async () => {
    repo.commit(
      { 'src/auth.ts': 'export function login(): void {}\n' },
      'chore: initial',
    );

    repo.branch('feature/auth');
    repo.commit(
      { 'src/auth.ts': 'export function login(): void {}\nexport function logout(): void {}\n' },
      'feat: add logout',
    );

    repo.checkout('main');
    enableFFMerge(repo.path);
    const squashCommit = repo.squashMerge('feature/auth', 'feat: add validation (#55)');

    const prMap = new Map();
    prMap.set(squashCommit, createPRInfo({ number: 55, mergeCommit: squashCommit }));
    const adapter = createMockPlatformAdapter({ prMap });
    mockDetectPlatform.mockResolvedValue({
      adapter,
      remote: { platform: 'github', host: 'github.com', owner: 'test', repo: 'repo' },
    });

    const result = await trace({ file: 'src/auth.ts', line: 2 });

    // No 'merge_commit' type node — squash produces no merge commit
    const mergeNodes = result.nodes.filter((n) => n.type === 'merge_commit');
    expect(mergeNodes).toHaveLength(0);
  });

  it('with adapter: getPRForCommit(squashCommit) returns PR — trackingMethod api', async () => {
    repo.commit(
      { 'src/auth.ts': 'export function a(): void {}\n' },
      'chore: initial',
    );

    repo.branch('feature/auth');
    repo.commit(
      { 'src/auth.ts': 'export function a(): void {}\nexport function b(): void {}\n' },
      'feat: add b',
    );

    repo.checkout('main');
    enableFFMerge(repo.path);
    const squashCommit = repo.squashMerge('feature/auth', 'feat: add b (#55)');

    const prInfo = createPRInfo({
      number: 55,
      mergeCommit: squashCommit,
      title: 'feat: add b',
      url: 'https://github.com/test/repo/pull/55',
    });
    const prMap = new Map();
    prMap.set(squashCommit, prInfo);
    const adapter = createMockPlatformAdapter({ prMap });
    mockDetectPlatform.mockResolvedValue({
      adapter,
      remote: { platform: 'github', host: 'github.com', owner: 'test', repo: 'repo' },
    });

    const result = await trace({ file: 'src/auth.ts', line: 2 });

    expect(result.operatingLevel).toBe(2);

    const prNode = result.nodes.find((n) => n.type === 'pull_request');
    expect(prNode).toBeDefined();
    expect(prNode!.prNumber).toBe(55);
    expect(prNode!.trackingMethod).toBe('api');
    expect(prNode!.confidence).toBe('exact');
    expect(prNode!.sha).toBe(squashCommit);
  });

  it('without adapter: squash commit is not a merge commit — findMergeCommit returns null — no PR node', async () => {
    // Squash commit subject has "(#55)" pattern BUT findMergeCommit uses --merges --ancestry-path.
    // A squash commit has only one parent → git log --merges does NOT include it.
    // Therefore lookupPR cannot parse the message, and without an adapter returns null.
    repo.commit(
      { 'src/auth.ts': 'export function a(): void {}\n' },
      'chore: initial',
    );

    repo.branch('feature/auth');
    repo.commit(
      { 'src/auth.ts': 'export function a(): void {}\nexport function b(): void {}\n' },
      'feat: add b',
    );

    repo.checkout('main');
    enableFFMerge(repo.path);
    repo.squashMerge('feature/auth', 'feat: add b (#55)');

    // Unauthenticated — Level 1, no API
    const adapter = createUnauthenticatedAdapter();
    mockDetectPlatform.mockResolvedValue({
      adapter,
      remote: { platform: 'github', host: 'github.com', owner: 'test', repo: 'repo' },
    });

    const result = await trace({ file: 'src/auth.ts', line: 2 });

    expect(result.operatingLevel).toBe(1);

    // squash commit has one parent → not a merge commit → findMergeCommit returns null
    // → no message-parse → no pull_request node
    const prNode = result.nodes.find((n) => n.type === 'pull_request');
    expect(prNode).toBeUndefined();
  });

  it('result nodes: only original_commit present when adapter returns null', async () => {
    repo.commit(
      { 'src/auth.ts': 'line1\n' },
      'chore: init',
    );

    repo.branch('feature/x');
    repo.commit(
      { 'src/auth.ts': 'line1\nline2\n' },
      'feat: line2',
    );

    repo.checkout('main');
    enableFFMerge(repo.path);
    const squashCommit = repo.squashMerge('feature/x', 'feat: line2 (#77)');

    // adapter returns null for the squash commit
    const adapter = createMockPlatformAdapter({ prMap: new Map() });
    mockDetectPlatform.mockResolvedValue({
      adapter,
      remote: { platform: 'github', host: 'github.com', owner: 'test', repo: 'repo' },
    });

    const result = await trace({ file: 'src/auth.ts', line: 2 });

    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].type).toBe('original_commit');
    expect(result.nodes[0].sha).toBe(squashCommit);
  });
});
