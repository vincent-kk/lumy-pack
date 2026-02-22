import { bench, describe } from 'vitest';

import { validatePreToolUse } from '../../../hooks/pre-tool-validator.js';
import type { PreToolUseInput } from '../../../types/hooks.js';
import {
  generateClaudeMdContent,
  generatePreToolUseInput,
} from '../fixtures/generator.js';

// 티어별 입력 사전 생성
const inputS = generatePreToolUseInput('S');
const inputM = generatePreToolUseInput('M');
const inputL = generatePreToolUseInput('L');
const inputXL = generatePreToolUseInput('XL');

// SPEC.md 벤치마크용 입력
const specInput: PreToolUseInput = {
  cwd: '/workspace',
  session_id: 'bench-session',
  hook_event_name: 'PreToolUse',
  tool_name: 'Write',
  tool_input: {
    file_path: '/workspace/SPEC.md',
    content: '# Spec\n- Feature A\n- Feature B\n- Feature C\n',
  },
};
const oldSpecContent = '# Spec\n- Feature A\n';

// Edit 도구 입력 (pass-through 경로)
const editInput: PreToolUseInput = {
  cwd: '/workspace',
  session_id: 'bench-session',
  hook_event_name: 'PreToolUse',
  tool_name: 'Edit',
  tool_input: {
    file_path: '/workspace/CLAUDE.md',
    old_string: 'old line',
    new_string: 'new line',
  },
};

describe('pre-tool-validator', () => {
  bench('S: 10-line CLAUDE.md', () => {
    validatePreToolUse(inputS);
  });

  bench('M: 60-line CLAUDE.md with boundaries', () => {
    validatePreToolUse(inputM);
  });

  bench('L: 95-line CLAUDE.md', () => {
    validatePreToolUse(inputL);
  });

  bench('XL: 150-line CLAUDE.md', () => {
    validatePreToolUse(inputXL);
  });

  bench('SPEC.md validation (append-only detection)', () => {
    validatePreToolUse(specInput, oldSpecContent);
  });

  bench('Edit tool pass-through (no validation)', () => {
    validatePreToolUse(editInput);
  });

  bench('Non-target file pass-through', () => {
    validatePreToolUse({
      cwd: '/workspace',
      session_id: 'bench-session',
      hook_event_name: 'PreToolUse',
      tool_name: 'Write',
      tool_input: { file_path: '/workspace/index.ts', content: 'const x = 1;' },
    });
  });
});

describe('pre-tool-validator: context size scaling', () => {
  const sizes = [10, 25, 50, 75, 100];

  for (const size of sizes) {
    const content = generateClaudeMdContent(size);
    const input: PreToolUseInput = {
      cwd: '/workspace',
      session_id: 'bench-session',
      hook_event_name: 'PreToolUse',
      tool_name: 'Write',
      tool_input: { file_path: '/workspace/CLAUDE.md', content },
    };

    bench(`${size}-line CLAUDE.md`, () => {
      validatePreToolUse(input);
    });
  }
});
