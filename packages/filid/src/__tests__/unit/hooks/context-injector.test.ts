import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { UserPromptSubmitInput } from '../../../types/hooks.js';

// Default existsSync behavior:
//   .filid path    → true  (passes isFcaProject gate)
//   /session-* path → false (treated as first session)
//   others         → false (cache files absent = cache miss)
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    existsSync: vi.fn((p: unknown) => {
      if (typeof p === 'string' && p.endsWith('.filid')) return true;
      if (typeof p === 'string' && p.includes('/session-')) return false;
      return false;
    }),
    statSync: vi.fn(() => {
      throw new Error('no cache');
    }),
    readFileSync: actual.readFileSync,
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    readdirSync: vi.fn(() => []),
    unlinkSync: vi.fn(),
  };
});

const { injectContext } = await import('../../../hooks/context-injector.js');
const { existsSync, readdirSync } = await import('node:fs');

const baseInput: UserPromptSubmitInput = {
  cwd: '/workspace/project',
  session_id: 'test-session',
  hook_event_name: 'UserPromptSubmit',
  prompt: 'test prompt',
};

describe('context-injector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // restore default existsSync behavior so each test runs independently
    (existsSync as ReturnType<typeof vi.fn>).mockImplementation((p: unknown) => {
      if (typeof p === 'string' && p.endsWith('.filid')) return true;
      if (typeof p === 'string' && p.includes('/session-')) return false;
      return false;
    });
  });

  it('should inject FCA-AI context reminder', async () => {
    const result = await injectContext(baseInput);
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toBeDefined();
    expect(result.hookSpecificOutput?.additionalContext).toContain('FCA-AI');
  });

  it('should include organ directory awareness', async () => {
    const result = await injectContext(baseInput);
    const ctx = result.hookSpecificOutput?.additionalContext ?? '';
    expect(ctx).toContain('Organ');
  });

  it('should include CLAUDE.md 100-line limit reminder', async () => {
    const result = await injectContext(baseInput);
    const ctx = result.hookSpecificOutput?.additionalContext ?? '';
    expect(ctx).toContain('100');
  });

  it('should include 3+12 rule reminder', async () => {
    const result = await injectContext(baseInput);
    const ctx = result.hookSpecificOutput?.additionalContext ?? '';
    expect(ctx).toContain('15');
  });

  it('should include current working directory in context', async () => {
    const result = await injectContext(baseInput);
    const ctx = result.hookSpecificOutput?.additionalContext ?? '';
    expect(ctx).toContain('/workspace/project');
  });

  it('should always continue (never block user prompts)', async () => {
    const result = await injectContext(baseInput);
    expect(result.continue).toBe(true);
  });

  it('should skip context injection for non-FCA projects', async () => {
    (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const result = await injectContext(baseInput);
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput).toBeUndefined();
  });

  it('should include category classification guide', async () => {
    const result = await injectContext(baseInput);
    const ctx = result.hookSpecificOutput?.additionalContext ?? '';
    expect(ctx).toContain('fractal');
    expect(ctx).toContain('organ');
    expect(ctx).toContain('pure-function');
  });

  // === Session-based inject tests ===

  it('should not inject on second call in same session', async () => {
    // simulate second call: session marker already exists
    (existsSync as ReturnType<typeof vi.fn>).mockImplementation((p: unknown) => {
      if (typeof p === 'string' && p.endsWith('.filid')) return true;
      if (typeof p === 'string' && p.includes('/session-')) return true; // marker exists
      return false;
    });

    const result = await injectContext(baseInput);
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput).toBeUndefined();
  });

  it('should inject independently for different session IDs', async () => {
    const input1 = { ...baseInput, session_id: 'session-alpha' };
    const input2 = { ...baseInput, session_id: 'session-beta' };

    const result1 = await injectContext(input1);
    const result2 = await injectContext(input2);

    expect(result1.hookSpecificOutput?.additionalContext).toBeDefined();
    expect(result2.hookSpecificOutput?.additionalContext).toBeDefined();
  });

  it('should safely inject when session marker I/O fails', async () => {
    // existsSync throws on session marker check → isFirstInSession returns true (safe fallback)
    (existsSync as ReturnType<typeof vi.fn>).mockImplementation((p: unknown) => {
      if (typeof p === 'string' && p.endsWith('.filid')) return true;
      if (typeof p === 'string' && p.includes('/session-'))
        throw new Error('fs error');
      return false;
    });

    const result = await injectContext(baseInput);
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toBeDefined();
  });

  it('should call readdirSync after markSessionInjected (pruneOldSessions invoked)', async () => {
    await injectContext(baseInput);
    expect(readdirSync).toHaveBeenCalled();
  });
});
