#!/usr/bin/env node

// src/hooks/structure-guard.ts
import { existsSync, readdirSync } from "node:fs";
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
function classifyNode(input2) {
  if (input2.hasClaudeMd) return "fractal";
  if (input2.hasSpecMd) return "fractal";
  if (!input2.hasFractalChildren && input2.isLeafDirectory) return "organ";
  const hasSideEffects = input2.hasSideEffects ?? true;
  if (!hasSideEffects) return "pure-function";
  return "fractal";
}

// src/hooks/structure-guard.ts
function isOrganByStructure(dirPath) {
  try {
    if (!existsSync(dirPath)) {
      return LEGACY_ORGAN_DIR_NAMES.includes(path.basename(dirPath));
    }
    const entries = readdirSync(dirPath, { withFileTypes: true });
    const hasClaudeMd = entries.some((e) => e.isFile() && e.name === "CLAUDE.md");
    const hasSpecMd = entries.some((e) => e.isFile() && e.name === "SPEC.md");
    const subdirs = entries.filter((e) => e.isDirectory());
    const hasFractalChildren = subdirs.some((d) => {
      const childPath = path.join(dirPath, d.name);
      try {
        const childEntries = readdirSync(childPath, { withFileTypes: true });
        return childEntries.some(
          (ce) => ce.isFile() && (ce.name === "CLAUDE.md" || ce.name === "SPEC.md")
        );
      } catch {
        return false;
      }
    });
    const isLeafDirectory = subdirs.length === 0;
    const category = classifyNode({
      dirName: path.basename(dirPath),
      hasClaudeMd,
      hasSpecMd,
      hasFractalChildren,
      isLeafDirectory
    });
    return category === "organ";
  } catch {
    return false;
  }
}
function getParentSegments(filePath) {
  const normalized = filePath.replace(/\\/g, "/");
  const parts = normalized.split("/").filter((p) => p.length > 0);
  return parts.slice(0, -1);
}
function isClaudeMd(filePath) {
  return filePath.endsWith("/CLAUDE.md") || filePath === "CLAUDE.md";
}
function extractImportPaths(content) {
  const importRegex = /from\s+['"]([^'"]+)['"]/g;
  const paths = [];
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    paths.push(match[1]);
  }
  return paths;
}
function isAncestorPath(filePath, importPath, cwd) {
  if (!importPath.startsWith(".")) return false;
  const fileDir = path.dirname(path.resolve(cwd, filePath));
  const resolvedImport = path.resolve(fileDir, importPath);
  const fileAbsolute = path.resolve(cwd, filePath);
  return fileAbsolute.startsWith(resolvedImport + path.sep);
}
function guardStructure(input2) {
  if (input2.tool_name !== "Write" && input2.tool_name !== "Edit") {
    return { continue: true };
  }
  const filePath = input2.tool_input.file_path ?? input2.tool_input.path ?? "";
  if (!filePath) {
    return { continue: true };
  }
  const cwd = input2.cwd;
  const segments = getParentSegments(filePath);
  if (input2.tool_name === "Write" && isClaudeMd(filePath)) {
    let dirSoFar = cwd;
    for (const segment of segments) {
      dirSoFar = path.join(dirSoFar, segment);
      if (isOrganByStructure(dirSoFar)) {
        return {
          continue: false,
          hookSpecificOutput: {
            additionalContext: `BLOCKED: Cannot create CLAUDE.md inside organ directory "${segment}". Organ directories are leaf-level compartments and should not have their own CLAUDE.md.`
          }
        };
      }
    }
  }
  const warnings = [];
  let organIdx = -1;
  let organSegment = "";
  {
    let dirSoFar = cwd;
    for (let i = 0; i < segments.length; i++) {
      dirSoFar = path.join(dirSoFar, segments[i]);
      if (isOrganByStructure(dirSoFar)) {
        organIdx = i;
        organSegment = segments[i];
        break;
      }
    }
  }
  if (organIdx !== -1 && organIdx < segments.length - 1) {
    warnings.push(
      `organ \uB514\uB809\uD1A0\uB9AC "${organSegment}" \uB0B4\uBD80\uC5D0 \uD558\uC704 \uB514\uB809\uD1A0\uB9AC\uB97C \uC0DD\uC131\uD558\uB824 \uD569\uB2C8\uB2E4. Organ \uB514\uB809\uD1A0\uB9AC\uB294 flat leaf \uAD6C\uD68D\uC73C\uB85C \uC911\uCCA9 \uB514\uB809\uD1A0\uB9AC\uB97C \uAC00\uC838\uC11C\uB294 \uC548 \uB429\uB2C8\uB2E4.`
    );
  }
  const content = input2.tool_input.content ?? input2.tool_input.new_string ?? "";
  if (content) {
    const importPaths = extractImportPaths(content);
    const circularCandidates = importPaths.filter((p) => isAncestorPath(filePath, p, cwd));
    if (circularCandidates.length > 0) {
      warnings.push(
        `\uB2E4\uC74C import\uAC00 \uD604\uC7AC \uD30C\uC77C\uC758 \uC870\uC0C1 \uBAA8\uB4C8\uC744 \uCC38\uC870\uD569\uB2C8\uB2E4 (\uC21C\uD658 \uC758\uC874 \uC704\uD5D8): ` + circularCandidates.map((p) => `"${p}"`).join(", ")
      );
    }
  }
  if (warnings.length === 0) {
    return { continue: true };
  }
  const additionalContext = `\u26A0\uFE0F Warning from filid structure-guard:
` + warnings.map((w, i) => `${i + 1}. ${w}`).join("\n");
  return {
    continue: true,
    hookSpecificOutput: { additionalContext }
  };
}

// src/hooks/entries/structure-guard.entry.ts
var chunks = [];
for await (const chunk of process.stdin) {
  chunks.push(chunk);
}
var input = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
var result;
try {
  result = guardStructure(input);
} catch {
  result = { continue: true };
}
process.stdout.write(JSON.stringify(result));
