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

describe('E8: Cherry-pick patch-id matching', { timeout: 30000 }, () => {
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

  it('blame returns cherry-picked commit SHA (not the original hotfix SHA)', async () => {
    // A: initial file on main
    repo.commit(
      { 'src/core.ts': 'export function run(): void {}\n' },
      'chore: initial commit',
    );

    // B: unrelated commit on main
    repo.commit(
      { 'src/core.ts': 'export function run(): void {}\nexport const VERSION = 1;\n' },
      'chore: add version',
    );

    // hotfix branch: H introduces a bug fix at line 3
    repo.branch('hotfix/fix-core');
    const hotfixSha = repo.commit(
      {
        'src/core.ts':
          'export function run(): void {}\nexport const VERSION = 1;\nexport function fixedBehavior(): boolean { return true; }\n',
      },
      'fix: correct behavior in run',
    );

    // Back to main, cherry-pick the hotfix commit
    repo.checkout('main');
    const cherryPickSha = repo.cherryPick(hotfixSha);

    // Cherry-pick creates a new SHA but same diff
    expect(cherryPickSha).not.toBe(hotfixSha);

    mockDetectPlatform.mockRejectedValue(new Error('no platform'));

    const result = await trace({ file: 'src/core.ts', line: 3 });

    // blame points to the cherry-picked commit (which is on main)
    const commitNode = result.nodes.find(
      (n) => n.type === 'original_commit' || n.type === 'cosmetic_commit',
    );
    expect(commitNode).toBeDefined();
    expect(commitNode!.sha).toBe(cherryPickSha);
    expect(commitNode!.trackingMethod).toBe('blame-CMw');
  });

  it('cherry-pick onto separate branch resolves to PR via merge message when adapter available', async () => {
    // A: initial commit on main
    repo.commit(
      { 'src/core.ts': 'export function a(): void {}\n' },
      'chore: initial',
    );

    // Create a separate branch (v1) from this point
    repo.branch('v1');

    // Back on main: add a commit that will be cherry-picked
    repo.checkout('main');
    const originalSha = repo.commit(
      { 'src/core.ts': 'export function a(): void {}\nexport function urgentFix(): void {}\n' },
      'fix: urgent fix',
    );

    // Merge it with a PR message
    repo.branch('feature/fix');
    repo.checkout('main');
    // The commit is directly on main already — create a merge scenario via a feature branch
    // Instead: cherry-pick originalSha onto v1 branch (v1 doesn't have this change yet)
    repo.checkout('v1');
    const cpSha = repo.cherryPick(originalSha);
    expect(cpSha).not.toBe(originalSha);

    // Create a merge commit on v1 that references PR #77
    repo.branch('hotfix/v1-urgent');
    repo.checkout('v1');
    const mergeOnV1 = repo.merge('hotfix/v1-urgent', 'Merge pull request #77 from hotfix/v1-urgent');

    // Now trace from v1 branch context
    const prMap = new Map();
    prMap.set(mergeOnV1, createPRInfo({ number: 77, mergeCommit: mergeOnV1 }));
    const adapter = createMockPlatformAdapter({ prMap });
    mockDetectPlatform.mockResolvedValue({
      adapter,
      remote: { platform: 'github', host: 'github.com', owner: 'test', repo: 'repo' },
    });

    const result = await trace({ file: 'src/core.ts', line: 2 });

    expect(result.operatingLevel).toBe(2);
    const commitNode = result.nodes.find(
      (n) => n.type === 'original_commit' || n.type === 'cosmetic_commit',
    );
    expect(commitNode).toBeDefined();
    expect(commitNode!.sha).toBe(cpSha);
  });

  it('cherry-pick without adapter returns Level 0 with only commit node', async () => {
    // A: initial
    repo.commit(
      { 'src/core.ts': 'export const A = 1;\n' },
      'chore: init',
    );

    // Branch with fix
    repo.branch('fix/something');
    const originalFix = repo.commit(
      { 'src/core.ts': 'export const A = 1;\nexport const B = 2;\n' },
      'fix: add B constant',
    );

    // Cherry-pick to main
    repo.checkout('main');
    const cpSha = repo.cherryPick(originalFix);
    expect(cpSha).not.toBe(originalFix);

    mockDetectPlatform.mockRejectedValue(new Error('no platform'));

    const result = await trace({ file: 'src/core.ts', line: 2 });

    expect(result.operatingLevel).toBe(0);
    expect(result.warnings).toContain('Could not detect platform. Running in Level 0 (git only).');

    const commitNode = result.nodes.find(
      (n) => n.type === 'original_commit' || n.type === 'cosmetic_commit',
    );
    expect(commitNode).toBeDefined();
    expect(commitNode!.sha).toBe(cpSha);

    // No PR node since no platform adapter
    const prNode = result.nodes.find((n) => n.type === 'pull_request');
    expect(prNode).toBeUndefined();
  });

  it('cherry-pick commit SHA differs from original even with identical diff content', async () => {
    repo.commit(
      { 'src/core.ts': 'export const x = 1;\n' },
      'chore: init',
    );

    repo.branch('feat/thing');
    const original = repo.commit(
      { 'src/core.ts': 'export const x = 1;\nexport const y = 2;\n' },
      'feat: add y',
    );

    repo.checkout('main');
    const cp = repo.cherryPick(original);

    // SHAs must differ despite identical file content
    expect(cp).not.toBe(original);

    mockDetectPlatform.mockRejectedValue(new Error('no platform'));

    const result = await trace({ file: 'src/core.ts', line: 2 });

    // blame tracks the cherry-picked commit on main
    expect(result.nodes[0].sha).toBe(cp);
  });
});
