import { describe, it, expect } from 'vitest';
import { trackChange } from '../../../hooks/change-tracker.js';
import type { PostToolUseInput } from '../../../types/hooks.js';
import { ChangeQueue } from '../../../core/change-queue.js';

const baseInput: PostToolUseInput = {
  cwd: '/workspace',
  session_id: 'test-session',
  hook_event_name: 'PostToolUse',
  tool_name: 'Write',
  tool_input: {},
  tool_response: '',
};

describe('change-tracker', () => {
  it('should enqueue a change for Write tool', () => {
    const queue = new ChangeQueue();
    const input: PostToolUseInput = {
      ...baseInput,
      tool_input: { file_path: '/app/src/auth/login.ts', content: 'export {}' },
    };
    const result = trackChange(input, queue);
    expect(result.continue).toBe(true);
    expect(queue.size()).toBe(1);
  });

  it('should enqueue a change for Edit tool', () => {
    const queue = new ChangeQueue();
    const input: PostToolUseInput = {
      ...baseInput,
      tool_name: 'Edit',
      tool_input: { file_path: '/app/src/auth/login.ts', old_string: 'a', new_string: 'b' },
    };
    const result = trackChange(input, queue);
    expect(result.continue).toBe(true);
    expect(queue.size()).toBe(1);
  });

  it('should ignore non-Write/Edit tools', () => {
    const queue = new ChangeQueue();
    const input: PostToolUseInput = {
      ...baseInput,
      tool_name: 'Read',
      tool_input: { file_path: '/app/src/auth/login.ts' },
    };
    const result = trackChange(input, queue);
    expect(result.continue).toBe(true);
    expect(queue.size()).toBe(0);
  });

  it('should track multiple changes to different files', () => {
    const queue = new ChangeQueue();
    trackChange({
      ...baseInput,
      tool_input: { file_path: '/app/a.ts', content: '1' },
    }, queue);
    trackChange({
      ...baseInput,
      tool_input: { file_path: '/app/b.ts', content: '2' },
    }, queue);
    expect(queue.size()).toBe(2);
  });

  it('should track multiple changes to the same file', () => {
    const queue = new ChangeQueue();
    trackChange({
      ...baseInput,
      tool_input: { file_path: '/app/a.ts', content: '1' },
    }, queue);
    trackChange({
      ...baseInput,
      tool_name: 'Edit',
      tool_input: { file_path: '/app/a.ts', old_string: '1', new_string: '2' },
    }, queue);
    expect(queue.size()).toBe(2);
    expect(queue.getChangesByPath().get('/app/a.ts')).toHaveLength(2);
  });

  it('should record correct changeType based on tool name', () => {
    const queue = new ChangeQueue();
    trackChange({
      ...baseInput,
      tool_name: 'Write',
      tool_input: { file_path: '/app/x.ts', content: 'new' },
    }, queue);
    trackChange({
      ...baseInput,
      tool_name: 'Edit',
      tool_input: { file_path: '/app/y.ts', old_string: 'a', new_string: 'b' },
    }, queue);
    const all = queue.peek();
    expect(all[0].changeType).toBe('created');
    expect(all[1].changeType).toBe('modified');
  });

  it('should handle missing file_path gracefully', () => {
    const queue = new ChangeQueue();
    const input: PostToolUseInput = {
      ...baseInput,
      tool_input: {},
    };
    const result = trackChange(input, queue);
    expect(result.continue).toBe(true);
    expect(queue.size()).toBe(0);
  });
});
