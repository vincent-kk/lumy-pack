import { describe, expect, it, vi } from 'vitest';

import type { SubagentStartInput } from '../../../types/hooks.js';

// Mock node:fs to control isFcaProject behavior
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    existsSync: vi.fn(() => false),
  };
});

const { enforceAgentRole } = await import('../../../hooks/agent-enforcer.js');
const { existsSync } = await import('node:fs');

const baseInput: SubagentStartInput = {
  cwd: '/workspace',
  session_id: 'test-session',
  hook_event_name: 'SubagentStart',
  agent_type: '',
  agent_id: 'test-agent-001',
};

/** Helper: make isFcaProject return true (.filid exists) */
function mockFcaProject() {
  (existsSync as ReturnType<typeof vi.fn>).mockImplementation((p: unknown) => {
    if (typeof p === 'string' && p.endsWith('.filid')) return true;
    return false;
  });
}

/** Helper: make isFcaProject return false */
function mockNonFcaProject() {
  (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
}

describe('agent-enforcer', () => {
  // === filid agent role restrictions (unchanged behavior) ===

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
    mockNonFcaProject();
    const input: SubagentStartInput = {
      ...baseInput,
      agent_type: 'custom-unknown-agent',
    };
    const result = enforceAgentRole(input);
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput).toBeUndefined();
  });

  it('should handle empty agent_type gracefully', () => {
    mockNonFcaProject();
    const result = enforceAgentRole(baseInput);
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput).toBeUndefined();
  });

  // === FCA workflow guidance for OMC/native agents ===

  describe('planning agent guidance (FCA project)', () => {
    it('should inject planning guidance for oh-my-claudecode:planner', () => {
      mockFcaProject();
      const result = enforceAgentRole({
        ...baseInput,
        agent_type: 'oh-my-claudecode:planner',
      });
      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.additionalContext).toContain(
        'FCA-AI Development Workflow',
      );
      expect(result.hookSpecificOutput?.additionalContext).toContain(
        'CLAUDE.md',
      );
    });

    it('should inject planning guidance for oh-my-claudecode:architect', () => {
      mockFcaProject();
      const result = enforceAgentRole({
        ...baseInput,
        agent_type: 'oh-my-claudecode:architect',
      });
      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.additionalContext).toContain(
        'FCA-AI Development Workflow',
      );
    });

    it('should inject planning guidance for oh-my-claudecode:analyst', () => {
      mockFcaProject();
      const result = enforceAgentRole({
        ...baseInput,
        agent_type: 'oh-my-claudecode:analyst',
      });
      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.additionalContext).toContain(
        'FCA-AI Development Workflow',
      );
    });

    it('should inject planning guidance for oh-my-claudecode:critic', () => {
      mockFcaProject();
      const result = enforceAgentRole({
        ...baseInput,
        agent_type: 'oh-my-claudecode:critic',
      });
      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.additionalContext).toContain(
        'FCA-AI Development Workflow',
      );
    });

    it('should inject planning guidance for native Plan agent', () => {
      mockFcaProject();
      const result = enforceAgentRole({
        ...baseInput,
        agent_type: 'Plan',
      });
      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.additionalContext).toContain(
        'FCA-AI Development Workflow',
      );
    });
  });

  describe('implementation agent reminder (FCA project)', () => {
    it('should inject implementation reminder for oh-my-claudecode:executor', () => {
      mockFcaProject();
      const result = enforceAgentRole({
        ...baseInput,
        agent_type: 'oh-my-claudecode:executor',
      });
      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.additionalContext).toContain(
        'FCA-AI Pre-Implementation Check',
      );
    });

    it('should inject implementation reminder for oh-my-claudecode:deep-executor', () => {
      mockFcaProject();
      const result = enforceAgentRole({
        ...baseInput,
        agent_type: 'oh-my-claudecode:deep-executor',
      });
      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.additionalContext).toContain(
        'FCA-AI Pre-Implementation Check',
      );
    });

    it('should inject implementation reminder for native general-purpose agent', () => {
      mockFcaProject();
      const result = enforceAgentRole({
        ...baseInput,
        agent_type: 'general-purpose',
      });
      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.additionalContext).toContain(
        'FCA-AI Pre-Implementation Check',
      );
    });
  });

  describe('non-FCA project (no workflow guidance)', () => {
    it('should skip guidance for OMC planner in non-FCA project', () => {
      mockNonFcaProject();
      const result = enforceAgentRole({
        ...baseInput,
        agent_type: 'oh-my-claudecode:planner',
      });
      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput).toBeUndefined();
    });

    it('should skip guidance for general-purpose in non-FCA project', () => {
      mockNonFcaProject();
      const result = enforceAgentRole({
        ...baseInput,
        agent_type: 'general-purpose',
      });
      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput).toBeUndefined();
    });
  });
});
