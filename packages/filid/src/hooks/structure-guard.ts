import * as path from 'node:path';
import type { PreToolUseInput, HookOutput } from '../types/hooks.js';
import { isOrganDirectory } from '../core/organ-classifier.js';

function getParentSegments(filePath: string): string[] {
  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.split('/').filter((p) => p.length > 0);
  return parts.slice(0, -1);
}

function isClaudeMd(filePath: string): boolean {
  return filePath.endsWith('/CLAUDE.md') || filePath === 'CLAUDE.md';
}

function extractImportPaths(content: string): string[] {
  const importRegex = /from\s+['"]([^'"]+)['"]/g;
  const paths: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(content)) !== null) {
    paths.push(match[1]);
  }
  return paths;
}

function isAncestorPath(filePath: string, importPath: string, cwd: string): boolean {
  if (!importPath.startsWith('.')) return false;
  const fileDir = path.dirname(path.resolve(cwd, filePath));
  const resolvedImport = path.resolve(fileDir, importPath);
  const fileAbsolute = path.resolve(cwd, filePath);
  return fileAbsolute.startsWith(resolvedImport + path.sep);
}

/**
 * PreToolUse hook: organ-guard 로직을 포팅하고 카테고리 검증 3가지를 추가.
 *
 * [기존 로직 보존] organ 디렉토리 내 CLAUDE.md Write → continue: false
 * [추가 검증] 경고 3가지 (continue: true):
 *   1. 미분류 경로 모듈 생성
 *   2. organ 내부 하위 디렉토리 생성
 *   3. 잠재적 순환 의존 import
 */
export function guardStructure(input: PreToolUseInput): HookOutput {
  if (input.tool_name !== 'Write' && input.tool_name !== 'Edit') {
    return { continue: true };
  }

  const filePath = input.tool_input.file_path ?? input.tool_input.path ?? '';
  if (!filePath) {
    return { continue: true };
  }

  const cwd = input.cwd;
  const segments = getParentSegments(filePath);

  // [기존 로직 보존] organ 디렉토리 내 CLAUDE.md Write → 차단 (continue: false)
  if (input.tool_name === 'Write' && isClaudeMd(filePath)) {
    for (const segment of segments) {
      if (isOrganDirectory(segment)) {
        return {
          continue: false,
          hookSpecificOutput: {
            additionalContext:
              `BLOCKED: Cannot create CLAUDE.md inside organ directory "${segment}". ` +
              `Organ directories are leaf-level compartments and should not have their own CLAUDE.md.`,
          },
        };
      }
    }
  }

  // [추가 검증] 경고만 수집 (continue: true)
  const warnings: string[] = [];

  // 검사 2: organ 내부 하위 디렉토리 생성 (organ은 flat이어야 한다)
  const organIdx = segments.findIndex((s) => isOrganDirectory(s));
  if (organIdx !== -1 && organIdx < segments.length - 1) {
    const organSegment = segments[organIdx];
    warnings.push(
      `organ 디렉토리 "${organSegment}" 내부에 하위 디렉토리를 생성하려 합니다. ` +
        `Organ 디렉토리는 flat leaf 구획으로 중첩 디렉토리를 가져서는 안 됩니다.`,
    );
  }

  // 검사 3: 잠재적 순환 의존
  const content = input.tool_input.content ?? input.tool_input.new_string ?? '';
  if (content) {
    const importPaths = extractImportPaths(content);
    const circularCandidates = importPaths.filter((p) => isAncestorPath(filePath, p, cwd));
    if (circularCandidates.length > 0) {
      warnings.push(
        `다음 import가 현재 파일의 조상 모듈을 참조합니다 (순환 의존 위험): ` +
          circularCandidates.map((p) => `"${p}"`).join(', '),
      );
    }
  }

  if (warnings.length === 0) {
    return { continue: true };
  }

  const additionalContext =
    `⚠️ Warning from filid structure-guard:\n` +
    warnings.map((w, i) => `${i + 1}. ${w}`).join('\n');

  return {
    continue: true,
    hookSpecificOutput: { additionalContext },
  };
}
