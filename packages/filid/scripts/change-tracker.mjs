#!/usr/bin/env node

// src/hooks/entries/change-tracker.entry.ts
var chunks = [];
for await (const chunk of process.stdin) {
  chunks.push(chunk);
}
var input = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
var filePath = input.tool_input?.file_path ?? input.tool_input?.path ?? "";
var toolName = input.tool_name ?? "";
if ((toolName === "Write" || toolName === "Edit") && filePath) {
  process.stdout.write(JSON.stringify({
    continue: true,
    hookSpecificOutput: {
      additionalContext: `[CHANGE_TRACKED] ${toolName}: ${filePath}`
    }
  }));
} else {
  process.stdout.write(JSON.stringify({ continue: true }));
}
