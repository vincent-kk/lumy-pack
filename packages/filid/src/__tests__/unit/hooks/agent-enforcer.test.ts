import { describe, expect, it } from 'vitest';

import { enforceAgentRole } from '../../../hooks/agent-enforcer.js';
import type { SubagentStartInput } from '../../../types/hooks.js';

const baseInput: SubagentStartInput = {
  cwd: '/workspace',
  session_id: 'test-session',
  hook_event_name: 'SubagentStart',
  agent_type: '',
  agent_id: 'test-agent-001',
};

describe('agent-enforcer', () => {
  it('should restrict fractal-architect to read-only (disallow Write, Edit)', () => {
    const input: SubagentStartInput = {
      ...baseInput,
      agent_type: 'fractal-architect',
    };
    const result = enforceAgentRole(input);
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('Write');
    expect(result.hookSpecificOutput?.additionalContext).toContain('Edit');
  });

  it('should restrict drift-analyzer to read-only (disallow Write, Edit)', () => {
    const input: SubagentStartInput = {
      ...baseInput,
      agent_type: 'drift-analyzer',
    };
    const result = enforceAgentRole(input);
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('Write');
    expect(result.hookSpecificOutput?.additionalContext).toContain('Edit');
  });

  it('should restrict restructurer to approved plan scope', () => {
    const input: SubagentStartInput = {
      ...baseInput,
      agent_type: 'restructurer',
    };
    const result = enforceAgentRole(input);
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain(
      'approved restructuring plan',
    );
  });

  it('should restrict qa-reviewer to read-only (disallow Write, Edit)', () => {
    const input: SubagentStartInput = {
      ...baseInput,
      agent_type: 'qa-reviewer',
    };
    const result = enforceAgentRole(input);
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('Write');
    expect(result.hookSpecificOutput?.additionalContext).toContain('Edit');
  });

  it('should restrict implementer to SPEC.md scope', () => {
    const input: SubagentStartInput = {
      ...baseInput,
      agent_type: 'implementer',
    };
    const result = enforceAgentRole(input);
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('SPEC.md');
  });

  it('should restrict context-manager to document files only', () => {
    const input: SubagentStartInput = {
      ...baseInput,
      agent_type: 'context-manager',
    };
    const result = enforceAgentRole(input);
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('CLAUDE.md');
    expect(result.hookSpecificOutput?.additionalContext).toContain('SPEC.md');
  });

  it('should pass through unknown agent types without restrictions', () => {
    const input: SubagentStartInput = {
      ...baseInput,
      agent_type: 'general-purpose',
    };
    const result = enforceAgentRole(input);
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput).toBeUndefined();
  });

  it('should handle empty agent_type gracefully', () => {
    const result = enforceAgentRole(baseInput);
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput).toBeUndefined();
  });
});
