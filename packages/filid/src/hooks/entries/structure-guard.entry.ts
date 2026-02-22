#!/usr/bin/env node
import type { PreToolUseInput } from '../../types/hooks.js';
import { guardStructure } from '../structure-guard.js';

const chunks: Buffer[] = [];
for await (const chunk of process.stdin) {
  chunks.push(chunk as Buffer);
}
const input = JSON.parse(
  Buffer.concat(chunks).toString('utf-8'),
) as PreToolUseInput;

let result;
try {
  result = guardStructure(input);
} catch {
  result = { continue: true };
}

process.stdout.write(JSON.stringify(result));
