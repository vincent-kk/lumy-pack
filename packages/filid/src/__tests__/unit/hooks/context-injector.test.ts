import { describe, it, expect, vi, beforeEach } from 'vitest';
import { join } from 'node:path';
import type { UserPromptSubmitInput } from '../../../types/hooks.js';

// existsSync 모킹: .filid 경로에 대해 true 반환 (게이트 통과)
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    existsSync: vi.fn((p: unknown) => {
      if (typeof p === 'string' && p.endsWith('.filid')) return true;
      if (typeof p === 'string') return actual.existsSync(p);
      return false;
    }),
    // 캐시 읽기 시 null 반환하도록 (캐시 미스)
    statSync: vi.fn(() => {
      throw new Error('no cache');
    }),
    readFileSync: actual.readFileSync,
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  };
});

const { injectContext } = await import('../../../hooks/context-injector.js');

const baseInput: UserPromptSubmitInput = {
  cwd: '/workspace/project',
  session_id: 'test-session',
  hook_event_name: 'UserPromptSubmit',
  prompt: 'test prompt',
};

describe('context-injector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    const { existsSync } = await import('node:fs');
    // 게이트가 false를 반환하도록 모킹 변경
    (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const result = await injectContext(baseInput);
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput).toBeUndefined();

    // 모킹 복원
    (existsSync as ReturnType<typeof vi.fn>).mockImplementation((p: unknown) => {
      if (typeof p === 'string' && p.endsWith('.filid')) return true;
      return false;
    });
  });

  it('should include category classification guide', async () => {
    const result = await injectContext(baseInput);
    const ctx = result.hookSpecificOutput?.additionalContext ?? '';
    expect(ctx).toContain('fractal');
    expect(ctx).toContain('organ');
    expect(ctx).toContain('pure-function');
  });
});
