#!/usr/bin/env node
/**
 * PostToolUse hook: track file changes.
 * Standalone version — outputs CHANGE_TRACKED context without a ChangeQueue instance.
 */
export {};
const chunks: Buffer[] = [];
for await (const chunk of process.stdin) {
  chunks.push(chunk as Buffer);
}
const input = JSON.parse(Buffer.concat(chunks).toString('utf-8'));

const filePath: string = input.tool_input?.file_path ?? input.tool_input?.path ?? '';
const toolName: string = input.tool_name ?? '';

if ((toolName === 'Write' || toolName === 'Edit') && filePath) {
  process.stdout.write(JSON.stringify({
    continue: true,
    hookSpecificOutput: {
      additionalContext: `[CHANGE_TRACKED] ${toolName}: ${filePath}`,
    },
  }));
} else {
  process.stdout.write(JSON.stringify({ continue: true }));
}
