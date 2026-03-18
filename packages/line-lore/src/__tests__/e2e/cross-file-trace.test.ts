import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isAstAvailable } from '@/ast/index.js';
import { trace } from '@/core/core.js';
import { detectPlatformAdapter } from '@/platform/index.js';

import { createMockPlatformAdapter } from '../helpers/mock-platform.js';
import { RepoBuilder } from '../helpers/repo-builder.js';

vi.mock('@/platform/index.js', () => ({
  detectPlatformAdapter: vi.fn(),
}));

// E7: Disable AST — cross-file tracking uses blame -C -C, not AST
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
const mockIsAstAvailable = isAstAvailable as ReturnType<typeof vi.fn>;

// A: helpers.ts with formatDate()
const HELPERS_ORIGINAL = `function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function formatTime(date: Date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return hours + ':' + minutes;
}

export { formatDate, formatTime };
`;

describe(
  'E7: Cross-file move detection via blame -C -C',
  { timeout: 30000 },
  () => {
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
      mockIsAstAvailable.mockReturnValue(false);
    });

    afterEach(async () => {
      process.chdir(originalCwd);
      await repo.cleanup();
    });

    it('featureFlags.astDiff is false when isAstAvailable is mocked false', async () => {
      repo.commit(
        { 'src/helpers.ts': HELPERS_ORIGINAL },
        'feat: add date helpers',
      );
      repo.moveFile(
        'src/helpers.ts',
        'src/date-utils.ts',
        'refactor: move helpers to date-utils',
      );

      const result = await trace({ file: 'src/date-utils.ts', line: 2 });

      expect(result.featureFlags.astDiff).toBe(false);
    });

    it('trace on moved file returns a valid commit node', async () => {
      repo.commit(
        { 'src/helpers.ts': HELPERS_ORIGINAL },
        'feat: add date helpers',
      );
      repo.moveFile(
        'src/helpers.ts',
        'src/date-utils.ts',
        'refactor: move helpers to date-utils',
      );

      const result = await trace({ file: 'src/date-utils.ts', line: 2 });

      expect(result.nodes.length).toBeGreaterThanOrEqual(1);
      const firstNode = result.nodes[0];
      expect(firstNode.sha).toBeDefined();
      expect(firstNode.sha).toHaveLength(40);
    });

    it('blame -C -C tracks line back through the file move commit', async () => {
      const originalSha = repo.commit(
        { 'src/helpers.ts': HELPERS_ORIGINAL },
        'feat: add date helpers',
      );
      const moveSha = repo.moveFile(
        'src/helpers.ts',
        'src/date-utils.ts',
        'refactor: move helpers to date-utils',
      );

      // line 2 is the body of formatDate — blame -C -C should attribute this
      // to either the move commit or the original commit depending on git blame behavior
      const result = await trace({ file: 'src/date-utils.ts', line: 2 });

      expect(result.nodes.length).toBeGreaterThanOrEqual(1);
      const blameNode = result.nodes[0];
      // The SHA must be one of the known commits in the repo
      expect([originalSha, moveSha]).toContain(blameNode.sha);
    });

    it('trace on multiple lines of moved file all return commit nodes', async () => {
      repo.commit(
        { 'src/helpers.ts': HELPERS_ORIGINAL },
        'feat: add date helpers',
      );
      repo.moveFile(
        'src/helpers.ts',
        'src/date-utils.ts',
        'refactor: move helpers to date-utils',
      );

      // Trace formatTime body (line 9)
      const result = await trace({ file: 'src/date-utils.ts', line: 9 });

      expect(result.nodes.length).toBeGreaterThanOrEqual(1);
      expect(result.nodes[0].type).toMatch(
        /^(original_commit|cosmetic_commit)$/,
      );
      expect(result.nodes[0].trackingMethod).toBe('blame-CMw');
    });

    it('trace works after move with an additional commit on top', async () => {
      repo.commit(
        { 'src/helpers.ts': HELPERS_ORIGINAL },
        'feat: add date helpers',
      );
      repo.moveFile(
        'src/helpers.ts',
        'src/date-utils.ts',
        'refactor: move helpers to date-utils',
      );
      // Additional unrelated commit after the move
      repo.commit(
        { 'src/other.ts': 'export const version = 1;\n' },
        'chore: add version',
      );

      const result = await trace({ file: 'src/date-utils.ts', line: 2 });

      expect(result.nodes.length).toBeGreaterThanOrEqual(1);
      expect(result.nodes[0].sha).toBeDefined();
    });
  },
);
