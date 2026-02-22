import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { handleReviewManage } from '../../../mcp/tools/review-manage.js';

// ─── helpers ────────────────────────────────────────────────────────────────

async function makeTmp(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'review-manage-test-'));
}

// ─── normalize-branch ────────────────────────────────────────────────────────

describe('handleReviewManage – normalize-branch', () => {
  it('replaces / with --', async () => {
    const result = await handleReviewManage({
      action: 'normalize-branch',
      projectRoot: '/tmp',
      branchName: 'feature/my-feature',
    });
    expect(result).toEqual({ normalized: 'feature--my-feature' });
  });

  it('replaces multiple / separators', async () => {
    const result = await handleReviewManage({
      action: 'normalize-branch',
      projectRoot: '/tmp',
      branchName: 'org/team/feature',
    });
    expect(result).toEqual({ normalized: 'org--team--feature' });
  });

  it('replaces special characters with _', async () => {
    const result = await handleReviewManage({
      action: 'normalize-branch',
      projectRoot: '/tmp',
      branchName: 'fix#42@user~branch',
    });
    expect(result.normalized as string).toMatch(/fix_42_user_branch/);
  });

  it('removes leading dots', async () => {
    const result = await handleReviewManage({
      action: 'normalize-branch',
      projectRoot: '/tmp',
      branchName: '...my-branch',
    });
    expect(result.normalized).toBe('my-branch');
  });

  it('removes trailing dots', async () => {
    const result = await handleReviewManage({
      action: 'normalize-branch',
      projectRoot: '/tmp',
      branchName: 'my-branch...',
    });
    expect(result.normalized).toBe('my-branch');
  });

  it('removes leading hyphens', async () => {
    const result = await handleReviewManage({
      action: 'normalize-branch',
      projectRoot: '/tmp',
      branchName: '--my-branch',
    });
    expect(result.normalized).toBe('my-branch');
  });

  it('removes trailing hyphens', async () => {
    const result = await handleReviewManage({
      action: 'normalize-branch',
      projectRoot: '/tmp',
      branchName: 'my-branch--',
    });
    expect(result.normalized).toBe('my-branch');
  });

  it('preserves consecutive -- in the middle (intentional uniqueness)', async () => {
    const result = await handleReviewManage({
      action: 'normalize-branch',
      projectRoot: '/tmp',
      branchName: 'feature/a/b',
    });
    // feature/a/b → feature--a--b (two consecutive -- preserved as-is)
    expect(result.normalized).toBe('feature--a--b');
  });

  it('handles plain branch names without special chars', async () => {
    const result = await handleReviewManage({
      action: 'normalize-branch',
      projectRoot: '/tmp',
      branchName: 'main',
    });
    expect(result.normalized).toBe('main');
  });

  it('throws when branchName is missing', async () => {
    await expect(
      handleReviewManage({ action: 'normalize-branch', projectRoot: '/tmp' }),
    ).rejects.toThrow('branchName');
  });
});

// ─── ensure-dir ──────────────────────────────────────────────────────────────

describe('handleReviewManage – ensure-dir', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await makeTmp();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('creates the review directory and returns created=true', async () => {
    const result = await handleReviewManage({
      action: 'ensure-dir',
      projectRoot: tmpDir,
      branchName: 'feature/my-feature',
    });

    expect(result.created).toBe(true);
    const expectedPath = path.join(
      tmpDir,
      '.filid',
      'review',
      'feature--my-feature',
    );
    expect(result.path).toBe(expectedPath);

    const stat = await fs.stat(expectedPath);
    expect(stat.isDirectory()).toBe(true);
  });

  it('is idempotent – returns created=false when directory already exists', async () => {
    const input = {
      action: 'ensure-dir' as const,
      projectRoot: tmpDir,
      branchName: 'feature/my-feature',
    };

    await handleReviewManage(input);
    const result = await handleReviewManage(input);

    expect(result.created).toBe(false);
  });

  it('throws when branchName is missing', async () => {
    await expect(
      handleReviewManage({ action: 'ensure-dir', projectRoot: tmpDir }),
    ).rejects.toThrow('branchName');
  });
});

// ─── checkpoint ──────────────────────────────────────────────────────────────

