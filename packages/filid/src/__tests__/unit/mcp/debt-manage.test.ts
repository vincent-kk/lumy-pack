import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { handleDebtManage } from '../../../mcp/tools/debt-manage.js';
import type { DebtItemCreate, DebtItem } from '../../../types/debt.js';

function makeDebtItemCreate(overrides: Partial<DebtItemCreate> = {}): DebtItemCreate {
  return {
    fractal_path: 'core/auth',
    file_path: 'src/core/auth.ts',
    created_at: '2024-01-01T00:00:00Z',
    review_branch: 'fix/auth-debt',
    original_fix_id: 'FIX-001',
    severity: 'MEDIUM',
    rule_violated: 'max-complexity',
    metric_value: '15',
    title: '인증 모듈 복잡도 초과',
    original_request: '복잡도를 10 이하로 줄여달라는 요청',
    developer_justification: '레거시 코드 의존성으로 인해 즉시 수정 어려움',
    refined_adr: 'ADR-042: 복잡도 개선 예정 - 다음 분기',
    ...overrides,
  };
}

describe('handleDebtManage', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'filid-debt-test-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  // -------------------------
  // create action
  // -------------------------
  describe('create', () => {
    it('파일을 생성하고 id와 filePath를 반환한다', async () => {
      const result = await handleDebtManage({
        action: 'create',
        projectRoot: tmpDir,
        debtItem: makeDebtItemCreate(),
      });

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('filePath');
      const { id, filePath } = result as { id: string; filePath: string };
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
      expect(filePath).toContain(id);
      expect(filePath).toContain('.filid/debt');
    });

    it('생성된 파일에 YAML 프론트매터가 포함된다', async () => {
      const debtItem = makeDebtItemCreate({ fractal_path: 'core/auth' });
      const { filePath } = (await handleDebtManage({
        action: 'create',
        projectRoot: tmpDir,
        debtItem,
      })) as { filePath: string; id: string };

      const content = await readFile(filePath, 'utf-8');
      expect(content).toMatch(/^---\n/);
      expect(content).toContain('fractal_path: core/auth');
      expect(content).toContain('severity: MEDIUM');
      expect(content).toContain('weight: 1');
      expect(content).toContain('touch_count: 0');
      expect(content).toContain('last_review_commit: null');
    });

    it('생성된 파일에 마크다운 본문 섹션이 포함된다', async () => {
      const debtItem = makeDebtItemCreate();
      const { filePath } = (await handleDebtManage({
        action: 'create',
        projectRoot: tmpDir,
        debtItem,
      })) as { filePath: string; id: string };

      const content = await readFile(filePath, 'utf-8');
      expect(content).toContain('# 기술 부채: 인증 모듈 복잡도 초과');
      expect(content).toContain('## 원래 수정 요청');
      expect(content).toContain('복잡도를 10 이하로 줄여달라는 요청');
      expect(content).toContain('## 개발자 소명');
      expect(content).toContain('레거시 코드 의존성으로 인해 즉시 수정 어려움');
      expect(content).toContain('## 정제된 ADR');
      expect(content).toContain('ADR-042: 복잡도 개선 예정 - 다음 분기');
    });

    it('id는 fractal_path의 /를 -로 변환한 접두어를 가진다', async () => {
      const debtItem = makeDebtItemCreate({ fractal_path: 'core/auth/session' });
      const { id } = (await handleDebtManage({
        action: 'create',
        projectRoot: tmpDir,
        debtItem,
      })) as { id: string; filePath: string };

      expect(id).toMatch(/^core-auth-session-/);
    });

    it('id의 해시 부분은 6자리이다', async () => {
      const debtItem = makeDebtItemCreate();
      const { id } = (await handleDebtManage({
        action: 'create',
        projectRoot: tmpDir,
        debtItem,
      })) as { id: string; filePath: string };

      const hashPart = id.split('-').pop();
      expect(hashPart).toHaveLength(6);
    });

    it('.filid/debt/ 디렉토리가 없어도 자동 생성된다', async () => {
      const result = await handleDebtManage({
        action: 'create',
        projectRoot: tmpDir,
        debtItem: makeDebtItemCreate(),
      });
      expect(result).toHaveProperty('id');
    });

    it('debtItem이 없으면 에러를 던진다', async () => {
      await expect(
        handleDebtManage({ action: 'create', projectRoot: tmpDir }),
      ).rejects.toThrow('debtItem');
    });
  });

  // -------------------------
  // list action
  // -------------------------
  describe('list', () => {
    it('부채 파일이 없으면 빈 배열과 totalWeight 0을 반환한다', async () => {
      const result = (await handleDebtManage({
        action: 'list',
        projectRoot: tmpDir,
      })) as { debts: DebtItem[]; totalWeight: number };

      expect(result.debts).toEqual([]);
      expect(result.totalWeight).toBe(0);
    });

    it('.filid/debt 디렉토리가 없으면 빈 배열을 반환한다', async () => {
      const result = (await handleDebtManage({
        action: 'list',
        projectRoot: join(tmpDir, 'nonexistent'),
      })) as { debts: DebtItem[]; totalWeight: number };

      expect(result.debts).toEqual([]);
      expect(result.totalWeight).toBe(0);
    });

    it('생성된 부채들을 모두 반환한다', async () => {
      await handleDebtManage({
        action: 'create',
        projectRoot: tmpDir,
        debtItem: makeDebtItemCreate({ fractal_path: 'core/auth', title: '부채1' }),
      });
      await handleDebtManage({
        action: 'create',
        projectRoot: tmpDir,
        debtItem: makeDebtItemCreate({ fractal_path: 'core/api', title: '부채2' }),
      });

      const result = (await handleDebtManage({
        action: 'list',
        projectRoot: tmpDir,
      })) as { debts: DebtItem[]; totalWeight: number };

      expect(result.debts).toHaveLength(2);
      expect(result.totalWeight).toBe(2); // 각 weight=1
    });

    it('fractalPath로 필터링한다', async () => {
      await handleDebtManage({
        action: 'create',
        projectRoot: tmpDir,
        debtItem: makeDebtItemCreate({ fractal_path: 'core/auth', title: '인증 부채' }),
      });
      await handleDebtManage({
        action: 'create',
        projectRoot: tmpDir,
        debtItem: makeDebtItemCreate({ fractal_path: 'core/api', title: 'API 부채' }),
      });

      const result = (await handleDebtManage({
        action: 'list',
        projectRoot: tmpDir,
        fractalPath: 'core/auth',
      })) as { debts: DebtItem[]; totalWeight: number };

      expect(result.debts).toHaveLength(1);
      expect(result.debts[0].fractal_path).toBe('core/auth');
    });

    it('totalWeight는 필터된 debts의 weight 합계이다', async () => {
      await handleDebtManage({
        action: 'create',
        projectRoot: tmpDir,
        debtItem: makeDebtItemCreate({ fractal_path: 'core/auth', title: '부채A' }),
      });
      await handleDebtManage({
        action: 'create',
        projectRoot: tmpDir,
        debtItem: makeDebtItemCreate({ fractal_path: 'core/auth', title: '부채B' }),
      });
      await handleDebtManage({
        action: 'create',
        projectRoot: tmpDir,
        debtItem: makeDebtItemCreate({ fractal_path: 'other/path', title: '부채C' }),
      });

      const result = (await handleDebtManage({
        action: 'list',
        projectRoot: tmpDir,
        fractalPath: 'core/auth',
      })) as { debts: DebtItem[]; totalWeight: number };

      expect(result.debts).toHaveLength(2);
      expect(result.totalWeight).toBe(2);
    });
  });

  // -------------------------
  // resolve action
  // -------------------------
  describe('resolve', () => {
    it('존재하는 부채를 삭제하고 deleted: true를 반환한다', async () => {
      const { id } = (await handleDebtManage({
        action: 'create',
        projectRoot: tmpDir,
        debtItem: makeDebtItemCreate(),
      })) as { id: string; filePath: string };

      const result = (await handleDebtManage({
        action: 'resolve',
        projectRoot: tmpDir,
        debtId: id,
      })) as { deleted: boolean };

      expect(result.deleted).toBe(true);
    });

    it('삭제 후 list에서 조회되지 않는다', async () => {
      const { id } = (await handleDebtManage({
        action: 'create',
        projectRoot: tmpDir,
        debtItem: makeDebtItemCreate(),
      })) as { id: string; filePath: string };

      await handleDebtManage({ action: 'resolve', projectRoot: tmpDir, debtId: id });

      const result = (await handleDebtManage({
        action: 'list',
        projectRoot: tmpDir,
      })) as { debts: DebtItem[]; totalWeight: number };

      expect(result.debts).toHaveLength(0);
    });

    it('존재하지 않는 부채는 deleted: false를 반환한다', async () => {
      const result = (await handleDebtManage({
        action: 'resolve',
        projectRoot: tmpDir,
        debtId: 'nonexistent-id',
      })) as { deleted: boolean };

      expect(result.deleted).toBe(false);
    });

    it('debtId가 없으면 에러를 던진다', async () => {
      await expect(
        handleDebtManage({ action: 'resolve', projectRoot: tmpDir }),
      ).rejects.toThrow('debtId');
    });
  });

  // -------------------------
  // calculate-bias action
  // -------------------------
  describe('calculate-bias', () => {
    function makeDebt(overrides: Partial<DebtItem> = {}): DebtItem {
      return {
        id: 'core-auth-abc123',
        fractal_path: 'core/auth',
        file_path: 'src/core/auth.ts',
        created_at: '2024-01-01T00:00:00Z',
        review_branch: 'fix/auth',
        original_fix_id: 'FIX-001',
        severity: 'MEDIUM',
        weight: 1,
        touch_count: 0,
        last_review_commit: null,
        rule_violated: 'max-complexity',
        metric_value: '15',
        title: '테스트 부채',
        original_request: '요청',
        developer_justification: '소명',
        refined_adr: 'ADR',
        ...overrides,
      };
    }

    it('weight 공식: 1*2^touch_count (touch_count=0→weight=1)', async () => {
      const debt = makeDebt({ touch_count: 0, weight: 1 });
      const result = (await handleDebtManage({
        action: 'calculate-bias',
        projectRoot: tmpDir,
        debts: [debt],
        changedFractalPaths: ['core/auth'],
        currentCommitSha: 'sha-001',
      })) as { updatedDebts: DebtItem[]; totalScore: number; biasLevel: string };

      // touch_count=0→1 이므로 weight = 1*2^1 = 2
      expect(result.updatedDebts[0].touch_count).toBe(1);
      expect(result.updatedDebts[0].weight).toBe(2);
    });

    it('weight 공식: 순차적 증가 검증 (2^1=2, 2^2=4, 2^3=8, 2^4=16)', async () => {
      const sha = 'sha-';
      let debt = makeDebt({ touch_count: 0, weight: 1 });

      for (let i = 1; i <= 4; i++) {
        const r = (await handleDebtManage({
          action: 'calculate-bias',
          projectRoot: tmpDir,
          debts: [debt],
          changedFractalPaths: ['core/auth'],
          currentCommitSha: `${sha}${i}`,
        })) as { updatedDebts: DebtItem[] };
        debt = r.updatedDebts[0];
        const expectedWeight = Math.min(Math.pow(2, i), 16);
        expect(debt.weight).toBe(expectedWeight);
      }
    });

    it('weight 상한선: touch_count >= 4이면 weight는 16을 초과하지 않는다', async () => {
      const debt = makeDebt({ touch_count: 10, weight: 16, last_review_commit: null });
      const result = (await handleDebtManage({
        action: 'calculate-bias',
        projectRoot: tmpDir,
        debts: [debt],
        changedFractalPaths: ['core/auth'],
        currentCommitSha: 'sha-cap',
      })) as { updatedDebts: DebtItem[] };

      expect(result.updatedDebts[0].weight).toBe(16);
    });

    it('멱등성: 동일한 commitSha로 재호출 시 변경 없음', async () => {
      const debt = makeDebt({ touch_count: 1, weight: 2, last_review_commit: 'sha-001' });
      const result = (await handleDebtManage({
        action: 'calculate-bias',
        projectRoot: tmpDir,
        debts: [debt],
        changedFractalPaths: ['core/auth'],
        currentCommitSha: 'sha-001',
      })) as { updatedDebts: DebtItem[] };

      expect(result.updatedDebts[0].touch_count).toBe(1);
      expect(result.updatedDebts[0].weight).toBe(2);
    });

    it('매칭되지 않는 fractalPath는 업데이트되지 않는다', async () => {
      const debt = makeDebt({ fractal_path: 'core/api', touch_count: 0, weight: 1 });
      const result = (await handleDebtManage({
        action: 'calculate-bias',
        projectRoot: tmpDir,
        debts: [debt],
        changedFractalPaths: ['core/auth'],
        currentCommitSha: 'sha-001',
      })) as { updatedDebts: DebtItem[] };

      expect(result.updatedDebts[0].touch_count).toBe(0);
      expect(result.updatedDebts[0].weight).toBe(1);
    });

    it('biasLevel: totalScore 0-5 → LOW_PRESSURE', async () => {
      const debts = [makeDebt({ weight: 2, last_review_commit: 'committed' })];
      const result = (await handleDebtManage({
        action: 'calculate-bias',
        projectRoot: tmpDir,
        debts,
        changedFractalPaths: [],
        currentCommitSha: 'sha-001',
      })) as { biasLevel: string; totalScore: number };

      expect(result.totalScore).toBe(2);
      expect(result.biasLevel).toBe('LOW_PRESSURE');
    });

    it('biasLevel: totalScore 6-15 → MODERATE_PRESSURE', async () => {
      const debts = Array.from({ length: 10 }, (_, i) =>
        makeDebt({ id: `debt-${i}`, weight: 1, last_review_commit: 'committed' }),
      );
      const result = (await handleDebtManage({
        action: 'calculate-bias',
        projectRoot: tmpDir,
        debts,
        changedFractalPaths: [],
        currentCommitSha: 'sha-001',
      })) as { biasLevel: string; totalScore: number };

      expect(result.totalScore).toBe(10);
      expect(result.biasLevel).toBe('MODERATE_PRESSURE');
    });

    it('biasLevel: totalScore 16-30 → HIGH_PRESSURE', async () => {
      const debts = Array.from({ length: 20 }, (_, i) =>
        makeDebt({ id: `debt-${i}`, weight: 1, last_review_commit: 'committed' }),
      );
      const result = (await handleDebtManage({
        action: 'calculate-bias',
        projectRoot: tmpDir,
        debts,
        changedFractalPaths: [],
        currentCommitSha: 'sha-001',
      })) as { biasLevel: string; totalScore: number };

      expect(result.totalScore).toBe(20);
      expect(result.biasLevel).toBe('HIGH_PRESSURE');
    });

    it('biasLevel: totalScore 31+ → CRITICAL_PRESSURE', async () => {
      const debts = Array.from({ length: 35 }, (_, i) =>
        makeDebt({ id: `debt-${i}`, weight: 1, last_review_commit: 'committed' }),
      );
      const result = (await handleDebtManage({
        action: 'calculate-bias',
        projectRoot: tmpDir,
        debts,
        changedFractalPaths: [],
        currentCommitSha: 'sha-001',
      })) as { biasLevel: string; totalScore: number };

      expect(result.totalScore).toBe(35);
      expect(result.biasLevel).toBe('CRITICAL_PRESSURE');
    });

    it('debts가 없으면 에러를 던진다', async () => {
      await expect(
        handleDebtManage({
          action: 'calculate-bias',
          projectRoot: tmpDir,
          changedFractalPaths: [],
          currentCommitSha: 'sha-001',
        }),
      ).rejects.toThrow('debts');
    });

    it('changedFractalPaths가 없으면 에러를 던진다', async () => {
      await expect(
        handleDebtManage({
          action: 'calculate-bias',
          projectRoot: tmpDir,
          debts: [],
          currentCommitSha: 'sha-001',
        }),
      ).rejects.toThrow('changedFractalPaths');
    });

    it('currentCommitSha가 없으면 에러를 던진다', async () => {
      await expect(
        handleDebtManage({
          action: 'calculate-bias',
          projectRoot: tmpDir,
          debts: [],
          changedFractalPaths: [],
        }),
      ).rejects.toThrow('currentCommitSha');
    });
  });

  // -------------------------
  // 공통 에러 케이스
  // -------------------------
  describe('공통 검증', () => {
    it('action이 없으면 에러를 던진다', async () => {
      await expect(
        handleDebtManage({ projectRoot: tmpDir } as never),
      ).rejects.toThrow('action');
    });

    it('projectRoot가 없으면 에러를 던진다', async () => {
      await expect(
        handleDebtManage({ action: 'list' } as never),
      ).rejects.toThrow('projectRoot');
    });
  });
});
