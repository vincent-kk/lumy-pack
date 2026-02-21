#!/usr/bin/env node
import { enforceAgentRole } from '../agent-enforcer.js';
import type { SubagentStartInput } from '../../types/hooks.js';

const chunks: Buffer[] = [];
for await (const chunk of process.stdin) {
  chunks.push(chunk as Buffer);
}
const input = JSON.parse(Buffer.concat(chunks).toString('utf-8')) as SubagentStartInput;
const result = enforceAgentRole(input);
process.stdout.write(JSON.stringify(result));
