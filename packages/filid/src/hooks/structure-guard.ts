import { existsSync, readdirSync } from 'node:fs';
import * as path from 'node:path';
import type { PreToolUseInput, HookOutput } from '../types/hooks.js';
import { classifyNode, LEGACY_ORGAN_DIR_NAMES } from '../core/organ-classifier.js';

/**
 * 디렉토리 경로를 기반으로 organ 여부를 판별.
 * classifyNode()를 사용하여 구조 기반 분류를 수행하고,
 * 파일시스템 접근 실패 시 false를 반환한다.
 */
function isOrganByStructure(dirPath: string): boolean {
  try {
    if (!existsSync(dirPath)) {
      // 파일시스템에 없으면 레거시 이름 기반 폴백
      return LEGACY_ORGAN_DIR_NAMES.includes(path.basename(dirPath));
    }
    const entries = readdirSync(dirPath, { withFileTypes: true });
    const hasClaudeMd = entries.some((e) => e.isFile() && e.name === 'CLAUDE.md');
    const hasSpecMd = entries.some((e) => e.isFile() && e.name === 'SPEC.md');
    const subdirs = entries.filter((e) => e.isDirectory());
    const hasFractalChildren = subdirs.some((d) => {
      const childPath = path.join(dirPath, d.name);
      try {
        const childEntries = readdirSync(childPath, { withFileTypes: true });
        return childEntries.some(
          (ce) => ce.isFile() && (ce.name === 'CLAUDE.md' || ce.name === 'SPEC.md'),
        );
      } catch {
        return false;
      }
    });
    const isLeafDirectory = subdirs.length === 0;
    const category = classifyNode({
      dirName: path.basename(dirPath),
      hasClaudeMd,
      hasSpecMd,
      hasFractalChildren,
      isLeafDirectory,
    });
    return category === 'organ';
  } catch {
    return false;
  }
}

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
    let dirSoFar = cwd;
    for (const segment of segments) {
      dirSoFar = path.join(dirSoFar, segment);
      if (isOrganByStructure(dirSoFar)) {
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
  let organIdx = -1;
  let organSegment = '';
  {
    let dirSoFar = cwd;
    for (let i = 0; i < segments.length; i++) {
      dirSoFar = path.join(dirSoFar, segments[i]);
      if (isOrganByStructure(dirSoFar)) {
        organIdx = i;
        organSegment = segments[i];
        break;
      }
    }
  }
  if (organIdx !== -1 && organIdx < segments.length - 1) {
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
