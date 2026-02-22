#!/usr/bin/env node
import type { PostToolUseInput } from '../../types/hooks.js';
import { trackChange } from '../change-tracker.js';

// Minimal ChangeQueue stub for the standalone entry — no persistent queue needed
const stubQueue = {
  enqueue: (_record: unknown) => {},
};

const chunks: Buffer[] = [];
for await (const chunk of process.stdin) {
  chunks.push(chunk as Buffer);
}
const raw = Buffer.concat(chunks).toString('utf-8');
let result;
try {
  const input = JSON.parse(raw) as PostToolUseInput;
  result = trackChange(input, stubQueue as any);
} catch {
  result = { continue: true };
}

process.stdout.write(JSON.stringify(result));
