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

/** Build a 20-line config file. */
function makeConfig(lines: string[]): string {
  return lines.join('\n') + '\n';
}

describe('E9: Range trace deduplication', { timeout: 30000 }, () => {
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

  it('range spanning two commits produces at least two unique commit SHAs', async () => {
    const initialLines = Array.from({ length: 20 }, (_, i) => `// placeholder line ${i + 1}`);

    // A: initial file with 20 placeholder lines
    repo.commit(
      { 'src/config.ts': makeConfig(initialLines) },
      'chore: initial config',
    );

    // feature-1 replaces lines 1-10
    repo.branch('feature/part1');
    const part1Lines = [
      'export const DB_HOST = "localhost";',
      'export const DB_PORT = 5432;',
      'export const DB_NAME = "mydb";',
      'export const DB_USER = "admin";',
      'export const DB_PASS = "secret";',
      'export const DB_POOL_MIN = 2;',
      'export const DB_POOL_MAX = 10;',
      'export const DB_TIMEOUT = 30000;',
      'export const DB_RETRIES = 3;',
      'export const DB_SSL = true;',
      ...initialLines.slice(10),
    ];
    repo.commit(
      { 'src/config.ts': makeConfig(part1Lines) },
      'feat: configure database settings',
    );

    repo.checkout('main');
    const merge1 = repo.merge('feature/part1', 'Merge pull request #10 from feature/part1');

    // feature-2 replaces lines 11-20
    repo.branch('feature/part2');
    const part2Lines = [
      ...part1Lines.slice(0, 10),
      'export const API_HOST = "0.0.0.0";',
      'export const API_PORT = 3000;',
      'export const API_PREFIX = "/api/v1";',
      'export const API_TIMEOUT = 5000;',
      'export const API_RATE_LIMIT = 100;',
      'export const LOG_LEVEL = "info";',
      'export const LOG_FORMAT = "json";',
      'export const LOG_FILE = "/var/log/app.log";',
      'export const METRICS_PORT = 9090;',
      'export const HEALTH_PATH = "/health";',
    ];
    repo.commit(
      { 'src/config.ts': makeConfig(part2Lines) },
      'feat: configure API and logging settings',
    );

    repo.checkout('main');
    const merge2 = repo.merge('feature/part2', 'Merge pull request #20 from feature/part2');

    const prMap = new Map();
    prMap.set(merge1, createPRInfo({ number: 10, mergeCommit: merge1, title: 'Database settings' }));
    prMap.set(merge2, createPRInfo({ number: 20, mergeCommit: merge2, title: 'API and logging' }));
    const adapter = createMockPlatformAdapter({ prMap });
    mockDetectPlatform.mockResolvedValue({
      adapter,
      remote: { platform: 'github', host: 'github.com', owner: 'test', repo: 'repo' },
    });

    const result = await trace({ file: 'src/config.ts', line: 1, endLine: 20 });

    // Should have commit nodes for both ranges
    const commitNodes = result.nodes.filter(
      (n) => n.type === 'original_commit' || n.type === 'cosmetic_commit',
    );
    expect(commitNodes.length).toBeGreaterThanOrEqual(2);

    // Unique commit SHAs — deduplication removes duplicate blame entries
    const uniqueShas = new Set(commitNodes.map((n) => n.sha));
    expect(uniqueShas.size).toBeGreaterThanOrEqual(2);
  });

  it('range within a single commit produces only one commit node', async () => {
    const lines = Array.from({ length: 10 }, (_, i) => `export const VAR_${i + 1} = ${i + 1};`);

    repo.commit(
      { 'src/config.ts': makeConfig(lines) },
      'chore: initial',
    );

    repo.branch('feature/all-vars');
    const newLines = lines.map((l) => l.replace('= ', '= /* updated */ '));
    const featureCommit = repo.commit(
      { 'src/config.ts': makeConfig(newLines) },
      'feat: update all vars',
    );

    repo.checkout('main');
    const mergeCommit = repo.merge('feature/all-vars', 'Merge pull request #5 from feature/all-vars');

    const prMap = new Map();
    prMap.set(mergeCommit, createPRInfo({ number: 5, mergeCommit }));
    const adapter = createMockPlatformAdapter({ prMap });
    mockDetectPlatform.mockResolvedValue({
      adapter,
      remote: { platform: 'github', host: 'github.com', owner: 'test', repo: 'repo' },
    });

    const result = await trace({ file: 'src/config.ts', line: 1, endLine: 10 });

    // All 10 lines come from the same commit — unique SHAs should be just one
    const commitNodes = result.nodes.filter(
      (n) => n.type === 'original_commit' || n.type === 'cosmetic_commit',
    );
    expect(commitNodes.length).toBeGreaterThanOrEqual(1);
    const uniqueShas = new Set(commitNodes.map((n) => n.sha));
    expect(uniqueShas.size).toBe(1);
    expect([...uniqueShas][0]).toBe(featureCommit);
  });

  it('range trace result contains PR nodes for each unique commit', async () => {
    const initial = Array.from({ length: 4 }, (_, i) => `// init ${i}`);
    repo.commit({ 'src/config.ts': makeConfig(initial) }, 'chore: init');

    // First feature: changes lines 1-2
    repo.branch('feature/a');
    repo.commit(
      { 'src/config.ts': makeConfig(['export const A1 = 1;', 'export const A2 = 2;', '// init 2', '// init 3']) },
      'feat: add A constants',
    );
    repo.checkout('main');
    const mergeA = repo.merge('feature/a', 'Merge pull request #31 from feature/a');

    // Second feature: changes lines 3-4
    repo.branch('feature/b');
    repo.commit(
      { 'src/config.ts': makeConfig(['export const A1 = 1;', 'export const A2 = 2;', 'export const B3 = 3;', 'export const B4 = 4;']) },
      'feat: add B constants',
    );
    repo.checkout('main');
    const mergeB = repo.merge('feature/b', 'Merge pull request #32 from feature/b');

    const prMap = new Map();
    prMap.set(mergeA, createPRInfo({ number: 31, mergeCommit: mergeA, url: 'https://github.com/test/repo/pull/31' }));
    prMap.set(mergeB, createPRInfo({ number: 32, mergeCommit: mergeB, url: 'https://github.com/test/repo/pull/32' }));
    const adapter = createMockPlatformAdapter({ prMap });
    mockDetectPlatform.mockResolvedValue({
      adapter,
      remote: { platform: 'github', host: 'github.com', owner: 'test', repo: 'repo' },
    });

    const result = await trace({ file: 'src/config.ts', line: 1, endLine: 4 });

    const prNodes = result.nodes.filter((n) => n.type === 'pull_request');
    const prNumbers = prNodes.map((n) => n.prNumber);

    // Both PRs should be represented in the result
    expect(prNumbers).toContain(31);
    expect(prNumbers).toContain(32);
  });

  it('single-line trace (no endLine) returns one commit node', async () => {
    repo.commit(
      { 'src/config.ts': 'export const HOST = "localhost";\n' },
      'chore: init',
    );

    repo.branch('feature/host');
    const featureCommit = repo.commit(
      { 'src/config.ts': 'export const HOST = "localhost";\nexport const PORT = 8080;\n' },
      'feat: add PORT',
    );

    repo.checkout('main');
    const mergeCommit = repo.merge('feature/host', 'Merge pull request #1 from feature/host');

    const prMap = new Map();
    prMap.set(mergeCommit, createPRInfo({ number: 1, mergeCommit }));
    const adapter = createMockPlatformAdapter({ prMap });
    mockDetectPlatform.mockResolvedValue({
      adapter,
      remote: { platform: 'github', host: 'github.com', owner: 'test', repo: 'repo' },
    });

    const result = await trace({ file: 'src/config.ts', line: 2 });

    const commitNodes = result.nodes.filter(
      (n) => n.type === 'original_commit' || n.type === 'cosmetic_commit',
    );
    expect(commitNodes).toHaveLength(1);
    expect(commitNodes[0].sha).toBe(featureCommit);
  });
});
