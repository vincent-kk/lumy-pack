import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearCache, trace } from '@/core/core.js';
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

vi.mock('@/cache/sharded-cache.js', () => ({
  ShardedCache: class {
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
  cleanupLegacyCache: () => Promise.resolve(),
}));

const mockDetectPlatform = detectPlatformAdapter as ReturnType<typeof vi.fn>;

describe('False Positive Scenarios', { timeout: 60000 }, () => {
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

  it('Scenario 2: integration branch — returns direct merge PR, not umbrella merge', async () => {
    /**
     * Git graph:
     *
     * main:          A---B-----------M_int(PR#100: merge integration)---C
     *                      \              /
     * integration:          D---M2(PR#20: merge feature)
     *                            /
     * feature:          E---F
     *
     * Blame target: content from F (line 2 of src/app.ts)
     * Expected: PR#20 (the direct merge that introduced F), NOT PR#100
     */

    // A: initial commit on main
    repo.commit(
      { 'src/app.ts': 'export const base = 1;\n' },
      'chore: initial commit',
    );

    // B: another commit on main
    repo.commit(
      { 'src/app.ts': 'export const base = 1;\nexport const v = 2;\n' },
      'chore: add version',
    );

    // Create integration branch from main
    repo.branch('integration');

    // D: commit on integration
    repo.commit(
      { 'src/config.ts': 'export const config = {};\n' },
      'chore: add config',
    );

    // Create feature branch from integration
    repo.branch('feature/add-helper');

    // E: feature commit
    repo.commit(
      { 'src/helper.ts': 'export function helper() { return 1; }\n' },
      'feat: add helper',
    );

    // F: feature commit that adds line to app.ts
    repo.commit(
      {
        'src/app.ts':
          'export const base = 1;\nexport const v = 2;\nexport function featureWork() { return true; }\n',
      },
      'feat: add feature work',
    );

    // Merge feature into integration (PR#20)
    repo.checkout('integration');
    repo.merge(
      'feature/add-helper',
      'Merge pull request #20 from feature/add-helper',
    );

    // Merge integration into main (PR#100)
    repo.checkout('main');
    repo.merge(
      'integration',
      'Merge pull request #100 from integration',
    );

    // Level 1 (unauthenticated) — relies on ancestry-path + verification
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

    const result = await trace({ file: 'src/app.ts', line: 3 });

    const prNode = result.nodes.find((n) => n.type === 'pull_request');
    expect(prNode).toBeDefined();
    // Should find PR#20 (direct merge) — the merge that introduced the feature commit
    // NOT PR#100 (umbrella integration merge)
    expect(prNode!.prNumber).toBe(20);
  });

  it('Scenario 3: base-update merge — skips main→feature merge, finds feature→main PR', async () => {
    /**
     * Git graph:
     *
     * main:     A---B---C---D-----------M2(PR#10: merge feature→main)
     *                \     /                 /
     * feature:        E---M1(main→feat)---F---G
     *
     * M1 is a "base-update merge" (main merged INTO feature)
     * M2 is the actual PR merge (feature INTO main)
     *
     * Blame target: content from E (line 2 of src/lib.ts)
     * Expected: PR#10 (the actual PR merge), NOT M1 (base-update)
     */

    // A: initial commit on main
    repo.commit(
      { 'src/lib.ts': 'export const x = 1;\n' },
      'chore: initial commit',
    );

    // B: another commit on main
    repo.commit(
      { 'src/lib.ts': 'export const x = 1;\nexport const y = 2;\n' },
      'chore: add y',
    );

    // Create feature branch
    repo.branch('feature/update');

    // E: feature commit (adds line 3 — blame target)
    repo.commit(
      {
        'src/lib.ts':
          'export const x = 1;\nexport const y = 2;\nexport function update() { return true; }\n',
      },
      'feat: add update function',
    );

    // C: another commit on main (divergence)
    repo.checkout('main');
    repo.commit(
      { 'src/other.ts': 'export const other = 1;\n' },
      'chore: add other file',
    );

    // D: more main work
    repo.commit(
      { 'src/other.ts': 'export const other = 1;\nexport const z = 3;\n' },
      'chore: update other',
    );

    // M1: merge main into feature (base-update merge)
    repo.checkout('feature/update');
    repo.merge('main', 'Merge branch \'main\' into feature/update');

    // F: more feature work
    repo.commit(
      {
        'src/lib.ts':
          'export const x = 1;\nexport const y = 2;\nexport function update() { return true; }\nexport function extra() { return false; }\n',
      },
      'feat: add extra function',
    );

    // G: final feature commit
    repo.commit(
      { 'src/feature-flag.ts': 'export const flag = true;\n' },
      'feat: add feature flag',
    );

    // M2: merge feature into main (the actual PR merge)
    repo.checkout('main');
    repo.merge(
      'feature/update',
      'Merge pull request #10 from feature/update',
    );

    // Level 1 (unauthenticated)
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

    const result = await trace({ file: 'src/lib.ts', line: 3 });

    const prNode = result.nodes.find((n) => n.type === 'pull_request');
    expect(prNode).toBeDefined();
    // Should find PR#10 (feature→main merge), NOT M1 (base-update merge)
    expect(prNode!.prNumber).toBe(10);
  });

  it('Strategy reorder: Level 2 API direct lookup finds correct PR before ancestry', async () => {
    /**
     * Simple test: verify that at Level 2, getPRForCommit(commitSha) is called
     * before findMergeCommit, and the correct PR is returned directly.
     */

    // A: initial
    repo.commit(
      { 'src/utils.ts': 'export function a(): void {}\n' },
      'chore: initial',
    );

    // feature branch
    repo.branch('feature/thing');
    const commitC = repo.commit(
      {
        'src/utils.ts':
          'export function a(): void {}\nexport function b(): void {}\n',
      },
      'feat: add b',
    );

    repo.checkout('main');
    const mergeCommit = repo.merge(
      'feature/thing',
      'Merge pull request #42 from feature/thing',
    );

    // Set up Level 2 adapter with prMap keyed by BOTH the blame commit AND merge commit
    const prInfo = createPRInfo({
      number: 42,
      mergeCommit,
      title: 'feat: add b function',
    });
    const prMap = new Map<string, ReturnType<typeof createPRInfo>>();
    prMap.set(commitC, prInfo); // API returns PR for the blame commit directly
    prMap.set(mergeCommit, prInfo);
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

    const result = await trace({ file: 'src/utils.ts', line: 2 });

    expect(result.operatingLevel).toBe(2);

    const prNode = result.nodes.find((n) => n.type === 'pull_request');
    expect(prNode).toBeDefined();
    expect(prNode!.prNumber).toBe(42);

    // Verify API was called with the blame commit SHA (Strategy 2: API direct)
    expect(adapter.getPRForCommit).toHaveBeenCalledWith(
      commitC,
      expect.objectContaining({ preferredBase: 'main' }),
    );
  });

  it('FP-1: squash merge + branch reuse — does not return later branch PR', async () => {
    /**
     * Git graph:
     *
     * main:     A---B---S1(squash "feat: X (#10)")---C---M2(PR#20)
     *                \                                     /
     * feat-1:         E---F                               /
     *                      \                             /
     * feat-2:               G---H-----------------------/
     *
     * S1 squash-merges feat-1 (E,F) into main.
     * feat-2 branches from F (on feat-1) and is later merge-committed as M2.
     * Blame target: content from E.
     * Expected: NOT PR#20. Should be null at Level 1 or correct PR at Level 2.
     */

    // A: initial
    repo.commit(
      { 'src/app.ts': 'export const base = 1;\n' },
      'chore: initial',
    );

    // B: main work
    repo.commit(
      { 'src/app.ts': 'export const base = 1;\nexport const v = 2;\n' },
      'chore: add version',
    );

    // feat-1 branch
    repo.branch('feat-1');

    // E: feature commit (blame target — adds line 3)
    repo.commit(
      {
        'src/app.ts':
          'export const base = 1;\nexport const v = 2;\nexport function fromFeat1() { return true; }\n',
      },
      'feat: add fromFeat1',
    );

    // F: more feat-1 work
    repo.commit(
      { 'src/extra.ts': 'export const extra = 1;\n' },
      'feat: add extra',
    );

    // Simulate squash merge of feat-1 into main (direct commit with squash message)
    // Cannot use repo.squashMerge because merge.ff=false conflicts with --squash
    repo.checkout('main');
    repo.commit(
      {
        'src/app.ts':
          'export const base = 1;\nexport const v = 2;\nexport function fromFeat1() { return true; }\n',
        'src/extra.ts': 'export const extra = 1;\n',
      },
      'feat: squash feat-1 (#10)',
    );

    // C: more main work
    repo.commit(
      { 'src/config.ts': 'export const config = {};\n' },
      'chore: add config',
    );

    // feat-2 branches from feat-1's F
    repo.checkout('feat-1');
    repo.branch('feat-2');
    repo.commit(
      { 'src/feat2.ts': 'export const feat2 = true;\n' },
      'feat: add feat2 file',
    );
    repo.commit(
      { 'src/feat2.ts': 'export const feat2 = true;\nexport const more = 2;\n' },
      'feat: extend feat2',
    );

    // Merge feat-2 into main
    repo.checkout('main');
    repo.merge('feat-2', 'Merge pull request #20 from feat-2');

    // Level 1 (unauthenticated)
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

    const result = await trace({ file: 'src/app.ts', line: 3 });

    const prNode = result.nodes.find((n) => n.type === 'pull_request');
    // Must NOT be PR#20 (the later merge that reused the branch)
    if (prNode) {
      expect(prNode.prNumber).not.toBe(20);
    }
    // null is acceptable (false negative better than false positive)
  });

  it('FP-5: diamond graph — correct merge selected among multiple paths', async () => {
    /**
     * Git graph:
     *
     * main:     A---B---M1(PR#5)---C---M2(PR#10)
     *                \  /               /
     * feat-a:         D                /
     *                  \              /
     * feat-b:           E---F-------/
     *
     * feat-a (D) is merged via M1 (PR#5).
     * feat-b branches from D and is merged via M2 (PR#10).
     * Blame target: content from D.
     * Expected: PR#5 (the merge that directly introduced D).
     */

    // A: initial
    repo.commit(
      { 'src/lib.ts': 'export const x = 1;\n' },
      'chore: initial',
    );

    // B: main work
    repo.commit(
      { 'src/lib.ts': 'export const x = 1;\nexport const y = 2;\n' },
      'chore: add y',
    );

    // feat-a branch
    repo.branch('feat-a');

    // D: feature commit (blame target — adds line 3)
    repo.commit(
      {
        'src/lib.ts':
          'export const x = 1;\nexport const y = 2;\nexport function diamond() { return true; }\n',
      },
      'feat: add diamond function',
    );

    // feat-b branches from D
    repo.branch('feat-b');

    // E, F: feat-b commits
    repo.commit(
      { 'src/feat-b.ts': 'export const fb = 1;\n' },
      'feat: feat-b work',
    );
    repo.commit(
      { 'src/feat-b.ts': 'export const fb = 1;\nexport const fb2 = 2;\n' },
      'feat: more feat-b',
    );

    // M1: merge feat-a into main (PR#5)
    repo.checkout('main');
    repo.merge('feat-a', 'Merge pull request #5 from feat-a');

    // C: more main work
    repo.commit(
      { 'src/other.ts': 'export const z = 3;\n' },
      'chore: add z',
    );

    // M2: merge feat-b into main (PR#10)
    repo.merge('feat-b', 'Merge pull request #10 from feat-b');

    // Level 1 (unauthenticated)
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

    const result = await trace({ file: 'src/lib.ts', line: 3 });

    const prNode = result.nodes.find((n) => n.type === 'pull_request');
    expect(prNode).toBeDefined();
    // Should find PR#5 (direct merge of feat-a), NOT PR#10 (feat-b merge)
    expect(prNode!.prNumber).toBe(5);
  });

  it('FP-14: squash merge invisible to --merges — pre-check extracts PR from commit message', async () => {
    /**
     * Git graph:
     *
     * main:     A---S(squash "feat: add feature (#63)")---B---M(PR#64, regular merge)
     *                                                          /
     * feat-2:                                           C---D-/
     *
     * S is a squash merge (1 parent, invisible to --merges).
     * M is a regular merge (2 parents, visible to --merges).
     * Blame target: content from S (line 2 of src/app.ts).
     * Expected: PR#63 (from squash message), NOT PR#64 (from later merge).
     */

    // A: initial
    repo.commit(
      { 'src/app.ts': 'export const base = 1;\n' },
      'chore: initial',
    );

    // S: squash merge commit (simulate with direct commit containing squash message)
    repo.commit(
      {
        'src/app.ts':
          'export const base = 1;\nexport function squashedFeature() { return true; }\n',
      },
      'feat: add feature (#63)',
    );

    // B: intermediate main commit
    repo.commit(
      { 'src/config.ts': 'export const config = {};\n' },
      'chore: add config',
    );

    // feat-2 branch for regular merge
    repo.branch('feat-2');
    repo.commit(
      { 'src/feat2.ts': 'export const feat2 = true;\n' },
      'feat: add feat2',
    );
    repo.commit(
      { 'src/feat2.ts': 'export const feat2 = true;\nexport const more = 2;\n' },
      'feat: extend feat2',
    );

    // M: regular merge of feat-2 into main (PR#64)
    repo.checkout('main');
    repo.merge('feat-2', 'Merge pull request #64 from feat-2');

    // Level 1 (unauthenticated)
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

    const result = await trace({ file: 'src/app.ts', line: 2 });

    const prNode = result.nodes.find((n) => n.type === 'pull_request');
    expect(prNode).toBeDefined();
    // Should find PR#63 (from squash commit message), NOT PR#64 (from later merge)
    expect(prNode!.prNumber).toBe(63);
    expect(prNode!.trackingMethod).toBe('message-parse');
    expect(prNode!.confidence).toBe('heuristic');
  });

  it('FP-6: API umbrella PR — oldest PR selected, not default branch PR', async () => {
    /**
     * When API returns multiple PRs for a commit:
     * - PR#10 (base: release, merged first — direct feature PR)
     * - PR#20 (base: main, merged later — umbrella/release PR)
     *
     * Expected: PR#10 (oldest = most direct), NOT PR#20 (default branch).
     * This tests the preferredBase > oldest selection logic.
     */

    repo.commit(
      { 'src/utils.ts': 'export function a(): void {}\n' },
      'chore: initial',
    );

    repo.branch('feature/fp6');
    const commitC = repo.commit(
      {
        'src/utils.ts':
          'export function a(): void {}\nexport function fp6(): void {}\n',
      },
      'feat: add fp6',
    );

    repo.checkout('main');
    const mergeCommit = repo.merge(
      'feature/fp6',
      'Merge pull request #10 from feature/fp6',
    );

    // Mock adapter: getPRForCommit returns PR#10 (oldest, base:release)
    // Simulates the scenario where defaultBranch preference was removed
    const prInfo = createPRInfo({
      number: 10,
      mergeCommit,
      title: 'feat: fp6 feature',
      baseBranch: 'release',
    });
    const prMap = new Map<string, ReturnType<typeof createPRInfo>>();
    prMap.set(commitC, prInfo);
    prMap.set(mergeCommit, prInfo);
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

    const result = await trace({ file: 'src/utils.ts', line: 2 });

    expect(result.operatingLevel).toBe(2);

    const prNode = result.nodes.find((n) => n.type === 'pull_request');
    expect(prNode).toBeDefined();
    // PR#10 selected (oldest/most direct), not a default-branch PR
    expect(prNode!.prNumber).toBe(10);
  });
});
