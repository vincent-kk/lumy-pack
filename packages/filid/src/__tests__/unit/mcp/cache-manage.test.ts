import { describe, expect, it, vi } from 'vitest';

import { getLastRunHash, saveRunHash } from '../../../core/cache-manager.js';
import { computeProjectHash } from '../../../core/project-hash.js';
import { handleCacheManage } from '../../../mcp/tools/cache-manage.js';
import type {
  ComputeHashResult,
  GetHashResult,
  SaveHashResult,
} from '../../../mcp/tools/cache-manage.js';

vi.mock('../../../core/cache-manager.js', () => ({
  saveRunHash: vi.fn(),
  getLastRunHash: vi.fn(() => null),
}));

vi.mock('../../../core/project-hash.js', () => ({
  computeProjectHash: vi.fn(async () => 'abcd1234efgh5678'),
}));

describe('handleCacheManage', () => {
  describe('compute-hash', () => {
    it('returns hash and cwd', async () => {
      const result = (await handleCacheManage({
        action: 'compute-hash',
        cwd: '/some/project',
      })) as ComputeHashResult;

      expect(result.hash).toBe('abcd1234efgh5678');
      expect(result.cwd).toBe('/some/project');
    });

    it('calls computeProjectHash with the cwd argument', async () => {
      await handleCacheManage({ action: 'compute-hash', cwd: '/my/repo' });

      expect(computeProjectHash).toHaveBeenCalledWith('/my/repo');
    });
  });

  describe('save-hash', () => {
    it('returns { saved: true, skillName, hash }', async () => {
      const result = (await handleCacheManage({
        action: 'save-hash',
        cwd: '/my/repo',
        skillName: 'fca-review',
        hash: 'deadbeef',
      })) as SaveHashResult;

      expect(result.saved).toBe(true);
      expect(result.skillName).toBe('fca-review');
      expect(result.hash).toBe('deadbeef');
    });

    it('calls saveRunHash with the correct arguments', async () => {
      await handleCacheManage({
        action: 'save-hash',
        cwd: '/my/repo',
        skillName: 'fca-scan',
        hash: 'cafebabe',
      });

      expect(saveRunHash).toHaveBeenCalledWith(
        '/my/repo',
        'fca-scan',
        'cafebabe',
      );
    });

    it('returned skillName matches the input', async () => {
      const result = (await handleCacheManage({
        action: 'save-hash',
        cwd: '/my/repo',
        skillName: 'my-skill',
        hash: 'abc123',
      })) as SaveHashResult;

      expect(result.skillName).toBe('my-skill');
    });
  });

  describe('get-hash', () => {
    it('returns { hash, found: true } when hash exists', async () => {
      vi.mocked(getLastRunHash).mockReturnValueOnce('cached-hash');

      const result = (await handleCacheManage({
        action: 'get-hash',
        cwd: '/my/repo',
        skillName: 'fca-review',
      })) as GetHashResult;

      expect(result.hash).toBe('cached-hash');
      expect(result.found).toBe(true);
    });

    it('returns { hash: null, found: false } when hash is absent', async () => {
      vi.mocked(getLastRunHash).mockReturnValueOnce(null);

      const result = (await handleCacheManage({
        action: 'get-hash',
        cwd: '/my/repo',
        skillName: 'fca-review',
      })) as GetHashResult;

      expect(result.hash).toBeNull();
      expect(result.found).toBe(false);
    });

    it('calls getLastRunHash with the correct arguments', async () => {
      await handleCacheManage({
        action: 'get-hash',
        cwd: '/project/path',
        skillName: 'fca-scan',
      });

      expect(getLastRunHash).toHaveBeenCalledWith('/project/path', 'fca-scan');
    });
  });

  describe('error cases', () => {
    it('throws when cwd is empty for compute-hash', async () => {
      await expect(
        handleCacheManage({ action: 'compute-hash', cwd: '' }),
      ).rejects.toThrow('cwd is required');
    });

    it('throws when skillName is missing for save-hash', async () => {
      await expect(
        handleCacheManage({
          action: 'save-hash',
          cwd: '/my/repo',
          hash: 'abc',
        }),
      ).rejects.toThrow('skillName is required');
    });

    it('throws when hash is missing for save-hash', async () => {
      await expect(
        handleCacheManage({
          action: 'save-hash',
          cwd: '/my/repo',
          skillName: 'fca-review',
        }),
      ).rejects.toThrow('hash is required');
    });

    it('throws when skillName is missing for get-hash', async () => {
      await expect(
        handleCacheManage({ action: 'get-hash', cwd: '/my/repo' }),
      ).rejects.toThrow('skillName is required');
    });

    it('throws when action is missing', async () => {
      await expect(
        handleCacheManage({ cwd: '/my/repo' } as never),
      ).rejects.toThrow('action is required');
    });

    it('throws when cwd is missing', async () => {
      await expect(
        handleCacheManage({ action: 'compute-hash' } as never),
      ).rejects.toThrow('cwd is required');
    });

    it('throws for unknown action', async () => {
      await expect(
        handleCacheManage({
          action: 'unknown-action',
          cwd: '/my/repo',
        } as never),
      ).rejects.toThrow('Unknown action');
    });
  });
});
