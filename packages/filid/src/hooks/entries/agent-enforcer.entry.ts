#!/usr/bin/env node
import type { SubagentStartInput } from '../../types/hooks.js';
import { enforceAgentRole } from '../agent-enforcer.js';

const chunks: Buffer[] = [];
for await (const chunk of process.stdin) {
  chunks.push(chunk as Buffer);
}
const input = JSON.parse(
  Buffer.concat(chunks).toString('utf-8'),
) as SubagentStartInput;
let result;
try {
  result = enforceAgentRole(input);
} catch {
  result = { continue: true };
}
process.stdout.write(JSON.stringify(result));
