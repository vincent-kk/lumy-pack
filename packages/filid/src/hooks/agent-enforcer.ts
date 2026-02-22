import type { HookOutput, SubagentStartInput } from '../types/hooks.js';

/**
 * FCA-AI agent role definitions with tool restrictions.
 *
 * - architect: read-only, no file modifications
 * - qa-reviewer: read-only, no file modifications
 * - implementer: code within SPEC.md scope only
 * - context-manager: only CLAUDE.md/SPEC.md documents
 */
const ROLE_RESTRICTIONS: Record<string, string> = {
  'fractal-architect':
    'ROLE RESTRICTION: You are a Fractal Architect agent. You MUST NOT use Write or Edit tools. You are read-only — analyze structure, design, plan, and draft proposals only.',
  'qa-reviewer':
    'ROLE RESTRICTION: You are a QA/Reviewer agent. You MUST NOT use Write or Edit tools. Review, analyze, and report only.',
  implementer:
    'ROLE RESTRICTION: You are an Implementer agent. You MUST only implement within the scope defined by SPEC.md. Do not make architectural changes beyond the approved specification.',
  'context-manager':
    'ROLE RESTRICTION: You are a Context Manager agent. You may only edit CLAUDE.md and SPEC.md documents. Do not modify business logic or source code.',
  'drift-analyzer':
    'ROLE RESTRICTION: You are a Drift Analyzer agent. You MUST NOT use Write or Edit tools. You are read-only — detect drift, classify severity, and produce correction plans only.',
  restructurer:
    'ROLE RESTRICTION: You are a Restructurer agent. You may only execute actions from an approved restructuring plan. Do not make structural decisions or modify business logic.',
};

/**
 * SubagentStart hook: inject role-based tool restrictions.
 *
 * When a subagent starts, this hook checks its type against
 * FCA-AI role definitions and injects appropriate restrictions
 * via additionalContext. The agent is not blocked — instead,
 * role constraints are communicated as instructions.
 */
export function enforceAgentRole(input: SubagentStartInput): HookOutput {
  const agentType = input.agent_type ?? '';

  const restriction = ROLE_RESTRICTIONS[agentType];

  if (!restriction) {
    return { continue: true };
  }

  return {
    continue: true,
    hookSpecificOutput: {
      additionalContext: restriction,
    },
  };
}
