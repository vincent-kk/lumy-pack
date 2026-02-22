import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { UserPromptSubmitInput, HookOutput } from '../types/hooks.js';
import { loadBuiltinRules, getActiveRules } from '../core/rule-engine.js';
import { scanProject } from '../core/fractal-tree.js';
import { validateStructure } from '../core/fractal-validator.js';
import { detectDrift } from '../core/drift-detector.js';

const CACHE_TTL_MS = 30_000; // 30 seconds

function cwdHash(cwd: string): string {
  return createHash('sha256').update(cwd).digest('hex').slice(0, 12);
}

function getCacheDir(cwd: string): string {
  return join(cwd, '.filid');
}

function readCachedContext(cwd: string): string | null {
  const hash = cwdHash(cwd);
  const cacheDir = getCacheDir(cwd);
  const stampFile = join(cacheDir, `last-scan-${hash}`);
  const contextFile = join(cacheDir, `cached-context-${hash}.txt`);

  try {
    if (!existsSync(stampFile) || !existsSync(contextFile)) return null;
    const mtime = statSync(stampFile).mtimeMs;
    if (Date.now() - mtime > CACHE_TTL_MS) return null;
    return readFileSync(contextFile, 'utf-8');
  } catch {
    return null;
  }
}

function writeCachedContext(cwd: string, context: string): void {
  const hash = cwdHash(cwd);
  const cacheDir = getCacheDir(cwd);
  const stampFile = join(cacheDir, `last-scan-${hash}`);
  const contextFile = join(cacheDir, `cached-context-${hash}.txt`);

  try {
    if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true });
    writeFileSync(contextFile, context, 'utf-8');
    writeFileSync(stampFile, String(Date.now()), 'utf-8');
  } catch {
    // 캐시 쓰기 실패는 조용히 무시
  }
}

const CATEGORY_GUIDE = [
  '- fractal: CLAUDE.md 또는 SPEC.md가 있는 독립 모듈',
  '- organ: 프랙탈 자식이 없는 리프 디렉토리',
  '- pure-function: 부작용 없는 순수 함수 모음',
  '- hybrid: fractal + organ 특성을 동시에 가지는 과도기적 노드',
].join('\n');

/**
 * 기존 FCA-AI 규칙 텍스트 (변경 없음)
 */
function buildFcaContext(cwd: string): string {
  return [
    `[FCA-AI] Active in: ${cwd}`,
    'Rules:',
    '- CLAUDE.md: max 100 lines, must include 3-tier boundary sections',
    '- SPEC.md: no append-only growth, must restructure on updates',
    '- Organ directories (구조 분석 기반 자동 분류) must NOT have CLAUDE.md',
    '- Test files: max 15 cases per spec.ts (3 basic + 12 complex)',
    '- LCOM4 >= 2 → split module, CC > 15 → compress/abstract',
  ].join('\n');
}

/**
 * UserPromptSubmit hook: inject FCA-AI context reminders.
 *
 * 기존 FCA-AI 규칙 텍스트를 유지하면서, 아래에 프랙탈 구조 규칙 요약 섹션을 추가 주입한다.
 * 프랙탈 구조 스캔에 실패하면 기존 FCA-AI 컨텍스트만 반환한다.
 *
 * Never blocks user prompts (always continue: true).
 */
export async function injectContext(input: UserPromptSubmitInput): Promise<HookOutput> {
  const cwd = input.cwd;

  // 1단계: 기존 FCA-AI 컨텍스트 (항상 포함)
  const fcaContext = buildFcaContext(cwd);

  // 2단계: 캐시된 프랙탈 컨텍스트 확인
  const cached = readCachedContext(cwd);
  if (cached) {
    return {
      continue: true,
      hookSpecificOutput: { additionalContext: cached },
    };
  }

  // 3단계: 프랙탈 구조 섹션 (스캔 성공 시에만 추가)
  let fractalSection = '';
  try {
    const rules = getActiveRules(loadBuiltinRules());
    const rulesText = rules.map((r) => `- ${r.id}: ${r.description}`).join('\n');

    // 고위험 이격 감지 (실패 시 섹션 생략)
    let driftText = '';
    try {
      const tree = await scanProject(cwd);
      const validationReport = validateStructure(tree);
      const driftResult = detectDrift(tree, validationReport.result.violations);
      const highPriority = driftResult.items.filter(
        (d) => d.severity === 'critical' || d.severity === 'high',
      );
      if (highPriority.length > 0) {
        const driftLines = highPriority
          .slice(0, 5)
          .map((d) => `- ${d.path} — ${d.expected} (expected: ${d.actual})`)
          .join('\n');
        driftText =
          `\n\n⚠ High-severity drifts detected: ${highPriority.length} items\n` + driftLines;
      }
    } catch {
      // 이격 감지 실패는 조용히 무시
    }

    fractalSection = [
      '',
      '[filid] Fractal Structure Rules:',
      rulesText,
      '',
      'Category Classification:',
      CATEGORY_GUIDE,
      driftText,
    ].join('\n');
  } catch {
    // 프랙탈 스캔 실패 → 프랙탈 섹션 생략, FCA-AI만 반환
  }

  const additionalContext = (fcaContext + fractalSection).trim();

  // 캐시 저장
  writeCachedContext(cwd, additionalContext);

  return {
    continue: true,
    hookSpecificOutput: {
      additionalContext,
    },
  };
}
