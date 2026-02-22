/**
 * @deprecated Disabled in hooks.json. Entry stub uses no-op queue.
 * This module is retained for backward compatibility but is not active at runtime.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import type { ChangeQueue, ChangeRecord } from '../core/change-queue.js';
import {
  KNOWN_ORGAN_DIR_NAMES,
  classifyNode,
} from '../core/organ-classifier.js';
import type { HookOutput, PostToolUseInput } from '../types/hooks.js';

interface ChangeLogEntry {
  timestamp: string;
  action: string;
  path: string;
  category: string;
  sessionId: string;
}

function classifyPathCategory(filePath: string, cwd: string): string {
  const segments = filePath
    .replace(/\\/g, '/')
    .split('/')
    .filter((p) => p.length > 0);

  // CLAUDE.md 또는 SPEC.md를 포함하면 fractal
  const fileName = segments[segments.length - 1] ?? '';
  if (fileName === 'CLAUDE.md' || fileName === 'SPEC.md') return 'fractal';

  // 구조 기반 organ 분류
  let dirSoFar = cwd;
  for (const segment of segments.slice(0, -1)) {
    dirSoFar = path.join(dirSoFar, segment);
    try {
      if (!fs.existsSync(dirSoFar)) {
        // 파일시스템에 없으면 레거시 이름 기반 폴백
        if (KNOWN_ORGAN_DIR_NAMES.includes(segment)) return 'organ';
        continue;
      }
      const entries = fs.readdirSync(dirSoFar, { withFileTypes: true });
      const hasClaudeMd = entries.some(
        (e) => e.isFile() && e.name === 'CLAUDE.md',
      );
      const hasSpecMd = entries.some((e) => e.isFile() && e.name === 'SPEC.md');
      const subdirs = entries.filter((e) => e.isDirectory());
      const isLeafDirectory = subdirs.length === 0;
      const hasFractalChildren = subdirs.some((d) => {
        try {
          const childPath = path.join(dirSoFar, d.name);
          const childEntries = fs.readdirSync(childPath, {
            withFileTypes: true,
          });
          return childEntries.some(
            (ce) =>
              ce.isFile() && (ce.name === 'CLAUDE.md' || ce.name === 'SPEC.md'),
          );
        } catch {
          return false;
        }
      });
      const category = classifyNode({
        dirName: segment,
        hasClaudeMd,
        hasSpecMd,
        hasFractalChildren,
        isLeafDirectory,
      });
      if (category === 'organ') return 'organ';
    } catch {
      continue;
    }
  }

  return 'unknown';
}

function appendChangeLog(cwd: string, entry: ChangeLogEntry): void {
  try {
    const logDir = path.join(cwd, '.filid');
    const logFile = path.join(logDir, 'change-log.jsonl');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    fs.appendFileSync(logFile, JSON.stringify(entry) + '\n', 'utf-8');
  } catch {
    // 로그 쓰기 실패는 조용히 무시 (hook 실패로 이어지지 않도록)
  }
}

/**
 * PostToolUse hook: track file changes for PR-time batch sync.
 *
 * After Write or Edit tool calls, enqueue the changed file path
 * into the ChangeQueue and append a categorized entry to
 * .filid/change-log.jsonl.
 *
 * Write → changeType 'created', Edit → changeType 'modified'.
 */
export function trackChange(
  input: PostToolUseInput,
  queue: ChangeQueue,
): HookOutput {
  // Only track Write and Edit mutations
  if (input.tool_name !== 'Write' && input.tool_name !== 'Edit') {
    return { continue: true };
  }

  const filePath = input.tool_input.file_path ?? input.tool_input.path ?? '';

  // Skip if no file path provided
  if (!filePath) {
    return { continue: true };
  }

  const cwd = input.cwd;
  const toolName = input.tool_name;

  // 기존 ChangeQueue enqueue 로직 (변경 없음)
  const changeType: ChangeRecord['changeType'] =
    toolName === 'Write' ? 'created' : 'modified';
  queue.enqueue({ filePath, changeType });

  // 카테고리 판별
  const category = classifyPathCategory(filePath, cwd);

  const timestamp = new Date().toISOString();
  const entry: ChangeLogEntry = {
    timestamp,
    action: toolName,
    path: filePath,
    category,
    sessionId: input.session_id,
  };

  // .filid/change-log.jsonl에 기록
  appendChangeLog(cwd, entry);

  // 디버그 모드에서만 additionalContext 주입
  if (process.env['FILID_DEBUG'] === '1') {
    const tag = `[filid:change] ${timestamp} ${toolName} ${filePath} ${category}`;
    return {
      continue: true,
      hookSpecificOutput: { additionalContext: tag },
    };
  }

  return { continue: true };
}
