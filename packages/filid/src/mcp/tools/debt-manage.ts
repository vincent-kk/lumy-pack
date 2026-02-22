import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type {
  BiasLevel,
  BiasResult,
  DebtItem,
  DebtItemCreate,
} from '../../types/debt.js';
import { DEBT_BASE_WEIGHT, DEBT_WEIGHT_CAP } from '../../types/debt.js';

export interface DebtManageInput {
  action: 'create' | 'list' | 'resolve' | 'calculate-bias';
  projectRoot: string;
  debtItem?: DebtItemCreate;
  fractalPath?: string;
  debtId?: string;
  debts?: DebtItem[];
  changedFractalPaths?: string[];
  currentCommitSha?: string;
}

function getDebtDir(projectRoot: string): string {
  return join(projectRoot, '.filid', 'debt');
}

function normalizeId(fractalPath: string, content: string): string {
  const normalized = fractalPath.replace(/\//g, '-');
  const hash = createHash('sha256').update(content).digest('hex').slice(0, 6);
  return `${normalized}-${hash}`;
}

function serializeFrontmatter(item: DebtItem): string {
  const fields: Array<keyof DebtItem> = [
    'id',
    'fractal_path',
    'file_path',
    'created_at',
    'review_branch',
    'original_fix_id',
    'severity',
    'weight',
    'touch_count',
    'last_review_commit',
    'rule_violated',
    'metric_value',
  ];
  const lines = fields.map((key) => {
    const value = item[key];
    if (value === null || value === undefined) {
      return `${key}: null`;
    }
    if (
      typeof value === 'string' &&
      (value.includes(':') || value.includes('\n') || value.includes("'"))
    ) {
      return `${key}: "${value.replace(/"/g, '\\"')}"`;
    }
    return `${key}: ${value}`;
  });
  return `---\n${lines.join('\n')}\n---`;
}

function buildMarkdownBody(item: DebtItem): string {
  return `# 기술 부채: ${item.title}
## 원래 수정 요청
${item.original_request}
## 개발자 소명
${item.developer_justification}
## 정제된 ADR
${item.refined_adr}`;
}

function parseFrontmatter(
  content: string,
): Record<string, string | number | null> {
  const match = /^---\n([\s\S]*?)\n---/.exec(content);
  if (!match) return {};
  const result: Record<string, string | number | null> = {};
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();
    if (value === 'null') {
      result[key] = null;
    } else if (/^\d+(\.\d+)?$/.test(value)) {
      result[key] = Number(value);
    } else if (value.startsWith('"') && value.endsWith('"')) {
      result[key] = value.slice(1, -1).replace(/\\"/g, '"');
    } else {
      result[key] = value;
    }
  }
  return result;
}

function determineBiasLevel(totalScore: number): BiasLevel {
  if (totalScore <= 5) return 'LOW_PRESSURE';
  if (totalScore <= 15) return 'MODERATE_PRESSURE';
  if (totalScore <= 30) return 'HIGH_PRESSURE';
  return 'CRITICAL_PRESSURE';
}

async function handleCreate(
  projectRoot: string,
  debtItem: DebtItemCreate,
): Promise<{ filePath: string; id: string }> {
  const content = JSON.stringify(debtItem);
  const id = normalizeId(debtItem.fractal_path, content);

  const item: DebtItem = {
    ...debtItem,
    id,
    weight: DEBT_BASE_WEIGHT,
    touch_count: 0,
    last_review_commit: null,
  };

  const debtDir = getDebtDir(projectRoot);
  await mkdir(debtDir, { recursive: true });

  const filePath = join(debtDir, `${id}.md`);
  const fileContent = `${serializeFrontmatter(item)}\n\n${buildMarkdownBody(item)}\n`;
  await writeFile(filePath, fileContent, 'utf-8');

  return { filePath, id };
}

async function handleList(
  projectRoot: string,
  fractalPath?: string,
): Promise<{ debts: DebtItem[]; totalWeight: number }> {
  const debtDir = getDebtDir(projectRoot);

  let files: string[];
  try {
    files = await readdir(debtDir);
  } catch {
    return { debts: [], totalWeight: 0 };
  }

  const mdFiles = files.filter((f) => f.endsWith('.md'));
  if (mdFiles.length === 0) {
    return { debts: [], totalWeight: 0 };
  }

  const debts: DebtItem[] = [];

  for (const file of mdFiles) {
    const filePath = join(debtDir, file);
    const content = await readFile(filePath, 'utf-8');
    const fm = parseFrontmatter(content);

    if (Object.keys(fm).length === 0) continue;

    const debt: DebtItem = {
      id: String(fm['id'] ?? ''),
      fractal_path: String(fm['fractal_path'] ?? ''),
      file_path: String(fm['file_path'] ?? ''),
      created_at: String(fm['created_at'] ?? ''),
      review_branch: String(fm['review_branch'] ?? ''),
      original_fix_id: String(fm['original_fix_id'] ?? ''),
      severity: (fm['severity'] as DebtItem['severity']) ?? 'LOW',
      weight: Number(fm['weight'] ?? 1),
      touch_count: Number(fm['touch_count'] ?? 0),
      last_review_commit: fm['last_review_commit'] as string | null,
      rule_violated: String(fm['rule_violated'] ?? ''),
      metric_value: String(fm['metric_value'] ?? ''),
      title: '',
      original_request: '',
      developer_justification: '',
      refined_adr: '',
    };

    // Parse body sections
    const titleMatch = /^# 기술 부채: (.+)$/m.exec(content);
    if (titleMatch) debt.title = titleMatch[1].trim();

    const orMatch = /## 원래 수정 요청\n([\s\S]*?)(?=\n##|$)/.exec(content);
    if (orMatch) debt.original_request = orMatch[1].trim();

    const djMatch = /## 개발자 소명\n([\s\S]*?)(?=\n##|$)/.exec(content);
    if (djMatch) debt.developer_justification = djMatch[1].trim();

    const adrMatch = /## 정제된 ADR\n([\s\S]*?)(?=\n##|$)/.exec(content);
    if (adrMatch) debt.refined_adr = adrMatch[1].trim();

    debts.push(debt);
  }

  const filtered = fractalPath
    ? debts.filter((d) => d.fractal_path === fractalPath)
    : debts;

  const totalWeight = filtered.reduce((sum, d) => sum + d.weight, 0);

  return { debts: filtered, totalWeight };
}

async function handleResolve(
  projectRoot: string,
  debtId: string,
): Promise<{ deleted: boolean }> {
  const filePath = join(getDebtDir(projectRoot), `${debtId}.md`);
  try {
    await unlink(filePath);
    return { deleted: true };
  } catch {
    return { deleted: false };
  }
}

function handleCalculateBias(
  debts: DebtItem[],
  changedFractalPaths: string[],
  currentCommitSha: string,
): BiasResult {
  const changedSet = new Set(changedFractalPaths);

  const updatedDebts = debts.map((debt) => {
    if (!changedSet.has(debt.fractal_path)) {
      return { ...debt };
    }
    // Idempotency check
    if (debt.last_review_commit === currentCommitSha) {
      return { ...debt };
    }
    const newTouchCount = debt.touch_count + 1;
    const newWeight = Math.min(
      DEBT_BASE_WEIGHT * Math.pow(2, newTouchCount),
      DEBT_WEIGHT_CAP,
    );
    return {
      ...debt,
      touch_count: newTouchCount,
      weight: newWeight,
      last_review_commit: currentCommitSha,
    };
  });

  const totalScore = updatedDebts.reduce((sum, d) => sum + d.weight, 0);
  const biasLevel = determineBiasLevel(totalScore);

  return { biasLevel, totalScore, updatedDebts };
}

/**
 * Handle debt-manage MCP tool calls.
 *
 * Manages technical debt items: create, list, resolve, and calculate bias.
 */
export async function handleDebtManage(
  args: unknown,
): Promise<
  | { filePath: string; id: string }
  | { debts: DebtItem[]; totalWeight: number }
  | { deleted: boolean }
  | BiasResult
> {
  const input = args as DebtManageInput;

  if (!input.action) {
    throw new Error('action is required');
  }
  if (!input.projectRoot) {
    throw new Error('projectRoot is required');
  }

  switch (input.action) {
    case 'create': {
      if (!input.debtItem) {
        throw new Error('debtItem is required for create action');
      }
      return handleCreate(input.projectRoot, input.debtItem);
    }
    case 'list': {
      return handleList(input.projectRoot, input.fractalPath);
    }
    case 'resolve': {
      if (!input.debtId) {
        throw new Error('debtId is required for resolve action');
      }
      return handleResolve(input.projectRoot, input.debtId);
    }
    case 'calculate-bias': {
      if (!input.debts) {
        throw new Error('debts is required for calculate-bias action');
      }
      if (!input.changedFractalPaths) {
        throw new Error(
          'changedFractalPaths is required for calculate-bias action',
        );
      }
      if (!input.currentCommitSha) {
        throw new Error(
          'currentCommitSha is required for calculate-bias action',
        );
      }
      return handleCalculateBias(
        input.debts,
        input.changedFractalPaths,
        input.currentCommitSha,
      );
    }
    default: {
      throw new Error(`Unknown action: ${(input as DebtManageInput).action}`);
    }
  }
}
