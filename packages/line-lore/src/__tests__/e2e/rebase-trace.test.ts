import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { trace } from '@/core/core.js';
import { detectPlatformAdapter } from '@/platform/index.js';

import {
  createMockPlatformAdapter,
  createPRInfo,
  createUnauthenticatedAdapter,
} from '../helpers/mock-platform.js';
import { RepoBuilder } from '../helpers/repo-builder.js';

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
    async get(key: string) {
      return this.store.get(key) ?? null;
    }
    async set(key: string, value: unknown) {
      this.store.set(key, value);
    }
    async clear() {
      this.store.clear();
    }
  },
}));

const mockDetectPlatform = detectPlatformAdapter as ReturnType<typeof vi.fn>;

describe('E3: Rebase Merge trace', { timeout: 30000 }, () => {
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

  it('blame finds the rebased commit C-prime (new SHA, not original C)', async () => {
    // A: initial file on main
    repo.commit(
      {
        'src/index.ts': 'export const A = 1;\n',
        'src/main.ts': 'export const MAIN = true;\n',
      },
      'chore: initial',
    );

    // feature branch from A — touches only src/index.ts
    repo.branch('feature/add-c');
    const originalC = repo.commit(
      { 'src/index.ts': 'export const A = 1;\nexport const C = 3;\n' },
      'feat: add C',
    );

    // B: commit on main touching a DIFFERENT file — no conflict when rebasing
    repo.checkout('main');
    repo.commit(
      { 'src/main.ts': 'export const MAIN = true;\nexport const B = 2;\n' },
      'chore: add B on main',
    );

    // rebase feature onto updated main — C gets a new parent → new SHA
    repo.checkout('feature/add-c');
    repo.rebaseOnto('main');
    const rebasedC = repo.getHead();

    // after rebase onto a different parent, the SHA must differ from original
    expect(rebasedC).not.toBe(originalC);

    repo.checkout('main');
    const finalHead = repo.fastForwardMerge('feature/add-c');

    const adapter = createMockPlatformAdapter({ prMap: new Map() });
    mockDetectPlatform.mockResolvedValue({
      adapter,
      remote: {
        platform: 'github',
        host: 'github.com',
        owner: 'test',
        repo: 'repo',
      },
    });

    const result = await trace({ file: 'src/index.ts', line: 2 });

    // blame must point to the rebased commit (C'), not original C
    const originalNode = result.nodes.find((n) => n.type === 'original_commit');
    expect(originalNode).toBeDefined();
    expect(originalNode!.sha).toBe(rebasedC);
    expect(originalNode!.sha).toBe(finalHead);
    expect(originalNode!.sha).not.toBe(originalC);
  });

  it('no merge commit exists after rebase + fast-forward', async () => {
    repo.commit(
      {
        'src/index.ts': 'export const A = 1;\n',
        'src/other.ts': 'export const X = 0;\n',
      },
      'chore: initial',
    );

    repo.branch('feature/ff');
    repo.commit(
      { 'src/index.ts': 'export const A = 1;\nexport const B = 2;\n' },
      'feat: add B',
    );

    // Add a commit on main (different file) so rebase produces a new SHA
    repo.checkout('main');
    repo.commit(
      { 'src/other.ts': 'export const X = 0;\nexport const Y = 1;\n' },
      'chore: update other',
    );

    repo.checkout('feature/ff');
    repo.rebaseOnto('main');
    repo.checkout('main');
    repo.fastForwardMerge('feature/ff');

    const adapter = createMockPlatformAdapter({ prMap: new Map() });
    mockDetectPlatform.mockResolvedValue({
      adapter,
      remote: {
        platform: 'github',
        host: 'github.com',
        owner: 'test',
        repo: 'repo',
      },
    });

    const result = await trace({ file: 'src/index.ts', line: 2 });

    // fast-forward produces no merge commit
    const mergeNodes = result.nodes.filter((n) => n.type === 'merge_commit');
    expect(mergeNodes).toHaveLength(0);
  });

  it('without adapter: no PR found (no merge commit, no message to parse)', async () => {
    repo.commit(
      {
        'src/index.ts': 'export const A = 1;\n',
        'src/other.ts': 'export const X = 0;\n',
      },
      'chore: initial',
    );

    repo.branch('feature/ff');
    repo.commit(
      {
        'src/index.ts': 'export const A = 1;\nexport function fn(): void {}\n',
      },
      'feat: plain commit message',
    );

    repo.checkout('main');
    repo.commit(
      { 'src/other.ts': 'export const X = 0;\nexport const Y = 1;\n' },
      'chore: update other',
    );

    repo.checkout('feature/ff');
    repo.rebaseOnto('main');
    repo.checkout('main');
    repo.fastForwardMerge('feature/ff');

    // Level 1: unauthenticated — no API, no merge commit message to parse
    const adapter = createUnauthenticatedAdapter();
    mockDetectPlatform.mockResolvedValue({
      adapter,
      remote: {
        platform: 'github',
        host: 'github.com',
        owner: 'test',
        repo: 'repo',
      },
    });

    const result = await trace({ file: 'src/index.ts', line: 2 });

    expect(result.operatingLevel).toBe(1);

    // No merge commit → findMergeCommit returns null → no message-parse → no PR node
    const prNode = result.nodes.find((n) => n.type === 'pull_request');
    expect(prNode).toBeUndefined();
  });

  it('with adapter: getPRForCommit(rebasedSha) can find PR when API knows the rebased SHA', async () => {
    repo.commit(
      {
        'src/index.ts': 'export const A = 1;\n',
        'src/other.ts': 'export const X = 0;\n',
      },
      'chore: initial',
    );

    repo.branch('feature/with-pr');
    repo.commit(
      {
        'src/index.ts': 'export const A = 1;\nexport function fn(): void {}\n',
      },
      'feat: add fn',
    );

    repo.checkout('main');
    repo.commit(
      { 'src/other.ts': 'export const X = 0;\nexport const Y = 1;\n' },
      'chore: update other',
    );

    repo.checkout('feature/with-pr');
    repo.rebaseOnto('main');
    const rebasedSha = repo.getHead();
    repo.checkout('main');
    repo.fastForwardMerge('feature/with-pr');

    // API maps the rebased SHA to a PR
    const prInfo = createPRInfo({
      number: 77,
      mergeCommit: rebasedSha,
      title: 'feat: add fn',
      url: 'https://github.com/test/repo/pull/77',
    });
    const prMap = new Map();
    prMap.set(rebasedSha, prInfo);
    const adapter = createMockPlatformAdapter({ prMap });
    mockDetectPlatform.mockResolvedValue({
      adapter,
      remote: {
        platform: 'github',
        host: 'github.com',
        owner: 'test',
        repo: 'repo',
      },
    });

    const result = await trace({ file: 'src/index.ts', line: 2 });

    expect(result.operatingLevel).toBe(2);

    const prNode = result.nodes.find((n) => n.type === 'pull_request');
    expect(prNode).toBeDefined();
    expect(prNode!.prNumber).toBe(77);
    expect(prNode!.trackingMethod).toBe('api');
    expect(prNode!.confidence).toBe('exact');
  });

  it('blame SHA is the rebased version — verified by checking it differs from original', async () => {
    repo.commit(
      { 'src/index.ts': 'const x = 1;\n', 'src/other.ts': 'const z = 0;\n' },
      'chore: init',
    );

    // feature branch: commit on a separate file from what main will touch
    repo.branch('feature/verify-sha');
    const originalSha = repo.commit(
      { 'src/index.ts': 'const x = 1;\nconst y = 2;\n' },
      'feat: add y',
    );

    // main advances on a different file → rebase changes the parent → new SHA
    repo.checkout('main');
    repo.commit(
      { 'src/other.ts': 'const z = 0;\nconst w = 3;\n' },
      'chore: update other',
    );

    repo.checkout('feature/verify-sha');
    repo.rebaseOnto('main');
    const rebasedSha = repo.getHead();

    // Rebasing onto a different parent creates a new commit object
    expect(rebasedSha).not.toBe(originalSha);

    repo.checkout('main');
    repo.fastForwardMerge('feature/verify-sha');

    const adapter = createMockPlatformAdapter({ prMap: new Map() });
    mockDetectPlatform.mockResolvedValue({
      adapter,
      remote: {
        platform: 'github',
        host: 'github.com',
        owner: 'test',
        repo: 'repo',
      },
    });

    const result = await trace({ file: 'src/index.ts', line: 2 });

    const originalNode = result.nodes.find((n) => n.type === 'original_commit');
    expect(originalNode).toBeDefined();
    // blame must report the rebased SHA
    expect(originalNode!.sha).toBe(rebasedSha);
    // and it must NOT be the original feature branch SHA
    expect(originalNode!.sha).not.toBe(originalSha);
  });
});
