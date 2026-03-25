import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isAstAvailable } from '@/ast/index.js';
import { trace } from '@/core/core.js';
import { detectPlatformAdapter } from '@/platform/index.js';

import { createMockPlatformAdapter } from '../helpers/mock-platform.js';
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
const mockIsAstAvailable = isAstAvailable as ReturnType<typeof vi.fn>;

// Similar functions in different files — triggers -C -C false positive
const FILE_A_CONTENT = `export function processData(items: Array<{ value: number }>) {
  return items.filter(item => item.value > 0).map(item => item.value * 2);
}

export function summarize(items: Array<{ value: number }>) {
  return items.reduce((sum, item) => sum + item.value, 0);
}
`;

const FILE_B_CONTENT = `export function handleData(records: Array<{ value: number }>) {
  return records.filter(record => record.value > 0).map(record => record.value * 2);
}

export function aggregate(records: Array<{ value: number }>) {
  return records.reduce((total, record) => total + record.value, 0);
}
`;

// Content for rename scenario
const UTILS_CONTENT = `export function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

export function formatTime(date: Date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return hours + ':' + minutes;
}
`;

describe(
  'Origin mode cross-validation',
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

    it('cross-file copy FP: similar code in different files yields same result as change mode', async () => {
      // A: create file with processData
      repo.commit(
        { 'src/processor.ts': FILE_A_CONTENT },
        'feat: add data processor',
      );

      // B: create similar file with handleData (may trigger -C -C copy detection)
      const commitB = repo.commit(
        { 'src/handler.ts': FILE_B_CONTENT },
        'feat: add data handler',
      );

      // Trace line 2 of handler.ts (the filter+map line, similar to processor.ts)
      const originResult = await trace({
        file: 'src/handler.ts',
        line: 2,
        mode: 'origin',
      });
      const changeResult = await trace({
        file: 'src/handler.ts',
        line: 2,
        mode: 'change',
      });

      // Origin mode should produce the same commit as change mode
      // (not falsely attribute to processor.ts's commit)
      expect(originResult.nodes.length).toBeGreaterThanOrEqual(1);
      expect(changeResult.nodes.length).toBeGreaterThanOrEqual(1);
      expect(originResult.nodes[0].sha).toBe(changeResult.nodes[0].sha);
      expect(originResult.nodes[0].sha).toBe(commitB);
    });

    it('real git mv rename: origin tracks back to original commit', async () => {
      // A: create file
      const originalSha = repo.commit(
        { 'src/helpers.ts': UTILS_CONTENT },
        'feat: add date helpers',
      );

      // B: rename via git mv
      repo.moveFile(
        'src/helpers.ts',
        'src/date-utils.ts',
        'refactor: move helpers to date-utils',
      );

      // Trace line 2 (function body, unchanged content)
      const result = await trace({
        file: 'src/date-utils.ts',
        line: 2,
        mode: 'origin',
      });

      expect(result.nodes.length).toBeGreaterThanOrEqual(1);
      const blameNode = result.nodes[0];
      // Should track back to the original commit (rename verified)
      expect(blameNode.sha).toBe(originalSha);
      expect(blameNode.trackingMethod).toBe('blame-CMw');
    });

    it('commitHash match: origin and change agree on simple edit', async () => {
      // A: create file
      repo.commit(
        { 'src/app.ts': 'export const x = 1;\n' },
        'chore: initial',
      );

      // B: modify it
      const editSha = repo.commit(
        { 'src/app.ts': 'export const x = 2;\n' },
        'fix: update x value',
      );

      // Both modes should find the same commit (no copy/move involved)
      const originResult = await trace({
        file: 'src/app.ts',
        line: 1,
        mode: 'origin',
      });
      const changeResult = await trace({
        file: 'src/app.ts',
        line: 1,
        mode: 'change',
      });

      expect(originResult.nodes[0].sha).toBe(editSha);
      expect(changeResult.nodes[0].sha).toBe(editSha);
      expect(originResult.nodes[0].sha).toBe(changeResult.nodes[0].sha);
    });

    it('partial modification after rename: modified line uses change result', async () => {
      // A: create file
      repo.commit(
        { 'src/helpers.ts': UTILS_CONTENT },
        'feat: add date helpers',
      );

      // B: rename via git mv
      repo.moveFile(
        'src/helpers.ts',
        'src/date-utils.ts',
        'refactor: move helpers to date-utils',
      );

      // C: modify line 2 in the renamed file
      const modifiedContent = UTILS_CONTENT.replace(
        'const year = date.getFullYear();',
        'const year = date.getFullYear().toString();',
      );
      const modifySha = repo.commit(
        { 'src/date-utils.ts': modifiedContent },
        'fix: ensure year is string',
      );

      // Trace line 2 (the modified line)
      const result = await trace({
        file: 'src/date-utils.ts',
        line: 2,
        mode: 'origin',
      });

      expect(result.nodes.length).toBeGreaterThanOrEqual(1);
      // The modified line should point to the modification commit, not the original
      expect(result.nodes[0].sha).toBe(modifySha);
    });
  },
);
