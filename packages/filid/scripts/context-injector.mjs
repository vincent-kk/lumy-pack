#!/usr/bin/env node

// src/hooks/context-injector.ts
function injectContext(input2) {
  const cwd = input2.cwd;
  const context = [
    `[FCA-AI] Active in: ${cwd}`,
    "Rules:",
    "- CLAUDE.md: max 100 lines, must include 3-tier boundary sections",
    "- SPEC.md: no append-only growth, must restructure on updates",
    "- Organ directories (components, utils, types, hooks, helpers, lib, styles, assets, constants) must NOT have CLAUDE.md",
    "- Test files: max 15 cases per spec.ts (3 basic + 12 complex)",
    "- LCOM4 >= 2 \u2192 split module, CC > 15 \u2192 compress/abstract"
  ].join("\n");
  return {
    continue: true,
    hookSpecificOutput: {
      additionalContext: context
    }
  };
}

// src/hooks/entries/context-injector.entry.ts
var chunks = [];
for await (const chunk of process.stdin) {
  chunks.push(chunk);
}
var input = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
var result = injectContext(input);
process.stdout.write(JSON.stringify(result));
