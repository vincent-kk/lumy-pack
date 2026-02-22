import { bench, describe } from 'vitest';

import { injectContext } from '../../../hooks/context-injector.js';
import { generateUserPromptInput } from '../fixtures/generator.js';

// 티어별 입력 사전 생성
const inputS = generateUserPromptInput('S');
const inputM = generateUserPromptInput('M');
const inputL = generateUserPromptInput('L');
const inputXL = generateUserPromptInput('XL');

// cwd 경로 깊이별 입력
const cwdInputs = [
  { label: 'shallow cwd (depth 1)', cwd: '/workspace' },
  { label: 'medium cwd (depth 4)', cwd: '/workspace/packages/filid/src' },
  {
    label: 'deep cwd (depth 8)',
    cwd: '/workspace/packages/filid/src/hooks/utils/helpers/types/core',
  },
  {
    label: 'very deep cwd (depth 12)',
    cwd: '/workspace/a/b/c/d/e/f/g/h/i/j/k/l',
  },
].map(({ label, cwd }) => ({
  label,
  input: {
    cwd,
    session_id: 'bench-session',
    hook_event_name: 'UserPromptSubmit' as const,
    prompt: 'Fix the bug',
  },
}));

describe('context-injector: project size tiers', () => {
  bench('S: short prompt', () => {
    injectContext(inputS);
  });

  bench('M: medium prompt', () => {
    injectContext(inputM);
  });

  bench('L: long prompt', () => {
    injectContext(inputL);
  });

  bench('XL: very long prompt', () => {
    injectContext(inputXL);
  });
});

describe('context-injector: cwd path depth', () => {
  for (const { label, input } of cwdInputs) {
    bench(label, () => {
      injectContext(input);
    });
  }
});

describe('context-injector: sustained injection', () => {
  bench('100 sequential injections', () => {
    for (let i = 0; i < 100; i++) {
      injectContext(inputS);
    }
  });
});
