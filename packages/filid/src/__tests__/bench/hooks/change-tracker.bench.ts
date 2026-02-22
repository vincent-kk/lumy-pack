import { bench, describe } from 'vitest';

import { ChangeQueue } from '../../../core/change-queue.js';
import { trackChange } from '../../../hooks/change-tracker.js';
import type { PostToolUseInput } from '../../../types/hooks.js';
import { generateChangeQueue } from '../fixtures/generator.js';

function makeInput(
  toolName: 'Write' | 'Edit',
  filePath: string,
): PostToolUseInput {
  return {
    cwd: '/workspace',
    session_id: 'bench-session',
    hook_event_name: 'PostToolUse',
    tool_name: toolName,
    tool_input: { file_path: filePath },
    tool_response: { success: true },
  };
}

const writeInput = makeInput('Write', '/workspace/src/index.ts');
const editInput = makeInput('Edit', '/workspace/src/utils/helper.ts');
const readInput: PostToolUseInput = {
  cwd: '/workspace',
  session_id: 'bench-session',
  hook_event_name: 'PostToolUse',
  tool_name: 'Read',
  tool_input: { file_path: '/workspace/src/index.ts' },
  tool_response: { content: 'file content' },
};

const queueSizes = [0, 10, 50, 100, 500, 1000, 5000];

describe('change-tracker: queue sizes', () => {
  for (const size of queueSizes) {
    bench(`Write to queue with ${size} existing items`, () => {
      const queue = generateChangeQueue(size);
      trackChange(writeInput, queue);
    });
  }
});

describe('change-tracker: tool types', () => {
  bench('Write tool (created)', () => {
    const queue = new ChangeQueue();
    trackChange(writeInput, queue);
  });

  bench('Edit tool (modified)', () => {
    const queue = new ChangeQueue();
    trackChange(editInput, queue);
  });

  bench('Read tool (pass-through)', () => {
    const queue = new ChangeQueue();
    trackChange(readInput, queue);
  });
});

describe('change-tracker: sustained enqueue', () => {
  bench('100 sequential Write enqueues', () => {
    const queue = new ChangeQueue();
    for (let i = 0; i < 100; i++) {
      trackChange(makeInput('Write', `/workspace/src/file-${i}.ts`), queue);
    }
  });

  bench('1000 sequential Edit enqueues', () => {
    const queue = new ChangeQueue();
    for (let i = 0; i < 1000; i++) {
      trackChange(makeInput('Edit', `/workspace/src/file-${i}.ts`), queue);
    }
  });
});
