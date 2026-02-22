import { describe, it, expect } from 'vitest';
import { injectContext } from '../../../hooks/context-injector.js';
import type { UserPromptSubmitInput } from '../../../types/hooks.js';

const baseInput: UserPromptSubmitInput = {
  cwd: '/workspace/project',
  session_id: 'test-session',
  hook_event_name: 'UserPromptSubmit',
  prompt: 'test prompt',
};

describe('context-injector', () => {
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
});
