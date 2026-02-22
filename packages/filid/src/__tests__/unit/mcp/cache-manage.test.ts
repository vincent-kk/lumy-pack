import { describe, expect, it, vi } from 'vitest';

import {
  computeProjectHash,
  getLastRunHash,
  saveRunHash,
} from '../../../core/cache-manager.js';
import { handleCacheManage } from '../../../mcp/tools/cache-manage.js';
import type {
  ComputeHashResult,
  GetHashResult,
  SaveHashResult,
} from '../../../mcp/tools/cache-manage.js';

vi.mock('../../../core/cache-manager.js', () => ({
  computeProjectHash: vi.fn(async () => 'abcd1234efgh5678'),
  saveRunHash: vi.fn(),
  getLastRunHash: vi.fn(() => null),
}));

describe('handleCacheManage', () => {
  describe('compute-hash', () => {
    it('hash와 cwd를 반환한다', async () => {
      const result = (await handleCacheManage({
        action: 'compute-hash',
        cwd: '/some/project',
      })) as ComputeHashResult;

      expect(result.hash).toBe('abcd1234efgh5678');
      expect(result.cwd).toBe('/some/project');
    });

    it('computeProjectHash가 cwd 인자로 호출된다', async () => {
      await handleCacheManage({ action: 'compute-hash', cwd: '/my/repo' });

      expect(computeProjectHash).toHaveBeenCalledWith('/my/repo');
    });
  });

  describe('save-hash', () => {
    it('{ saved: true, skillName, hash }를 반환한다', async () => {
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

    it('saveRunHash가 올바른 인자로 호출된다', async () => {
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

    it('반환된 skillName이 입력과 일치한다', async () => {
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
    it('hash가 있을 때 { hash, found: true }를 반환한다', async () => {
      vi.mocked(getLastRunHash).mockReturnValueOnce('cached-hash');

      const result = (await handleCacheManage({
        action: 'get-hash',
        cwd: '/my/repo',
        skillName: 'fca-review',
      })) as GetHashResult;

      expect(result.hash).toBe('cached-hash');
      expect(result.found).toBe(true);
    });

    it('hash가 없을 때 { hash: null, found: false }를 반환한다', async () => {
      vi.mocked(getLastRunHash).mockReturnValueOnce(null);

      const result = (await handleCacheManage({
        action: 'get-hash',
        cwd: '/my/repo',
        skillName: 'fca-review',
      })) as GetHashResult;

      expect(result.hash).toBeNull();
      expect(result.found).toBe(false);
    });

    it('getLastRunHash가 올바른 인자로 호출된다', async () => {
      await handleCacheManage({
        action: 'get-hash',
        cwd: '/project/path',
        skillName: 'fca-scan',
      });

      expect(getLastRunHash).toHaveBeenCalledWith('/project/path', 'fca-scan');
    });
  });

  describe('에러 케이스', () => {
    it('compute-hash에서 cwd 없으면 Error를 던진다', async () => {
      await expect(
        handleCacheManage({ action: 'compute-hash', cwd: '' }),
      ).rejects.toThrow('cwd is required');
    });

    it('save-hash에서 skillName 없으면 Error를 던진다', async () => {
      await expect(
        handleCacheManage({
          action: 'save-hash',
          cwd: '/my/repo',
          hash: 'abc',
        }),
      ).rejects.toThrow('skillName is required');
    });

    it('save-hash에서 hash 없으면 Error를 던진다', async () => {
      await expect(
        handleCacheManage({
          action: 'save-hash',
          cwd: '/my/repo',
          skillName: 'fca-review',
        }),
      ).rejects.toThrow('hash is required');
    });

    it('get-hash에서 skillName 없으면 Error를 던진다', async () => {
      await expect(
        handleCacheManage({ action: 'get-hash', cwd: '/my/repo' }),
      ).rejects.toThrow('skillName is required');
    });

    it('action 없으면 Error를 던진다', async () => {
      await expect(
        handleCacheManage({ cwd: '/my/repo' } as never),
      ).rejects.toThrow('action is required');
    });

    it('cwd 없으면 Error를 던진다', async () => {
      await expect(
        handleCacheManage({ action: 'compute-hash' } as never),
      ).rejects.toThrow('cwd is required');
    });

    it('unknown action은 Error를 던진다', async () => {
      await expect(
        handleCacheManage({
          action: 'unknown-action',
          cwd: '/my/repo',
        } as never),
      ).rejects.toThrow('Unknown action');
    });
  });
});
