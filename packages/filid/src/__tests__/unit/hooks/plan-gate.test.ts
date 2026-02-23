import { describe, expect, it, vi } from 'vitest';

import type { PreToolUseInput } from '../../../types/hooks.js';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    existsSync: vi.fn(() => false),
  };
});

const { validatePlanExit } = await import('../../../hooks/plan-gate.js');
const { existsSync } = await import('node:fs');

const baseInput: PreToolUseInput = {
  cwd: '/workspace/project',
  session_id: 'test-session',
  hook_event_name: 'PreToolUse',
  tool_name: 'ExitPlanMode',
  tool_input: {},
};

describe('plan-gate', () => {
  it('should inject FCA-AI checklist for FCA projects', () => {
    (existsSync as ReturnType<typeof vi.fn>).mockImplementation(
      (p: unknown) => {
        if (typeof p === 'string' && p.endsWith('.filid')) return true;
        return false;
      },
    );

    const result = validatePlanExit(baseInput);
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain(
      'FCA-AI Plan Compliance Checklist',
    );
  });

  it('should include CLAUDE.md/SPEC.md update steps in checklist', () => {
    (existsSync as ReturnType<typeof vi.fn>).mockImplementation(
      (p: unknown) => {
        if (typeof p === 'string' && p.endsWith('.filid')) return true;
        return false;
      },
    );

    const result = validatePlanExit(baseInput);
    const ctx = result.hookSpecificOutput?.additionalContext ?? '';
    expect(ctx).toContain('CLAUDE.md');
    expect(ctx).toContain('SPEC.md');
  });

  it('should never block (always continue: true)', () => {
    (existsSync as ReturnType<typeof vi.fn>).mockImplementation(
      (p: unknown) => {
        if (typeof p === 'string' && p.endsWith('.filid')) return true;
        return false;
      },
    );

    const result = validatePlanExit(baseInput);
    expect(result.continue).toBe(true);
  });

  it('should skip injection for non-FCA projects', () => {
    (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const result = validatePlanExit(baseInput);
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput).toBeUndefined();
  });

  it('should detect FCA project via CLAUDE.md presence', () => {
    (existsSync as ReturnType<typeof vi.fn>).mockImplementation(
      (p: unknown) => {
        if (typeof p === 'string' && p.endsWith('CLAUDE.md')) return true;
        return false;
      },
    );

    const result = validatePlanExit(baseInput);
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain(
      'FCA-AI Plan Compliance Checklist',
    );
  });
});
