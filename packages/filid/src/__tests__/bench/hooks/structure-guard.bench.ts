import { bench, describe } from 'vitest';

import { guardStructure } from '../../../hooks/structure-guard.js';
import type { PreToolUseInput } from '../../../types/hooks.js';
import { generateFilePath } from '../fixtures/generator.js';

function makeInput(filePath: string, toolName = 'Write'): PreToolUseInput {
  return {
    cwd: '/workspace',
    session_id: 'bench-session',
    hook_event_name: 'PreToolUse',
    tool_name: toolName,
    tool_input: { file_path: filePath },
  };
}

// 경로 깊이별 입력 사전 생성
const depths = [2, 4, 6, 8, 10, 15, 20];
const normalInputs = depths.map((d) =>
  makeInput(generateFilePath({ depth: d })),
);
const organInputs = depths.map((d) =>
  makeInput(generateFilePath({ depth: d, isOrgan: true })),
);

describe('structure-guard: path depth (normal directory)', () => {
  for (let i = 0; i < depths.length; i++) {
    const depth = depths[i];
    const input = normalInputs[i];
    bench(`depth ${depth}: normal directory`, () => {
      guardStructure(input);
    });
  }
});

describe('structure-guard: path depth (organ directory)', () => {
  for (let i = 0; i < depths.length; i++) {
    const depth = depths[i];
    const input = organInputs[i];
    bench(`depth ${depth}: organ directory (blocked)`, () => {
      guardStructure(input);
    });
  }
});

describe('structure-guard: tool type pass-through', () => {
  const claudeMdPath = '/workspace/src/components/CLAUDE.md';

  bench('Edit tool pass-through', () => {
    guardStructure(makeInput(claudeMdPath, 'Edit'));
  });

  bench('Read tool pass-through', () => {
    guardStructure(makeInput(claudeMdPath, 'Read'));
  });

  bench('Write to non-CLAUDE.md file', () => {
    guardStructure(makeInput('/workspace/src/components/index.ts'));
  });
});
