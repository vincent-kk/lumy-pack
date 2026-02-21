#!/usr/bin/env node

// src/core/organ-classifier.ts
var ORGAN_DIR_NAMES = [
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
  return ORGAN_DIR_NAMES.includes(dirName);
}

// src/hooks/organ-guard.ts
function getParentSegments(filePath) {
  const normalized = filePath.replace(/\\/g, "/");
  const parts = normalized.split("/").filter((p) => p.length > 0);
  return parts.slice(0, -1);
}
function isClaudeMd(filePath) {
  return filePath.endsWith("/CLAUDE.md") || filePath === "CLAUDE.md";
}
function guardOrganWrite(input2) {
  if (input2.tool_name !== "Write") {
    return { continue: true };
  }
  const filePath = input2.tool_input.file_path ?? input2.tool_input.path ?? "";
  if (!isClaudeMd(filePath)) {
    return { continue: true };
  }
  const segments = getParentSegments(filePath);
  for (const segment of segments) {
    if (isOrganDirectory(segment)) {
      return {
        continue: false,
        hookSpecificOutput: {
          additionalContext: `BLOCKED: Cannot create CLAUDE.md inside organ directory "${segment}". Organ directories are leaf-level compartments and should not have their own CLAUDE.md.`
        }
      };
    }
  }
  return { continue: true };
}

// src/hooks/entries/organ-guard.entry.ts
var chunks = [];
for await (const chunk of process.stdin) {
  chunks.push(chunk);
}
var input = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
var result = guardOrganWrite(input);
process.stdout.write(JSON.stringify(result));
