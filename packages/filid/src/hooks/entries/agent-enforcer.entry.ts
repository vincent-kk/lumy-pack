#!/usr/bin/env node
import type { SubagentStartInput } from '../../types/hooks.js';
import { enforceAgentRole } from '../agent-enforcer.js';

const chunks: Buffer[] = [];
for await (const chunk of process.stdin) {
  chunks.push(chunk as Buffer);
}
const raw = Buffer.concat(chunks).toString('utf-8');
let result;
try {
  const input = JSON.parse(raw) as SubagentStartInput;
  result = enforceAgentRole(input);
} catch {
  result = { continue: true };
}
process.stdout.write(JSON.stringify(result));
