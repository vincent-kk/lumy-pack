#!/usr/bin/env node

// src/hooks/change-tracker.ts
import * as fs from "node:fs";
import * as path from "node:path";

// src/core/organ-classifier.ts
var ORGAN_BASE_NAMES = [
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
var KNOWN_ORGAN_DIR_NAMES = [
  ...ORGAN_BASE_NAMES,
  "test",
  "tests",
  "spec",
  "specs",
  "fixtures",
  "e2e"
];
function isInfraOrgDirectoryByPattern(dirName) {
  const isDoubleUnderscore = dirName.startsWith("__") && dirName.endsWith("__") && dirName.length > 4;
  const isDotPrefixed = dirName.startsWith(".");
  return isDoubleUnderscore || isDotPrefixed;
}
function classifyNode(input) {
  if (input.hasClaudeMd) return "fractal";
  if (input.hasSpecMd) return "fractal";
  if (isInfraOrgDirectoryByPattern(input.dirName)) return "organ";
  if (KNOWN_ORGAN_DIR_NAMES.includes(input.dirName)) return "organ";
  if (!input.hasFractalChildren && input.isLeafDirectory) return "organ";
  const hasSideEffects = input.hasSideEffects ?? true;
  if (!hasSideEffects) return "pure-function";
  return "fractal";
}

// src/hooks/change-tracker.ts
function classifyPathCategory(filePath, cwd) {
  const segments = filePath.replace(/\\/g, "/").split("/").filter((p) => p.length > 0);
  const fileName = segments[segments.length - 1] ?? "";
  if (fileName === "CLAUDE.md" || fileName === "SPEC.md") return "fractal";
  let dirSoFar = cwd;
  for (const segment of segments.slice(0, -1)) {
    dirSoFar = path.join(dirSoFar, segment);
    try {
      if (!fs.existsSync(dirSoFar)) {
        if (KNOWN_ORGAN_DIR_NAMES.includes(segment)) return "organ";
        continue;
      }
      const entries = fs.readdirSync(dirSoFar, { withFileTypes: true });
      const hasClaudeMd = entries.some(
        (e) => e.isFile() && e.name === "CLAUDE.md"
      );
      const hasSpecMd = entries.some((e) => e.isFile() && e.name === "SPEC.md");
      const subdirs = entries.filter((e) => e.isDirectory());
      const isLeafDirectory = subdirs.length === 0;
      const hasFractalChildren = subdirs.some((d) => {
        try {
          const childPath = path.join(dirSoFar, d.name);
          const childEntries = fs.readdirSync(childPath, {
            withFileTypes: true
          });
          return childEntries.some(
            (ce) => ce.isFile() && (ce.name === "CLAUDE.md" || ce.name === "SPEC.md")
          );
        } catch {
          return false;
        }
      });
      const category = classifyNode({
        dirName: segment,
        hasClaudeMd,
        hasSpecMd,
        hasFractalChildren,
        isLeafDirectory
      });
      if (category === "organ") return "organ";
    } catch {
      continue;
    }
  }
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
function trackChange(input, queue) {
  if (input.tool_name !== "Write" && input.tool_name !== "Edit") {
    return { continue: true };
  }
  const filePath = input.tool_input.file_path ?? input.tool_input.path ?? "";
  if (!filePath) {
    return { continue: true };
  }
  const cwd = input.cwd;
  const toolName = input.tool_name;
  const changeType = toolName === "Write" ? "created" : "modified";
  queue.enqueue({ filePath, changeType });
  const category = classifyPathCategory(filePath, cwd);
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const entry = {
    timestamp,
    action: toolName,
    path: filePath,
    category,
    sessionId: input.session_id
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
var raw = Buffer.concat(chunks).toString("utf-8");
var result;
try {
  const input = JSON.parse(raw);
  result = trackChange(input, stubQueue);
} catch {
  result = { continue: true };
}
process.stdout.write(JSON.stringify(result));
