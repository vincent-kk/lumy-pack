import { beforeEach, describe, expect, it } from 'vitest';

import { ChangeQueue } from '../../../core/change-queue.js';

describe('change-queue', () => {
  let queue: ChangeQueue;

  beforeEach(() => {
    queue = new ChangeQueue();
  });

  describe('enqueue', () => {
    it('should add a change record', () => {
      queue.enqueue({ filePath: '/app/auth/login.ts', changeType: 'modified' });
      expect(queue.size()).toBe(1);
    });

    it('should accumulate multiple changes', () => {
      queue.enqueue({ filePath: '/app/auth/login.ts', changeType: 'modified' });
      queue.enqueue({ filePath: '/app/auth/signup.ts', changeType: 'created' });
      queue.enqueue({
        filePath: '/app/utils/helper.ts',
        changeType: 'deleted',
      });
      expect(queue.size()).toBe(3);
    });
  });

  describe('drain', () => {
    it('should return all queued changes and clear the queue', () => {
      queue.enqueue({ filePath: '/app/a.ts', changeType: 'modified' });
      queue.enqueue({ filePath: '/app/b.ts', changeType: 'created' });

      const changes = queue.drain();
      expect(changes).toHaveLength(2);
      expect(queue.size()).toBe(0);
    });

    it('should return empty array when queue is empty', () => {
      expect(queue.drain()).toEqual([]);
    });
  });

  describe('peek', () => {
    it('should return all changes without clearing', () => {
      queue.enqueue({ filePath: '/app/a.ts', changeType: 'modified' });
      const peeked = queue.peek();
      expect(peeked).toHaveLength(1);
      expect(queue.size()).toBe(1);
    });
  });

  describe('getChangesByPath', () => {
    it('should group changes by file path', () => {
      queue.enqueue({ filePath: '/app/a.ts', changeType: 'modified' });
      queue.enqueue({ filePath: '/app/a.ts', changeType: 'modified' });
      queue.enqueue({ filePath: '/app/b.ts', changeType: 'created' });

      const grouped = queue.getChangesByPath();
      expect(grouped.get('/app/a.ts')).toHaveLength(2);
      expect(grouped.get('/app/b.ts')).toHaveLength(1);
    });
  });

  describe('getAffectedFractals', () => {
    it('should return unique parent directories of changed files', () => {
      queue.enqueue({ filePath: '/app/auth/login.ts', changeType: 'modified' });
      queue.enqueue({ filePath: '/app/auth/signup.ts', changeType: 'created' });
      queue.enqueue({
        filePath: '/app/dashboard/index.ts',
        changeType: 'modified',
      });

      const fractals = queue.getAffectedFractals();
      expect(fractals).toContain('/app/auth');
      expect(fractals).toContain('/app/dashboard');
      expect(fractals).toHaveLength(2);
    });

    it('should return empty array when queue is empty', () => {
      expect(queue.getAffectedFractals()).toEqual([]);
    });
  });

  describe('clear', () => {
    it('should remove all queued changes', () => {
      queue.enqueue({ filePath: '/app/a.ts', changeType: 'modified' });
      queue.enqueue({ filePath: '/app/b.ts', changeType: 'created' });
      queue.clear();
      expect(queue.size()).toBe(0);
    });
  });

  describe('isEmpty', () => {
    it('should return true when empty', () => {
      expect(queue.isEmpty()).toBe(true);
    });

    it('should return false when not empty', () => {
      queue.enqueue({ filePath: '/app/a.ts', changeType: 'modified' });
      expect(queue.isEmpty()).toBe(false);
    });
  });
});
