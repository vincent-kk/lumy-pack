import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

import { getActiveRules, loadBuiltinRules } from '../core/rule-engine.js';
import type { HookOutput, UserPromptSubmitInput } from '../types/hooks.js';

// 5min TTL — 구조 변경(CLAUDE.md Write)은 드물게 발생하므로 안전.
// 필요 시 Write hook에서 캐시 무효화를 추가할 수 있다.
const CACHE_TTL_MS = 300_000;

function cwdHash(cwd: string): string {
  return createHash('sha256').update(cwd).digest('hex').slice(0, 12);
}

function getCacheDir(cwd: string): string {
  return join(cwd, '.filid', 'cache');
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
 * FCA-AI 프로젝트 여부 판별.
 * .filid/ 디렉토리 또는 CLAUDE.md 존재 시 FCA-AI 프로젝트로 간주.
 *
 * 엣지 케이스: 신규 프로젝트에서 /filid:init 전에는 false 반환 (의도적).
 * init 스킬은 자체 SKILL.md에서 규칙을 로드하므로 hook 컨텍스트에 의존하지 않는다.
 */
function isFcaProject(cwd: string): boolean {
  return existsSync(join(cwd, '.filid')) || existsSync(join(cwd, 'CLAUDE.md'));
}

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
 *
 * Never blocks user prompts (always continue: true).
 */
export async function injectContext(
  input: UserPromptSubmitInput,
): Promise<HookOutput> {
  const cwd = input.cwd;

  // 게이트: FCA-AI 프로젝트가 아니면 즉시 반환
  if (!isFcaProject(cwd)) {
    return { continue: true };
  }

  // 캐시된 컨텍스트 확인
  const cached = readCachedContext(cwd);
  if (cached) {
    return {
      continue: true,
      hookSpecificOutput: { additionalContext: cached },
    };
  }

  // 1단계: 기존 FCA-AI 컨텍스트 (항상 포함)
  const fcaContext = buildFcaContext(cwd);

  // 2단계: 경량 프랙탈 섹션 (규칙 목록 + 분류 가이드만, 스캔/이격 감지 없음)
  let fractalSection = '';
  try {
    const rules = getActiveRules(loadBuiltinRules());
    const rulesText = rules
      .map((r) => `- ${r.id}: ${r.description}`)
      .join('\n');

    fractalSection = [
      '',
      '[filid] Fractal Structure Rules:',
      rulesText,
      '',
      'Category Classification:',
      CATEGORY_GUIDE,
    ].join('\n');
  } catch {
    // 규칙 로드 실패 → 프랙탈 섹션 생략, FCA-AI만 반환
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