describe('handleReviewManage – checkpoint', () => {
  let tmpDir: string;
  let reviewDir: string;
  const branch = 'feature/test';
  const normalizedBranch = 'feature--test';

  beforeEach(async () => {
    tmpDir = await makeTmp();
    reviewDir = path.join(tmpDir, '.filid', 'review', normalizedBranch);
    await fs.mkdir(reviewDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('returns phase A when no files exist', async () => {
    const result = await handleReviewManage({
      action: 'checkpoint',
      projectRoot: tmpDir,
      branchName: branch,
    });
    expect(result.phase).toBe('A');
    expect(result.files).toEqual([]);
  });

  it('returns phase B when only session.md exists', async () => {
    await fs.writeFile(path.join(reviewDir, 'session.md'), '');
    const result = await handleReviewManage({
      action: 'checkpoint',
      projectRoot: tmpDir,
      branchName: branch,
    });
    expect(result.phase).toBe('B');
    expect(result.files).toContain('session.md');
    expect(result.files).not.toContain('verification.md');
  });

  it('returns phase C when session.md and verification.md exist', async () => {
    await fs.writeFile(path.join(reviewDir, 'session.md'), '');
    await fs.writeFile(path.join(reviewDir, 'verification.md'), '');
    const result = await handleReviewManage({
      action: 'checkpoint',
      projectRoot: tmpDir,
      branchName: branch,
    });
    expect(result.phase).toBe('C');
    expect(result.files).toContain('session.md');
    expect(result.files).toContain('verification.md');
    expect(result.files).not.toContain('review-report.md');
  });

  it('returns phase DONE when all three files exist', async () => {
    await fs.writeFile(path.join(reviewDir, 'session.md'), '');
    await fs.writeFile(path.join(reviewDir, 'verification.md'), '');
    await fs.writeFile(path.join(reviewDir, 'review-report.md'), '');
    const result = await handleReviewManage({
      action: 'checkpoint',
      projectRoot: tmpDir,
      branchName: branch,
    });
    expect(result.phase).toBe('DONE');
    expect((result.files as string[]).sort()).toEqual(
      ['session.md', 'verification.md', 'review-report.md'].sort(),
    );
  });

  it('throws when branchName is missing', async () => {
    await expect(
      handleReviewManage({ action: 'checkpoint', projectRoot: tmpDir }),
    ).rejects.toThrow('branchName');
  });
});

// ─── elect-committee ─────────────────────────────────────────────────────────

describe('handleReviewManage – elect-committee', () => {
  it('selects LOW complexity committee for small changes', async () => {
    const result = await handleReviewManage({
      action: 'elect-committee',
      projectRoot: '/tmp',
      changedFilesCount: 2,
      changedFractalsCount: 1,
      hasInterfaceChanges: false,
    });
    expect(result.complexity).toBe('LOW');
    expect(result.committee).toEqual([
      'engineering-architect',
      'operations-sre',
    ]);
  });

  it('selects MEDIUM complexity when interface changes exist', async () => {
    const result = await handleReviewManage({
      action: 'elect-committee',
      projectRoot: '/tmp',
      changedFilesCount: 2,
      changedFractalsCount: 1,
      hasInterfaceChanges: true,
    });
    expect(result.complexity).toBe('MEDIUM');
    expect(result.committee).toContain('engineering-architect');
    expect(result.committee).toContain('knowledge-manager');
    expect(result.committee).toContain('business-driver');
    expect(result.committee).toContain('operations-sre');
  });

  it('selects MEDIUM complexity when file count is moderate', async () => {
    const result = await handleReviewManage({
      action: 'elect-committee',
      projectRoot: '/tmp',
      changedFilesCount: 5,
      changedFractalsCount: 2,
      hasInterfaceChanges: false,
    });
    expect(result.complexity).toBe('MEDIUM');
  });

  it('selects HIGH complexity when changedFilesCount > 10', async () => {
    const result = await handleReviewManage({
      action: 'elect-committee',
      projectRoot: '/tmp',
      changedFilesCount: 11,
      changedFractalsCount: 2,
      hasInterfaceChanges: false,
    });
    expect(result.complexity).toBe('HIGH');
    expect((result.committee as string[]).length).toBe(6);
  });

  it('selects HIGH complexity when changedFractalsCount >= 4', async () => {
    const result = await handleReviewManage({
      action: 'elect-committee',
      projectRoot: '/tmp',
      changedFilesCount: 3,
      changedFractalsCount: 4,
      hasInterfaceChanges: false,
    });
    expect(result.complexity).toBe('HIGH');
  });

  it('LOW committee has no adversarial pairs for business-driver (not selected)', async () => {
    const result = await handleReviewManage({
      action: 'elect-committee',
      projectRoot: '/tmp',
      changedFilesCount: 1,
      changedFractalsCount: 0,
      hasInterfaceChanges: false,
    });
    expect(result.complexity).toBe('LOW');
    // business-driver not in LOW committee, so no adversarial pair for it
    const pairs = result.adversarialPairs as [string, string[]][];
    const businessDriverPair = pairs.find(([p]) => p === 'business-driver');
    expect(businessDriverPair).toBeUndefined();
  });

  it('MEDIUM committee includes adversarial pair for business-driver', async () => {
    const result = await handleReviewManage({
      action: 'elect-committee',
      projectRoot: '/tmp',
      changedFilesCount: 5,
      changedFractalsCount: 2,
      hasInterfaceChanges: false,
    });
    expect(result.complexity).toBe('MEDIUM');
    const pairs = result.adversarialPairs as [string, string[]][];
    const businessDriverPair = pairs.find(([p]) => p === 'business-driver');
    expect(businessDriverPair).toBeDefined();
    expect(businessDriverPair![1]).toContain('knowledge-manager');
    expect(businessDriverPair![1]).toContain('operations-sre');
  });

  it('HIGH committee includes adversarial pairs for product-manager and design-hci', async () => {
    const result = await handleReviewManage({
      action: 'elect-committee',
      projectRoot: '/tmp',
      changedFilesCount: 15,
      changedFractalsCount: 5,
      hasInterfaceChanges: true,
    });
    expect(result.complexity).toBe('HIGH');
    const pairs = result.adversarialPairs as [string, string[]][];

    const pmPair = pairs.find(([p]) => p === 'product-manager');
    expect(pmPair).toBeDefined();
    expect(pmPair![1]).toContain('engineering-architect');

    const hciPair = pairs.find(([p]) => p === 'design-hci');
    expect(hciPair).toBeDefined();
    expect(hciPair![1]).toContain('engineering-architect');
  });

  it('throws when changedFilesCount is missing', async () => {
    await expect(
      handleReviewManage({
        action: 'elect-committee',
        projectRoot: '/tmp',
        changedFractalsCount: 1,
        hasInterfaceChanges: false,
      }),
    ).rejects.toThrow('changedFilesCount');
  });

  it('throws when changedFractalsCount is missing', async () => {
    await expect(
      handleReviewManage({
        action: 'elect-committee',
        projectRoot: '/tmp',
        changedFilesCount: 1,
        hasInterfaceChanges: false,
      }),
    ).rejects.toThrow('changedFractalsCount');
  });

  it('throws when hasInterfaceChanges is missing', async () => {
    await expect(
      handleReviewManage({
        action: 'elect-committee',
        projectRoot: '/tmp',
        changedFilesCount: 1,
        changedFractalsCount: 1,
      }),
    ).rejects.toThrow('hasInterfaceChanges');
  });
});

// ─── cleanup ─────────────────────────────────────────────────────────────────

describe('handleReviewManage – cleanup', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await makeTmp();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('deletes an existing review directory', async () => {
    const reviewDir = path.join(tmpDir, '.filid', 'review', 'feature--cleanup');
    await fs.mkdir(reviewDir, { recursive: true });
    await fs.writeFile(path.join(reviewDir, 'session.md'), 'content');

    const result = await handleReviewManage({
      action: 'cleanup',
      projectRoot: tmpDir,
      branchName: 'feature/cleanup',
    });

    expect(result.deleted).toBe(true);
    await expect(fs.access(reviewDir)).rejects.toThrow();
  });

  it('does not throw when directory does not exist (force=true)', async () => {
    const result = await handleReviewManage({
      action: 'cleanup',
      projectRoot: tmpDir,
      branchName: 'feature/nonexistent',
    });
    expect(result.deleted).toBe(true);
  });

  it('throws when branchName is missing', async () => {
    await expect(
      handleReviewManage({ action: 'cleanup', projectRoot: tmpDir }),
    ).rejects.toThrow('branchName');
  });
});
