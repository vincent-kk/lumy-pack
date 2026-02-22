#!/usr/bin/env node

// src/hooks/change-tracker.ts
import * as fs from "node:fs";
import * as path from "node:path";

// src/core/organ-classifier.ts
var LEGACY_ORGAN_DIR_NAMES = [
  "components",
  "utils",
  "types",
  "hooks",
  "helpers",
  "lib",
  "styles",
  "assets",
  "constants"
];
function isOrganDirectory(dirName) {
  return LEGACY_ORGAN_DIR_NAMES.includes(dirName);
}

// src/hooks/change-tracker.ts
function classifyPathCategory(filePath) {
  const segments = filePath.replace(/\\/g, "/").split("/").filter((p) => p.length > 0);
  for (const segment of segments.slice(0, -1)) {
    if (isOrganDirectory(segment)) return "organ";
  }
  const fileName = segments[segments.length - 1] ?? "";
  if (fileName === "CLAUDE.md" || fileName === "SPEC.md") return "fractal";
  return "unknown";
}
function appendChangeLog(cwd, entry) {
  try {
    const logDir = path.join(cwd, ".filid");
    const logFile = path.join(logDir, "change-log.jsonl");
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    fs.appendFileSync(logFile, JSON.stringify(entry) + "\n", "utf-8");
  } catch {
  }
}
function trackChange(input2, queue) {
  if (input2.tool_name !== "Write" && input2.tool_name !== "Edit") {
    return { continue: true };
  }
  const filePath = input2.tool_input.file_path ?? input2.tool_input.path ?? "";
  if (!filePath) {
    return { continue: true };
  }
  const cwd = input2.cwd;
  const toolName = input2.tool_name;
  const changeType = toolName === "Write" ? "created" : "modified";
  queue.enqueue({ filePath, changeType });
  const category = classifyPathCategory(filePath);
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const entry = {
    timestamp,
    action: toolName,
    path: filePath,
    category,
    sessionId: input2.session_id
  };
  appendChangeLog(cwd, entry);
  if (process.env["FILID_DEBUG"] === "1") {
    const tag = `[filid:change] ${timestamp} ${toolName} ${filePath} ${category}`;
    return {
      continue: true,
      hookSpecificOutput: { additionalContext: tag }
    };
  }
  return { continue: true };
}

// src/hooks/entries/change-tracker.entry.ts
var stubQueue = {
  enqueue: (_record) => {
  }
};
var chunks = [];
for await (const chunk of process.stdin) {
  chunks.push(chunk);
}
var input = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
var result;
try {
  result = trackChange(input, stubQueue);
} catch {
  result = { continue: true };
}
process.stdout.write(JSON.stringify(result));
