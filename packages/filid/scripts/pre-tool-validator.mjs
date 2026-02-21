import { readStdin } from './lib/stdin.mjs';

const input = await readStdin();
const { validatePreToolUse } = await import('../dist/hooks/pre-tool-validator.js');
const result = validatePreToolUse(input);
process.stdout.write(JSON.stringify(result));
