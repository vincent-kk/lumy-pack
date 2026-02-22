import { bench, describe } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const execFileAsync = promisify(execFile);

const DIST_DIR = join(import.meta.dirname, '../../../../..', 'dist');

const HOOK_SCRIPTS = {
  preToolValidator: join(DIST_DIR, 'hooks', 'pre-tool-validator.mjs'),
  structureGuard: join(DIST_DIR, 'hooks', 'structure-guard.mjs'),
  changeTracker: join(DIST_DIR, 'hooks', 'change-tracker.mjs'),
  agentEnforcer: join(DIST_DIR, 'hooks', 'agent-enforcer.mjs'),
  contextInjector: join(DIST_DIR, 'hooks', 'context-injector.mjs'),
};

const PRE_TOOL_INPUT = JSON.stringify({
  cwd: '/workspace',
  session_id: 'bench-session',
  hook_event_name: 'PreToolUse',
  tool_name: 'Write',
  tool_input: {
    file_path: '/workspace/CLAUDE.md',
    content: Array.from({ length: 50 }, (_, i) => `Line ${i + 1}`).join('\n'),
  },
});

const SUBAGENT_INPUT = JSON.stringify({
  cwd: '/workspace',
  session_id: 'bench-session',
  hook_event_name: 'SubagentStart',
  agent_type: 'architect',
  agent_id: 'agent-bench-001',
});

const USER_PROMPT_INPUT = JSON.stringify({
  cwd: '/workspace',
  session_id: 'bench-session',
  hook_event_name: 'UserPromptSubmit',
  prompt: 'Fix the bug',
});

async function spawnHook(scriptPath: string, stdinData: string): Promise<void> {
  await execFileAsync('node', [scriptPath], {
    input: stdinData,
    timeout: 5000,
  });
}

// 빌드된 스크립트가 존재하는 경우에만 벤치마크 실행
const scriptsExist = Object.values(HOOK_SCRIPTS).every((p) => existsSync(p));

if (scriptsExist) {
  describe('hook-spawn: end-to-end process spawn', () => {
    bench(
      'pre-tool-validator spawn',
      async () => {
        await spawnHook(HOOK_SCRIPTS.preToolValidator, PRE_TOOL_INPUT);
      },
      { time: 2000 },
    );

    bench(
      'agent-enforcer spawn',
      async () => {
        await spawnHook(HOOK_SCRIPTS.agentEnforcer, SUBAGENT_INPUT);
      },
      { time: 2000 },
    );

    bench(
      'context-injector spawn',
      async () => {
        await spawnHook(HOOK_SCRIPTS.contextInjector, USER_PROMPT_INPUT);
      },
      { time: 2000 },
    );
  });
} else {
  describe('hook-spawn: end-to-end process spawn', () => {
    bench('(skipped: build dist/ first with `yarn build`)', () => {
      // 빌드된 스크립트가 없으면 스킵
    });
  });
}
