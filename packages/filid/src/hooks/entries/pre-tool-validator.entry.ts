#!/usr/bin/env node
import { validatePreToolUse } from '../pre-tool-validator.js';
import type { PreToolUseInput } from '../../types/hooks.js';

const chunks: Buffer[] = [];
for await (const chunk of process.stdin) {
  chunks.push(chunk as Buffer);
}
const input = JSON.parse(Buffer.concat(chunks).toString('utf-8')) as PreToolUseInput;
const result = validatePreToolUse(input);
process.stdout.write(JSON.stringify(result));
