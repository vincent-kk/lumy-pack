#!/usr/bin/env node

// src/hooks/context-injector.ts
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync
} from "node:fs";
import { join } from "node:path";

// src/types/rules.ts
var BUILTIN_RULE_IDS = {
  NAMING_CONVENTION: "naming-convention",
  ORGAN_NO_CLAUDEMD: "organ-no-claudemd",
  INDEX_BARREL_PATTERN: "index-barrel-pattern",
  MODULE_ENTRY_POINT: "module-entry-point",
  MAX_DEPTH: "max-depth",
  CIRCULAR_DEPENDENCY: "circular-dependency",
  PURE_FUNCTION_ISOLATION: "pure-function-isolation"
};

// src/types/scan.ts
var DEFAULT_SCAN_OPTIONS = {
  include: ["**"],
  exclude: [
    "**/node_modules/**",
    "**/.git/**",
    "**/dist/**",
    "**/build/**",
    "**/coverage/**",
    "**/docs/**",
    "**/scripts/**",
    "**/.filid/**",
    "**/.claude/**",
    "**/.omc/**",
    "**/.metadata/**",
    "**/next/**",
    "**/libs/**"
  ],
  maxDepth: 10,
  followSymlinks: false
};

// src/core/rule-engine.ts
var KEBAB_CASE_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
var CAMEL_CASE_RE = /^[a-z][a-zA-Z0-9]*$/;
function isValidNaming(name) {
  return KEBAB_CASE_RE.test(name) || CAMEL_CASE_RE.test(name);
}
function loadBuiltinRules() {
  return [
    // 1. naming-convention: 디렉토리명이 kebab-case 또는 camelCase여야 한다
    {
      id: BUILTIN_RULE_IDS.NAMING_CONVENTION,
      name: "Naming Convention",
      description: "\uB514\uB809\uD1A0\uB9AC/\uD30C\uC77C\uBA85\uC774 kebab-case \uB610\uB294 camelCase\uB97C \uB530\uB77C\uC57C \uD55C\uB2E4.",
      category: "naming",
      severity: "warning",
      enabled: true,
      check(context) {
        const { node } = context;
        if (!isValidNaming(node.name)) {
          return [
            {
              ruleId: BUILTIN_RULE_IDS.NAMING_CONVENTION,
              severity: "warning",
              message: `\uB514\uB809\uD1A0\uB9AC\uBA85 "${node.name}"\uC774 kebab-case \uB610\uB294 camelCase \uADDC\uCE59\uC744 \uB530\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.`,
              path: node.path,
              suggestion: `"${node.name}"\uC744 kebab-case(\uC608: my-module) \uB610\uB294 camelCase(\uC608: myModule)\uB85C \uBCC0\uACBD\uD558\uC138\uC694.`
            }
          ];
        }
        return [];
      }
    },
    // 2. organ-no-claudemd: organ 노드에 CLAUDE.md가 없어야 한다
    {
      id: BUILTIN_RULE_IDS.ORGAN_NO_CLAUDEMD,
      name: "Organ No CLAUDE.md",
      description: "organ \uB178\uB4DC\uC5D0 CLAUDE.md\uAC00 \uC874\uC7AC\uD558\uBA74 \uC548 \uB41C\uB2E4.",
      category: "structure",
      severity: "error",
      enabled: true,
      check(context) {
        const { node } = context;
        if (node.type === "organ" && node.hasClaudeMd) {
          return [
            {
              ruleId: BUILTIN_RULE_IDS.ORGAN_NO_CLAUDEMD,
              severity: "error",
              message: `organ \uB514\uB809\uD1A0\uB9AC "${node.name}"\uC5D0 CLAUDE.md\uAC00 \uC874\uC7AC\uD569\uB2C8\uB2E4. organ\uC740 \uB3C5\uB9BD \uBB38\uC11C\uD654\uAC00 \uAE08\uC9C0\uB429\uB2C8\uB2E4.`,
              path: node.path,
              suggestion: "CLAUDE.md\uB97C \uC81C\uAC70\uD558\uAC70\uB098 \uD574\uB2F9 \uB514\uB809\uD1A0\uB9AC\uB97C fractal\uB85C \uC7AC\uBD84\uB958\uD558\uC138\uC694."
            }
          ];
        }
        return [];
      }
    },
    // 3. index-barrel-pattern: fractal 노드의 index.ts가 순수 barrel이어야 한다
    {
      id: BUILTIN_RULE_IDS.INDEX_BARREL_PATTERN,
      name: "Index Barrel Pattern",
      description: "fractal \uB178\uB4DC\uC758 index.ts\uB294 \uC21C\uC218 barrel(re-export\uB9CC) \uD328\uD134\uC744 \uB530\uB77C\uC57C \uD55C\uB2E4.",
      category: "index",
      severity: "warning",
      enabled: true,
      check(context) {
        const { node } = context;
        if (node.type !== "fractal" && node.type !== "hybrid") return [];
        if (!node.hasIndex) return [];
        const barrelPattern = node.metadata["barrelPattern"];
        if (barrelPattern && !barrelPattern.isPureBarrel && barrelPattern.declarationCount > 0) {
          return [
            {
              ruleId: BUILTIN_RULE_IDS.INDEX_BARREL_PATTERN,
              severity: "warning",
              message: `"${node.name}/index.ts"\uC5D0 ${barrelPattern.declarationCount}\uAC1C\uC758 \uC9C1\uC811 \uC120\uC5B8\uC774 \uC788\uC2B5\uB2C8\uB2E4. \uC21C\uC218 barrel \uD328\uD134\uC744 \uB530\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.`,
              path: node.path,
              suggestion: "\uC9C1\uC811 \uC120\uC5B8\uC744 \uBCC4\uB3C4 \uD30C\uC77C\uB85C \uBD84\uB9AC\uD558\uACE0 index.ts\uC5D0\uC11C re-export\uD558\uC138\uC694."
            }
          ];
        }
        return [];
      }
    },
    // 4. module-entry-point: 모든 fractal 노드에 index.ts 또는 main.ts가 있어야 한다
    {
      id: BUILTIN_RULE_IDS.MODULE_ENTRY_POINT,
      name: "Module Entry Point",
      description: "\uBAA8\uB4E0 fractal \uB178\uB4DC\uC5D0 index.ts \uB610\uB294 main.ts\uAC00 \uC874\uC7AC\uD574\uC57C \uD55C\uB2E4.",
      category: "module",
      severity: "warning",
      enabled: true,
      check(context) {
        const { node } = context;
        if (node.type !== "fractal" && node.type !== "hybrid") return [];
        if (!node.hasIndex && !node.hasMain) {
          return [
            {
              ruleId: BUILTIN_RULE_IDS.MODULE_ENTRY_POINT,
              severity: "warning",
              message: `fractal \uBAA8\uB4C8 "${node.name}"\uC5D0 \uC9C4\uC785\uC810(index.ts \uB610\uB294 main.ts)\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.`,
              path: node.path,
              suggestion: "index.ts \uB610\uB294 main.ts\uB97C \uC0DD\uC131\uD558\uC5EC \uBAA8\uB4C8\uC758 \uACF5\uAC1C API\uB97C \uC815\uC758\uD558\uC138\uC694."
            }
          ];
        }
        return [];
      }
    },
    // 5. max-depth: 트리 깊이가 maxDepth를 초과하면 안 된다
    {
      id: BUILTIN_RULE_IDS.MAX_DEPTH,
      name: "Max Depth",
      description: "\uD504\uB799\uD0C8 \uD2B8\uB9AC\uC758 \uAE4A\uC774\uAC00 \uCD5C\uB300 \uD5C8\uC6A9 \uAE4A\uC774\uB97C \uCD08\uACFC\uD558\uBA74 \uC548 \uB41C\uB2E4.",
      category: "structure",
      severity: "error",
      enabled: true,
      check(context) {
        const { node, scanOptions } = context;
        const maxDepth = scanOptions?.maxDepth ?? DEFAULT_SCAN_OPTIONS.maxDepth;
        if (node.depth > maxDepth) {
          return [
            {
              ruleId: BUILTIN_RULE_IDS.MAX_DEPTH,
              severity: "error",
              message: `"${node.name}"\uC758 \uAE4A\uC774(${node.depth})\uAC00 \uCD5C\uB300 \uD5C8\uC6A9 \uAE4A\uC774(${maxDepth})\uB97C \uCD08\uACFC\uD569\uB2C8\uB2E4.`,
              path: node.path,
              suggestion: "\uB514\uB809\uD1A0\uB9AC \uAD6C\uC870\uB97C \uD3C9\uD0C4\uD654\uD558\uAC70\uB098 \uAD00\uB828 \uBAA8\uB4C8\uC744 \uBCD1\uD569\uD558\uC138\uC694."
            }
          ];
        }
        return [];
      }
    },
    // 6. circular-dependency: 순환 의존 감지 (placeholder - 빈 배열 반환)
    {
      id: BUILTIN_RULE_IDS.CIRCULAR_DEPENDENCY,
      name: "Circular Dependency",
      description: "\uBAA8\uB4C8 \uAC04 \uC21C\uD658 \uC758\uC874\uC774 \uC5C6\uC5B4\uC57C \uD55C\uB2E4.",
      category: "dependency",
      severity: "error",
      enabled: true,
      check(_context) {
        return [];
      }
    },
    // 7. pure-function-isolation: pure-function 노드는 부작용이 없어야 한다
    {
      id: BUILTIN_RULE_IDS.PURE_FUNCTION_ISOLATION,
      name: "Pure Function Isolation",
      description: "pure-function \uB178\uB4DC\uB294 \uC0C1\uC704 fractal \uBAA8\uB4C8\uC744 import\uD558\uBA74 \uC548 \uB41C\uB2E4.",
      category: "dependency",
      severity: "error",
      enabled: true,
      check(context) {
        const { node, tree } = context;
        if (node.type !== "pure-function") return [];
        const deps = node.metadata["dependencies"];
        if (!deps || deps.length === 0) return [];
        const violations = [];
        for (const dep of deps) {
          const depNode = tree.nodes.get(dep);
          if (depNode && (depNode.type === "fractal" || depNode.type === "hybrid")) {
            violations.push({
              ruleId: BUILTIN_RULE_IDS.PURE_FUNCTION_ISOLATION,
              severity: "error",
              message: `pure-function \uB178\uB4DC "${node.name}"\uC774 fractal \uBAA8\uB4C8 "${depNode.name}"\uC744 \uC758\uC874\uD569\uB2C8\uB2E4.`,
              path: node.path,
              suggestion: `"${depNode.name}"\uC758 \uD558\uC704 organ\uC73C\uB85C \uC774\uB3D9\uD558\uAC70\uB098 \uC758\uC874\uC744 \uC81C\uAC70\uD558\uC138\uC694.`
            });
          }
        }
        return violations;
      }
    }
  ];
}
function getActiveRules(rules) {
  return rules.filter((r) => r.enabled);
}

