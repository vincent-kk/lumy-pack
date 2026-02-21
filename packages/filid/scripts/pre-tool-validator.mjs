#!/usr/bin/env node

// src/core/document-validator.ts
var CLAUDE_MD_LINE_LIMIT = 100;
var BOUNDARY_KEYWORDS = {
  alwaysDo: /^###?\s*(always\s*do)/im,
  askFirst: /^###?\s*(ask\s*first)/im,
  neverDo: /^###?\s*(never\s*do)/im
};
function countLines(content) {
  if (content.length === 0) return 0;
  const trimmed = content.endsWith("\n") ? content.slice(0, -1) : content;
  if (trimmed.length === 0) return 0;
  return trimmed.split("\n").length;
}
function validateClaudeMd(content) {
  const violations = [];
  const lines = countLines(content);
  if (lines > CLAUDE_MD_LINE_LIMIT) {
    violations.push({
      rule: "line-limit",
      message: `CLAUDE.md exceeds ${CLAUDE_MD_LINE_LIMIT}-line limit (${lines} lines). Compress or deduplicate content.`,
      severity: "error"
    });
  }
  const hasAlwaysDo = BOUNDARY_KEYWORDS.alwaysDo.test(content);
  const hasAskFirst = BOUNDARY_KEYWORDS.askFirst.test(content);
  const hasNeverDo = BOUNDARY_KEYWORDS.neverDo.test(content);
  if (!hasAlwaysDo || !hasAskFirst || !hasNeverDo) {
    const missing = [];
    if (!hasAlwaysDo) missing.push("Always do");
    if (!hasAskFirst) missing.push("Ask first");
    if (!hasNeverDo) missing.push("Never do");
    violations.push({
      rule: "missing-boundaries",
      message: `CLAUDE.md is missing 3-tier boundary sections: ${missing.join(", ")}`,
      severity: "warning"
    });
  }
  return {
    valid: violations.every((v) => v.severity !== "error"),
    violations
  };
}
function detectAppendOnly(oldContent, newContent) {
  if (oldContent.length === 0) return false;
  const oldLines = oldContent.trimEnd().split("\n");
  const newLines = newContent.trimEnd().split("\n");
  if (newLines.length <= oldLines.length) return false;
  for (let i = 0; i < oldLines.length; i++) {
    if (oldLines[i] !== newLines[i]) return false;
  }
  return true;
}
function validateSpecMd(content, oldContent) {
  const violations = [];
  if (oldContent !== void 0 && detectAppendOnly(oldContent, content)) {
    violations.push({
      rule: "append-only",
      message: "SPEC.md must not be append-only. Restructure and compress content instead of simply appending.",
      severity: "error"
    });
  }
  return {
    valid: violations.every((v) => v.severity !== "error"),
    violations
  };
}

// src/hooks/pre-tool-validator.ts
function isClaudeMd(filePath) {
  return filePath.endsWith("/CLAUDE.md") || filePath === "CLAUDE.md";
}
function isSpecMd(filePath) {
  return filePath.endsWith("/SPEC.md") || filePath === "SPEC.md";
}
function validatePreToolUse(input2, oldSpecContent) {
  const filePath = input2.tool_input.file_path ?? input2.tool_input.path ?? "";
  const content = input2.tool_input.content;
  if (input2.tool_name !== "Write" || !content) {
    return { continue: true };
  }
  if (isClaudeMd(filePath)) {
    const result2 = validateClaudeMd(content);
    if (!result2.valid) {
      const errorMessages = result2.violations.filter((v) => v.severity === "error").map((v) => v.message).join("; ");
      return {
        continue: false,
        hookSpecificOutput: {
          additionalContext: `BLOCKED: ${errorMessages}`
        }
      };
    }
    const warnings = result2.violations.filter((v) => v.severity === "warning");
    if (warnings.length > 0) {
      return {
        continue: true,
        hookSpecificOutput: {
          additionalContext: warnings.map((w) => w.message).join("; ")
        }
      };
    }
    return { continue: true };
  }
  if (isSpecMd(filePath) && oldSpecContent !== void 0) {
    const result2 = validateSpecMd(content, oldSpecContent);
    if (!result2.valid) {
      const errorMessages = result2.violations.filter((v) => v.severity === "error").map((v) => v.message).join("; ");
      return {
        continue: false,
        hookSpecificOutput: {
          additionalContext: `BLOCKED: ${errorMessages}`
        }
      };
    }
  }
  return { continue: true };
}

// src/hooks/entries/pre-tool-validator.entry.ts
var chunks = [];
for await (const chunk of process.stdin) {
  chunks.push(chunk);
}
var input = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
var result = validatePreToolUse(input);
process.stdout.write(JSON.stringify(result));
