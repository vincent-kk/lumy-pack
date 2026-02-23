import type { HookOutput, SubagentStartInput } from '../types/hooks.js';

import { isFcaProject } from './shared.js';

/**
 * FCA-AI agent role definitions with tool restrictions.
 *
 * - architect: read-only, no file modifications
 * - qa-reviewer: read-only, no file modifications
 * - implementer: code within SPEC.md scope only
 * - context-manager: only CLAUDE.md/SPEC.md documents
 * - code-surgeon: fix scope only, no collateral changes
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
  'code-surgeon':
    'ROLE RESTRICTION: You are a Code Surgeon agent. You MUST apply only the approved fix item specified in the task. Do not modify files outside the fix scope or apply collateral changes.',
};

/**
 * FCA-AI workflow guidance for planning-related agents.
 * Injected to OMC planner/architect/analyst/critic and native Plan agents.
 */
const PLANNING_GUIDANCE = [
  '[FCA-AI Development Workflow]',
  'When designing a plan, include CLAUDE.md/SPEC.md update steps:',
  '1. Identify affected fractal modules (directories with CLAUDE.md)',
  '2. Plan SPEC.md updates for requirements/API changes BEFORE code',
  '3. Plan CLAUDE.md updates if boundaries or conventions change',
  '4. New modules need CLAUDE.md (max 100 lines, 3-tier) + SPEC.md',
].join('\n');

/**
 * FCA-AI pre-implementation reminder for executor agents.
 * Injected to OMC executor/deep-executor and native general-purpose agents.
 */
const IMPLEMENTATION_REMINDER = [
  '[FCA-AI Pre-Implementation Check]',
  'Before writing code, verify CLAUDE.md/SPEC.md are updated for planned changes.',
  'SPEC.md first (requirements), then CLAUDE.md if boundaries change.',
].join('\n');

const PLANNING_AGENT_RE =
  /^oh-my-claudecode:(planner|architect|analyst|critic)$/;
const EXECUTOR_AGENT_RE = /^oh-my-claudecode:(executor|deep-executor)$/;

/**
 * SubagentStart hook: inject role-based tool restrictions and FCA-AI workflow guidance.
 *
 * Priority order:
 * 1. filid agent role restrictions (exact match, always applied)
 * 2. FCA project check (skip non-FCA projects for workflow guidance)
 * 3. Planning agent guidance (OMC planner/architect/analyst/critic, native Plan)
 * 4. Implementation agent reminder (OMC executor/deep-executor, native general-purpose)
 */
export function enforceAgentRole(input: SubagentStartInput): HookOutput {
  const agentType = input.agent_type ?? '';

  // 1. filid agent role restrictions (unchanged)
  const restriction = ROLE_RESTRICTIONS[agentType];
  if (restriction) {
    return {
      continue: true,
      hookSpecificOutput: { additionalContext: restriction },
    };
  }

  // 2. Skip workflow guidance for non-FCA projects
  if (!isFcaProject(input.cwd)) {
    return { continue: true };
  }

  // 3. Planning agents: inject development workflow
  if (PLANNING_AGENT_RE.test(agentType) || agentType === 'Plan') {
    return {
      continue: true,
      hookSpecificOutput: { additionalContext: PLANNING_GUIDANCE },
    };
  }

  // 4. Implementation agents: inject pre-implementation reminder
  if (EXECUTOR_AGENT_RE.test(agentType) || agentType === 'general-purpose') {
    return {
      continue: true,
      hookSpecificOutput: { additionalContext: IMPLEMENTATION_REMINDER },
    };
  }

  return { continue: true };
}
