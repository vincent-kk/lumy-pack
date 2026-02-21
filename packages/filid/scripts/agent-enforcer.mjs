import { readStdin } from './lib/stdin.mjs';

const input = await readStdin();
const { enforceAgentRole } = await import('../dist/hooks/agent-enforcer.js');
const result = enforceAgentRole(input);
process.stdout.write(JSON.stringify(result));
