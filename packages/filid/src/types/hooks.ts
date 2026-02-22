/**
 * Claude Code Hook input/output type definitions
 */

/** Hook base input (stdin JSON) */
export interface HookBaseInput {
  /** Current working directory */
  cwd: string;
  /** Session identifier */
  session_id: string;
  /** Hook event name */
  hook_event_name: string;
}

/** PreToolUse hook input */
export interface PreToolUseInput extends HookBaseInput {
  hook_event_name: 'PreToolUse';
  /** Name of the tool being called */
  tool_name: string;
  /** Tool input parameters */
  tool_input: {
    file_path?: string;
    path?: string;
    content?: string;
    old_string?: string;
    new_string?: string;
    [key: string]: unknown;
  };
}

/** PostToolUse hook input */
export interface PostToolUseInput extends HookBaseInput {
  hook_event_name: 'PostToolUse';
  /** Name of the tool that was called */
  tool_name: string;
  /** Tool input parameters */
  tool_input: {
    file_path?: string;
    path?: string;
    [key: string]: unknown;
  };
  /** Tool execution result */
  tool_response: {
    [key: string]: unknown;
  };
}

/** SubagentStart hook input */
export interface SubagentStartInput extends HookBaseInput {
  hook_event_name: 'SubagentStart';
  /** Agent type */
  agent_type: string;
  /** Agent ID */
  agent_id: string;
}

/** UserPromptSubmit hook input */
export interface UserPromptSubmitInput extends HookBaseInput {
  hook_event_name: 'UserPromptSubmit';
  /** User prompt content */
  prompt?: string;
}

/** Hook output (stdout JSON) */
export interface HookOutput {
  /** Whether to continue (false = block, PreToolUse only) */
  continue: boolean;
  /** Hook-specific output */
  hookSpecificOutput?: {
    /** Additional context to inject into agent */
    additionalContext?: string;
  };
}

/** Union of all hook input types */
export type HookInput =
  | PreToolUseInput
  | PostToolUseInput
  | SubagentStartInput
  | UserPromptSubmitInput;

/** structure-guard가 출력하는 검증 결과. */
export interface StructureGuardOutput extends HookOutput {
  hookSpecificOutput?: {
    additionalContext?: string;
    violations?: Array<{
      ruleId: string;
      severity: string;
      message: string;
      path: string;
    }>;
  };
}

/** context-injector가 주입하는 프랙탈 컨텍스트 요약. */
export interface FractalContextSummary {
  root: string;
  totalNodes: number;
  pendingDrifts: number;
  lastScanTimestamp: string | null;
}
