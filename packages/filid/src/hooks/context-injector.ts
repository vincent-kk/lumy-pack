import type { UserPromptSubmitInput, HookOutput } from '../types/hooks.js';
import { loadBuiltinRules, getActiveRules } from '../core/rule-engine.js';
import { scanProject } from '../core/fractal-tree.js';
import { validateStructure } from '../core/fractal-validator.js';
import { detectDrift } from '../core/drift-detector.js';

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

  // 2단계: 프랙탈 구조 섹션 (스캔 성공 시에만 추가)
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

  return {
    continue: true,
    hookSpecificOutput: {
      additionalContext,
    },
  };
}
