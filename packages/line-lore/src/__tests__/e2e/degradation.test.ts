import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { RepoBuilder } from '../helpers/repo-builder.js';
import {
  createMockPlatformAdapter,
  createPRInfo,
  createUnauthenticatedAdapter,
} from '../helpers/mock-platform.js';

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

/** Build a minimal repo with a single feature merge and return its SHAs. */
async function buildFeatureRepo(repo: RepoBuilder): Promise<{
  featureCommit: string;
  mergeCommit: string;
}> {
  repo.commit(
    { 'src/service.ts': 'export function existing(): void {}\n' },
    'chore: initial commit',
  );

  repo.branch('feature/new-service');
  const featureCommit = repo.commit(
    {
      'src/service.ts':
        'export function existing(): void {}\nexport function newService(): string { return "ok"; }\n',
    },
    'feat: add newService',
  );

  repo.checkout('main');
  const mergeCommit = repo.merge(
    'feature/new-service',
    'Merge pull request #55 from feature/new-service',
  );

  return { featureCommit, mergeCommit };
}

describe('E10: Operating level fallback (graceful degradation)', { timeout: 30000 }, () => {
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

  it('Level 2 (full): authenticated adapter returns full PR info via API', async () => {
    const { featureCommit, mergeCommit } = await buildFeatureRepo(repo);

    const prInfo = createPRInfo({
      number: 55,
      mergeCommit,
      title: 'feat: add newService',
      url: 'https://github.com/test/repo/pull/55',
    });
    const prMap = new Map<string, typeof prInfo>();
    prMap.set(mergeCommit, prInfo);

    const adapter = createMockPlatformAdapter({ authenticated: true, prMap });
    mockDetectPlatform.mockResolvedValue({
      adapter,
      remote: { platform: 'github', host: 'github.com', owner: 'test', repo: 'repo' },
    });

    const result = await trace({ file: 'src/service.ts', line: 2 });

    expect(result.operatingLevel).toBe(2);
    expect(result.warnings).toHaveLength(0);
    expect(result.featureFlags.graphql).toBe(true);

    const commitNode = result.nodes.find(
      (n) => n.type === 'original_commit' || n.type === 'cosmetic_commit',
    );
    expect(commitNode).toBeDefined();
    expect(commitNode!.sha).toBe(featureCommit);

    const prNode = result.nodes.find((n) => n.type === 'pull_request');
    expect(prNode).toBeDefined();
    expect(prNode!.prNumber).toBe(55);
    expect(prNode!.prUrl).toBe('https://github.com/test/repo/pull/55');
    expect(prNode!.prTitle).toBe('feat: add newService');
    expect(prNode!.trackingMethod).toBe('api');
    expect(prNode!.confidence).toBe('exact');
  });

  it('Level 1 (partial): unauthenticated adapter falls back to message-parse only', async () => {
    await buildFeatureRepo(repo);

    const adapter = createUnauthenticatedAdapter();
    mockDetectPlatform.mockResolvedValue({
      adapter,
      remote: { platform: 'github', host: 'github.com', owner: 'test', repo: 'repo' },
    });

    const result = await trace({ file: 'src/service.ts', line: 2 });

    expect(result.operatingLevel).toBe(1);
    expect(result.warnings).toContain(
      'Platform CLI not authenticated. Running in Level 1 (local only).',
    );
    expect(result.featureFlags.graphql).toBe(false);
    expect(result.featureFlags.deepTrace).toBe(false);

    const prNode = result.nodes.find((n) => n.type === 'pull_request');
    expect(prNode).toBeDefined();
    expect(prNode!.prNumber).toBe(55);
    expect(prNode!.trackingMethod).toBe('message-parse');
    expect(prNode!.confidence).toBe('heuristic');
    // No URL from message-parse
    expect(prNode!.prUrl).toBeFalsy();
  });

  it('Level 0 (git only): detectPlatformAdapter throws → no platform, message-parse only', async () => {
    await buildFeatureRepo(repo);

    mockDetectPlatform.mockRejectedValue(new Error('no platform'));

    const result = await trace({ file: 'src/service.ts', line: 2 });

    expect(result.operatingLevel).toBe(0);
    expect(result.warnings).toContain(
      'Could not detect platform. Running in Level 0 (git only).',
    );
    expect(result.featureFlags.graphql).toBe(false);
    expect(result.featureFlags.deepTrace).toBe(false);
    expect(result.featureFlags.issueGraph).toBe(false);

    // Still finds PR via merge message parsing even at Level 0
    const prNode = result.nodes.find((n) => n.type === 'pull_request');
    expect(prNode).toBeDefined();
    expect(prNode!.prNumber).toBe(55);
    expect(prNode!.trackingMethod).toBe('message-parse');
  });

  it('Level 2 featureFlags reflect full capabilities', async () => {
    const { mergeCommit } = await buildFeatureRepo(repo);

    const prMap = new Map();
    prMap.set(mergeCommit, createPRInfo({ number: 55, mergeCommit }));
    const adapter = createMockPlatformAdapter({ authenticated: true, prMap });
    mockDetectPlatform.mockResolvedValue({
      adapter,
      remote: { platform: 'github', host: 'github.com', owner: 'test', repo: 'repo' },
    });

    const result = await trace({ file: 'src/service.ts', line: 2 });

    expect(result.featureFlags).toMatchObject({
      deepTrace: false,  // options.deep not set
      commitGraph: false,
      issueGraph: false, // options.graphDepth not set
      graphql: true,     // Level 2
    });
    // astDiff depends on isAstAvailable() — may be false or undefined in test env
    expect(result.featureFlags.astDiff).toBeFalsy();
  });

  it('Level 0 featureFlags disable all platform-dependent features', async () => {
    await buildFeatureRepo(repo);

    mockDetectPlatform.mockRejectedValue(new Error('no platform'));

    const result = await trace({ file: 'src/service.ts', line: 2 });

    expect(result.featureFlags).toMatchObject({
      deepTrace: false,
      commitGraph: false,
      issueGraph: false,
      graphql: false,
    });
    expect(result.featureFlags.astDiff).toBeFalsy();
  });
});
