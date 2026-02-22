#!/usr/bin/env node
import type { PreToolUseInput } from '../../types/hooks.js';
import { guardStructure } from '../structure-guard.js';

const chunks: Buffer[] = [];
for await (const chunk of process.stdin) {
  chunks.push(chunk as Buffer);
}
const raw = Buffer.concat(chunks).toString('utf-8');
let result;
try {
  const input = JSON.parse(raw) as PreToolUseInput;
  result = guardStructure(input);
} catch {
  result = { continue: true };
}
process.stdout.write(JSON.stringify(result));
