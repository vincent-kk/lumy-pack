import type {
  PreToolUseInput,
  PostToolUseInput,
  SubagentStartInput,
  UserPromptSubmitInput,
} from '../../../types/hooks.js';
import { ChangeQueue } from '../../../core/change-queue.js';

/** 티어별 파라미터 정의 */
const TIER_PARAMS = {
  S: { lineCount: 10, depth: 2, queueSize: 0, includeBoundaries: false },
  M: { lineCount: 60, depth: 4, queueSize: 50, includeBoundaries: true },
  L: { lineCount: 95, depth: 8, queueSize: 500, includeBoundaries: false },
  XL: { lineCount: 150, depth: 15, queueSize: 5000, includeBoundaries: true },
} as const;

type Tier = keyof typeof TIER_PARAMS;

/**
 * CLAUDE.md 콘텐츠 생성
 */
export function generateClaudeMdContent(
  lineCount: number,
  options?: { includeBoundaries?: boolean },
): string {
  const lines: string[] = [];

  if (options?.includeBoundaries) {
    lines.push('# Module Context');
    lines.push('');
    lines.push('## Purpose');
    lines.push('This module handles core business logic.');
    lines.push('');
    lines.push('## Constraints');
    lines.push('- Max 100 lines');
    lines.push('- Follow FCA-AI architecture');
    lines.push('');
    lines.push('## Interfaces');
    lines.push('- Input: PreToolUseInput');
    lines.push('- Output: HookOutput');
    lines.push('');
  } else {
    lines.push('# Module Context');
    lines.push('');
  }

  const headerCount = lines.length;
  const remaining = lineCount - headerCount;

  for (let i = 0; i < remaining; i++) {
    lines.push(`- Rule ${i + 1}: Follow architectural conventions and patterns`);
  }

  return lines.slice(0, lineCount).join('\n');
}

/**
 * 파일 경로 생성
 */
export function generateFilePath(options: {
  depth: number;
  isOrgan?: boolean;
  fileName?: string;
}): string {
  const { depth, isOrgan = false, fileName = 'CLAUDE.md' } = options;

  const organDirs = ['components', 'utils', 'types', 'hooks', 'helpers'];
  const normalDirs = ['src', 'packages', 'modules', 'services', 'features'];

  const segments: string[] = ['/workspace'];

  for (let i = 0; i < depth - 1; i++) {
    if (isOrgan && i === depth - 2) {
      segments.push(organDirs[i % organDirs.length]);
    } else {
      segments.push(normalDirs[i % normalDirs.length]);
    }
  }

  segments.push(fileName);
  return segments.join('/');
}

/**
 * PreToolUse 입력 생성
 */
export function generatePreToolUseInput(tier: Tier): PreToolUseInput {
  const params = TIER_PARAMS[tier];
  const content = generateClaudeMdContent(params.lineCount, {
    includeBoundaries: params.includeBoundaries,
  });
  const filePath = generateFilePath({ depth: params.depth });

  return {
    cwd: '/workspace',
    session_id: `bench-session-${tier}`,
    hook_event_name: 'PreToolUse',
    tool_name: 'Write',
    tool_input: {
      file_path: filePath,
      content,
    },
  };
}

/**
 * PostToolUse 입력 생성
 */
export function generatePostToolUseInput(tier: Tier): PostToolUseInput {
  const params = TIER_PARAMS[tier];
  const filePath = generateFilePath({ depth: params.depth, fileName: 'index.ts' });

  return {
    cwd: '/workspace',
    session_id: `bench-session-${tier}`,
    hook_event_name: 'PostToolUse',
    tool_name: 'Write',
    tool_input: {
      file_path: filePath,
    },
    tool_response: {
      success: true,
    },
  };
}

/**
 * SubagentStart 입력 생성
 */
export function generateSubagentInput(agentType: string): SubagentStartInput {
  return {
    cwd: '/workspace',
    session_id: 'bench-session',
    hook_event_name: 'SubagentStart',
    agent_type: agentType,
    agent_id: `agent-${agentType}-bench`,
  };
}

/**
 * UserPromptSubmit 입력 생성
 */
export function generateUserPromptInput(tier: Tier): UserPromptSubmitInput {
  const prompts: Record<Tier, string> = {
    S: 'Fix the bug',
    M: 'Refactor the authentication module to use the new token strategy and update all related tests',
    L: 'Design and implement a comprehensive caching layer that integrates with the existing service architecture, handles cache invalidation, supports TTL, and includes monitoring capabilities'.repeat(2),
    XL: 'Perform a full architectural review and migration plan for transitioning the monolith to microservices, including data migration strategy, API compatibility layer, rollout plan, and rollback procedures'.repeat(4),
  };

  return {
    cwd: '/workspace',
    session_id: `bench-session-${tier}`,
    hook_event_name: 'UserPromptSubmit',
    prompt: prompts[tier],
  };
}

/**
 * ChangeQueue 생성 (지정된 변경 수로 채운 상태)
 */
export function generateChangeQueue(changeCount: number): ChangeQueue {
  const queue = new ChangeQueue();
  const changeTypes = ['created', 'modified', 'deleted'] as const;

  for (let i = 0; i < changeCount; i++) {
    queue.enqueue({
      filePath: `/workspace/src/module-${i % 20}/file-${i}.ts`,
      changeType: changeTypes[i % changeTypes.length],
      timestamp: Date.now() - i * 1000,
    });
  }

  return queue;
}
