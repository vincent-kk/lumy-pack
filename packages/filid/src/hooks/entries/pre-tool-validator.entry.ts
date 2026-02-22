#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { validatePreToolUse, isSpecMd } from '../pre-tool-validator.js';
import type { PreToolUseInput } from '../../types/hooks.js';

const chunks: Buffer[] = [];
for await (const chunk of process.stdin) {
  chunks.push(chunk as Buffer);
}
const input = JSON.parse(Buffer.concat(chunks).toString('utf-8')) as PreToolUseInput;

// SPEC.md Write 시 기존 파일 읽어서 append-only 검증 활성화
const filePath = input.tool_input.file_path ?? input.tool_input.path ?? '';
let oldSpecContent: string | undefined;
if (input.tool_name === 'Write' && isSpecMd(filePath)) {
  try {
    oldSpecContent = readFileSync(filePath, 'utf-8');
  } catch {
    // 기존 파일 없으면 undefined (검증 건너뜀)
  }
}

let result;
try {
  result = validatePreToolUse(input, oldSpecContent);
} catch {
  result = { continue: true };
}
process.stdout.write(JSON.stringify(result));
