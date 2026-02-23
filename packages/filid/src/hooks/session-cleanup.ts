/**
 * session-cleanup.ts — SessionEnd hook for cleaning up session cache files.
 *
 * Removes session-context-{hash} marker and cached-context-{hash} cache
 * created by context-injector when the session ends.
 */
import { removeSessionFiles } from '../core/cache-manager.js';
import type { HookOutput, SessionEndInput } from '../types/hooks.js';

/**
 * SessionEnd hook: remove the current session's cache files.
 *
 * Never blocks session termination (always continue: true).
 */
export function cleanupSession(input: SessionEndInput): HookOutput {
  const { cwd, session_id } = input;
  removeSessionFiles(session_id, cwd);
  return { continue: true };
}
