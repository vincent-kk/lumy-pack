import { readStdin } from './lib/stdin.mjs';

const input = await readStdin();
// Change tracker needs a shared queue instance; for hook scripts,
// we output continue:true and log the change for external processing.
const filePath = input.tool_input?.file_path ?? input.tool_input?.path ?? '';
const toolName = input.tool_name ?? '';

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
