#!/usr/bin/env node
import { readFileSync } from 'node:fs';

import type { PreToolUseInput } from '../../types/hooks.js';
import { isSpecMd, validatePreToolUse } from '../pre-tool-validator.js';

const chunks: Buffer[] = [];
for await (const chunk of process.stdin) {
  chunks.push(chunk as Buffer);
}
const raw = Buffer.concat(chunks).toString('utf-8');
let result;
try {
  const input = JSON.parse(raw) as PreToolUseInput;

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

  result = validatePreToolUse(input, oldSpecContent);
} catch {
  result = { continue: true };
}
process.stdout.write(JSON.stringify(result));
