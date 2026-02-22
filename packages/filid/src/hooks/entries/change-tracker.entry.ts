#!/usr/bin/env node
import { trackChange } from '../change-tracker.js';
import type { PostToolUseInput } from '../../types/hooks.js';

// Minimal ChangeQueue stub for the standalone entry — no persistent queue needed
const stubQueue = {
  enqueue: (_record: unknown) => {},
};

const chunks: Buffer[] = [];
for await (const chunk of process.stdin) {
  chunks.push(chunk as Buffer);
}
const input = JSON.parse(Buffer.concat(chunks).toString('utf-8')) as PostToolUseInput;

let result;
try {
  result = trackChange(input, stubQueue as any);
} catch {
  result = { continue: true };
}

process.stdout.write(JSON.stringify(result));
