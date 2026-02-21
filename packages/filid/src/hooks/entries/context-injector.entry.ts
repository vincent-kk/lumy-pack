#!/usr/bin/env node
import { injectContext } from '../context-injector.js';
import type { UserPromptSubmitInput } from '../../types/hooks.js';

const chunks: Buffer[] = [];
for await (const chunk of process.stdin) {
  chunks.push(chunk as Buffer);
}
const input = JSON.parse(Buffer.concat(chunks).toString('utf-8')) as UserPromptSubmitInput;
const result = injectContext(input);
process.stdout.write(JSON.stringify(result));
