import type { PostToolUseInput, HookOutput } from '../types/hooks.js';
import type { ChangeQueue, ChangeRecord } from '../core/change-queue.js';

/**
 * PostToolUse hook: track file changes for PR-time batch sync.
 *
 * After Write or Edit tool calls, enqueue the changed file path
 * into the ChangeQueue. Non-mutation tools (Read, Glob, etc.)
 * are ignored.
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

  const changeType: ChangeRecord['changeType'] =
    input.tool_name === 'Write' ? 'created' : 'modified';

  queue.enqueue({ filePath, changeType });

  return { continue: true };
}
