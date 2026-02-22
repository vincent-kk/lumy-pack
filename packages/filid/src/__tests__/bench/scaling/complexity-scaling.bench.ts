import { bench, describe } from 'vitest';
import { validatePreToolUse } from '../../../hooks/pre-tool-validator.js';
import { guardStructure } from '../../../hooks/structure-guard.js';
import { trackChange } from '../../../hooks/change-tracker.js';
import {
  generateClaudeMdContent,
  generateFilePath,
  generateChangeQueue,
} from '../fixtures/generator.js';
import type { PreToolUseInput, PostToolUseInput } from '../../../types/hooks.js';
import { ChangeQueue } from '../../../core/change-queue.js';

// pre-tool-validator: CLAUDE.md 라인 수 스케일링
describe('scaling: pre-tool-validator line counts', () => {
  const lineCounts = [10, 25, 50, 75, 100, 150, 200, 500, 1000];

  for (const lineCount of lineCounts) {
    const content = generateClaudeMdContent(lineCount);
    const input: PreToolUseInput = {
      cwd: '/workspace',
      session_id: 'bench-session',
      hook_event_name: 'PreToolUse',
      tool_name: 'Write',
      tool_input: {
        file_path: '/workspace/CLAUDE.md',
        content,
      },
    };

    bench(`line count: ${lineCount}`, () => {
      validatePreToolUse(input);
    });
  }
});

// structure-guard: 경로 깊이 스케일링
describe('scaling: structure-guard path depths', () => {
  const pathDepths = [2, 4, 6, 8, 10, 15, 20];

  for (const depth of pathDepths) {
    const filePath = generateFilePath({ depth, isOrgan: true });
    const input: PreToolUseInput = {
      cwd: '/workspace',
      session_id: 'bench-session',
      hook_event_name: 'PreToolUse',
      tool_name: 'Write',
      tool_input: { file_path: filePath },
    };

    bench(`path depth: ${depth}`, () => {
      guardStructure(input);
    });
  }
});

// change-tracker: 큐 크기 스케일링
describe('scaling: change-tracker queue sizes', () => {
  const queueSizes = [0, 10, 50, 100, 500, 1000, 5000];

  const writeInput: PostToolUseInput = {
    cwd: '/workspace',
    session_id: 'bench-session',
    hook_event_name: 'PostToolUse',
    tool_name: 'Write',
    tool_input: { file_path: '/workspace/src/index.ts' },
    tool_response: { success: true },
  };

  for (const size of queueSizes) {
    bench(`queue size: ${size}`, () => {
      const queue = generateChangeQueue(size);
      trackChange(writeInput, queue);
    });
  }
});

// 복합 스케일링: 여러 훅 동시 실행
describe('scaling: combined hook pipeline', () => {
  const tiers = [
    { label: 'minimal (10 lines, depth 2, queue 0)', lineCount: 10, depth: 2, queueSize: 0 },
    { label: 'small (25 lines, depth 4, queue 10)', lineCount: 25, depth: 4, queueSize: 10 },
    { label: 'medium (60 lines, depth 6, queue 100)', lineCount: 60, depth: 6, queueSize: 100 },
    { label: 'large (95 lines, depth 10, queue 500)', lineCount: 95, depth: 10, queueSize: 500 },
  ];

  for (const tier of tiers) {
    const claudeMdContent = generateClaudeMdContent(tier.lineCount);
    const claudeMdFilePath = generateFilePath({ depth: tier.depth });
    const organFilePath = generateFilePath({ depth: tier.depth, isOrgan: true });

    const preToolInput: PreToolUseInput = {
      cwd: '/workspace',
      session_id: 'bench-session',
      hook_event_name: 'PreToolUse',
      tool_name: 'Write',
      tool_input: { file_path: claudeMdFilePath, content: claudeMdContent },
    };

    const organInput: PreToolUseInput = {
      cwd: '/workspace',
      session_id: 'bench-session',
      hook_event_name: 'PreToolUse',
      tool_name: 'Write',
      tool_input: { file_path: organFilePath },
    };

    const postToolInput: PostToolUseInput = {
      cwd: '/workspace',
      session_id: 'bench-session',
      hook_event_name: 'PostToolUse',
      tool_name: 'Write',
      tool_input: { file_path: claudeMdFilePath },
      tool_response: { success: true },
    };

    bench(tier.label, () => {
      const queue = generateChangeQueue(tier.queueSize);
      validatePreToolUse(preToolInput);
      guardStructure(organInput);
      trackChange(postToolInput, queue);
    });
  }
});
