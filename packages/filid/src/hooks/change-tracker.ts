import * as fs from 'node:fs';
import * as path from 'node:path';
import type { PostToolUseInput, HookOutput } from '../types/hooks.js';
import type { ChangeQueue, ChangeRecord } from '../core/change-queue.js';
import { isOrganDirectory } from '../core/organ-classifier.js';

interface ChangeLogEntry {
  timestamp: string;
  action: string;
  path: string;
  category: string;
  sessionId: string;
}

function classifyPathCategory(filePath: string): string {
  const segments = filePath.replace(/\\/g, '/').split('/').filter((p) => p.length > 0);
  // 간단한 경로 기반 분류 (organ-classifier 기반)
  for (const segment of segments.slice(0, -1)) {
    if (isOrganDirectory(segment)) return 'organ';
  }
  // CLAUDE.md 또는 SPEC.md를 포함하면 fractal
  const fileName = segments[segments.length - 1] ?? '';
  if (fileName === 'CLAUDE.md' || fileName === 'SPEC.md') return 'fractal';
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
  const category = classifyPathCategory(filePath);

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