// src/hooks/context-injector.ts
var CACHE_TTL_MS = 3e5;
function cwdHash(cwd) {
  return createHash("sha256").update(cwd).digest("hex").slice(0, 12);
}
function getCacheDir(cwd) {
  return join(cwd, ".filid");
}
function readCachedContext(cwd) {
  const hash = cwdHash(cwd);
  const cacheDir = getCacheDir(cwd);
  const stampFile = join(cacheDir, `last-scan-${hash}`);
  const contextFile = join(cacheDir, `cached-context-${hash}.txt`);
  try {
    if (!existsSync(stampFile) || !existsSync(contextFile)) return null;
    const mtime = statSync(stampFile).mtimeMs;
    if (Date.now() - mtime > CACHE_TTL_MS) return null;
    return readFileSync(contextFile, "utf-8");
  } catch {
    return null;
  }
}
function writeCachedContext(cwd, context) {
  const hash = cwdHash(cwd);
  const cacheDir = getCacheDir(cwd);
  const stampFile = join(cacheDir, `last-scan-${hash}`);
  const contextFile = join(cacheDir, `cached-context-${hash}.txt`);
  try {
    if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true });
    writeFileSync(contextFile, context, "utf-8");
    writeFileSync(stampFile, String(Date.now()), "utf-8");
  } catch {
  }
}
var CATEGORY_GUIDE = [
  "- fractal: CLAUDE.md \uB610\uB294 SPEC.md\uAC00 \uC788\uB294 \uB3C5\uB9BD \uBAA8\uB4C8",
  "- organ: \uD504\uB799\uD0C8 \uC790\uC2DD\uC774 \uC5C6\uB294 \uB9AC\uD504 \uB514\uB809\uD1A0\uB9AC",
  "- pure-function: \uBD80\uC791\uC6A9 \uC5C6\uB294 \uC21C\uC218 \uD568\uC218 \uBAA8\uC74C",
  "- hybrid: fractal + organ \uD2B9\uC131\uC744 \uB3D9\uC2DC\uC5D0 \uAC00\uC9C0\uB294 \uACFC\uB3C4\uAE30\uC801 \uB178\uB4DC"
].join("\n");
function isFcaProject(cwd) {
  return existsSync(join(cwd, ".filid")) || existsSync(join(cwd, "CLAUDE.md"));
}
function buildFcaContext(cwd) {
  return [
    `[FCA-AI] Active in: ${cwd}`,
    "Rules:",
    "- CLAUDE.md: max 100 lines, must include 3-tier boundary sections",
    "- SPEC.md: no append-only growth, must restructure on updates",
    "- Organ directories (\uAD6C\uC870 \uBD84\uC11D \uAE30\uBC18 \uC790\uB3D9 \uBD84\uB958) must NOT have CLAUDE.md",
    "- Test files: max 15 cases per spec.ts (3 basic + 12 complex)",
    "- LCOM4 >= 2 \u2192 split module, CC > 15 \u2192 compress/abstract"
  ].join("\n");
}
async function injectContext(input2) {
  const cwd = input2.cwd;
  if (!isFcaProject(cwd)) {
    return { continue: true };
  }
  const cached = readCachedContext(cwd);
  if (cached) {
    return {
      continue: true,
      hookSpecificOutput: { additionalContext: cached }
    };
  }
  const fcaContext = buildFcaContext(cwd);
  let fractalSection = "";
  try {
    const rules = getActiveRules(loadBuiltinRules());
    const rulesText = rules.map((r) => `- ${r.id}: ${r.description}`).join("\n");
    fractalSection = [
      "",
      "[filid] Fractal Structure Rules:",
      rulesText,
      "",
      "Category Classification:",
      CATEGORY_GUIDE
    ].join("\n");
  } catch {
  }
  const additionalContext = (fcaContext + fractalSection).trim();
  writeCachedContext(cwd, additionalContext);
  return {
    continue: true,
    hookSpecificOutput: {
      additionalContext
    }
  };
}

// src/hooks/entries/context-injector.entry.ts
var chunks = [];
for await (const chunk of process.stdin) {
  chunks.push(chunk);
}
var input = JSON.parse(
  Buffer.concat(chunks).toString("utf-8")
);
var result;
try {
  result = await injectContext(input);
} catch {
  result = { continue: true };
}
process.stdout.write(JSON.stringify(result));
