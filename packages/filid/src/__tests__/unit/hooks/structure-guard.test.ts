import { describe, it, expect } from 'vitest';
import { guardStructure } from '../../../hooks/structure-guard.js';
import type { PreToolUseInput } from '../../../types/hooks.js';

const baseInput: PreToolUseInput = {
  cwd: '/workspace',
  session_id: 'test-session',
  hook_event_name: 'PreToolUse',
  tool_name: 'Write',
  tool_input: {},
};

describe('structure-guard', () => {
  it('should block CLAUDE.md creation inside organ directories', () => {
    const input: PreToolUseInput = {
      ...baseInput,
      tool_input: { file_path: '/app/src/utils/CLAUDE.md', content: '# Utils' },
    };
    const result = guardStructure(input);
    expect(result.continue).toBe(false);
    expect(result.hookSpecificOutput?.additionalContext).toContain('organ');
  });

  it('should block CLAUDE.md in nested organ directories', () => {
    const input: PreToolUseInput = {
      ...baseInput,
      tool_input: {
        file_path: '/app/src/components/ui/CLAUDE.md',
        content: '# UI',
      },
    };
    const result = guardStructure(input);
    expect(result.continue).toBe(false);
  });

  it('should allow CLAUDE.md in fractal directories', () => {
    const input: PreToolUseInput = {
      ...baseInput,
      tool_input: { file_path: '/app/src/auth/CLAUDE.md', content: '# Auth' },
    };
    const result = guardStructure(input);
    expect(result.continue).toBe(true);
  });

  it('should allow non-CLAUDE.md files in organ directories', () => {
    const input: PreToolUseInput = {
      ...baseInput,
      tool_input: {
        file_path: '/app/src/utils/helper.ts',
        content: 'export {}',
      },
    };
    const result = guardStructure(input);
    expect(result.continue).toBe(true);
  });

  it('should pass through Edit tool calls for CLAUDE.md', () => {
    const input: PreToolUseInput = {
      ...baseInput,
      tool_name: 'Edit',
      tool_input: {
        file_path: '/app/src/utils/CLAUDE.md',
        new_string: 'updated',
      },
    };
    const result = guardStructure(input);
    expect(result.continue).toBe(true);
  });

  it('should detect all known organ directory names', () => {
    const organDirs = [
      'components',
      'utils',
      'types',
      'hooks',
      'helpers',
      'lib',
      'styles',
      'assets',
      'constants',
    ];
    for (const dir of organDirs) {
      const input: PreToolUseInput = {
        ...baseInput,
        tool_input: { file_path: `/app/src/${dir}/CLAUDE.md`, content: '# X' },
      };
      const result = guardStructure(input);
      expect(result.continue, `Expected block for organ dir: ${dir}`).toBe(false);
    }
  });

  it('should handle root-relative CLAUDE.md paths', () => {
    const input: PreToolUseInput = {
      ...baseInput,
      tool_input: { file_path: 'utils/CLAUDE.md', content: '# Utils' },
    };
    const result = guardStructure(input);
    expect(result.continue).toBe(false);
  });

  it('should warn on organ nesting (subdirectory creation)', () => {
    const input: PreToolUseInput = {
      ...baseInput,
      tool_input: {
        file_path: '/app/src/utils/deep/nested/helper.ts',
        content: 'export {}',
      },
    };
    const result = guardStructure(input);
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('organ');
  });

  it('should pass through non-Write/Edit tool calls', () => {
    const input: PreToolUseInput = {
      ...baseInput,
      tool_name: 'Read',
      tool_input: { file_path: '/app/src/utils/CLAUDE.md' },
    };
    const result = guardStructure(input);
    expect(result.continue).toBe(true);
  });
});
