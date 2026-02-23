# filid Hooks Reference

filid registers Claude Code hooks that enforce FCA-AI architecture rules automatically at runtime.
Hooks operate at Layer 1 of the 4-layer architecture and fire without user interaction.

## Hook Overview

| Hook Event | Entry File | Purpose |
|---|---|---|
| `PreToolUse` (Write/Edit) | `pre-tool-validator.entry.ts` | CLAUDE.md / SPEC.md content validation |
| `PreToolUse` (Write/Edit) | `structure-guard.entry.ts` | Organ structure protection + circular dependency warning |
| `PreToolUse` (ExitPlanMode) | `plan-gate.entry.ts` | FCA-AI compliance checklist before exiting plan mode |
| `SubagentStart` | `agent-enforcer.entry.ts` | FCA-AI agent role restriction injection |
| `UserPromptSubmit` | `context-injector.entry.ts` | FCA-AI rules injection on session start |
| `SessionEnd` | `session-cleanup.entry.ts` | Session cache and marker file cleanup |

Built entry files live in `libs/` after `yarn build:plugin`.

---

## Hook Details

### 1. PreToolUse — CLAUDE.md / SPEC.md Validator

**Entry**: `src/hooks/entries/pre-tool-validator.entry.ts`
**Built output**: `libs/pre-tool-validator.mjs`

Fires on every `Write` or `Edit` tool call targeting a file path.

**Behavior for `Write` targeting `CLAUDE.md`**:
- Blocks (`continue: false`) if content exceeds 100 lines
- Passes with warning if 3-tier boundary sections are missing (`## Always do`, `## Ask first`, `## Never do`)

**Behavior for `Edit` targeting `CLAUDE.md`**:
- Warns (does not block) when `new_string` exceeds 20 lines, reminding that the 100-line limit cannot be enforced on partial edits

**Behavior for `Write` targeting `SPEC.md`**:
- Blocks if the new content appears to be append-only growth (detected by comparing against the existing file content)

---

### 2. PreToolUse — Structure Guard

**Entry**: `src/hooks/entries/structure-guard.entry.ts`
**Built output**: `libs/structure-guard.mjs`

Fires on every `Write` or `Edit` tool call.

**Behavior — organ CLAUDE.md block**:
- Blocks (`continue: false`) `Write` of `CLAUDE.md` when any parent directory on the path is classified as an `organ` node
- Organ directories are leaf-level compartments; independent documentation is prohibited

**Behavior — organ nesting warning**:
- Warns (`continue: true`) when a file is being created inside a subdirectory of an organ directory
- Organ directories must remain flat; nested subdirectories violate FCA-AI structure rules

**Behavior — circular dependency warning**:
- Warns when the file being written contains `import` statements referencing ancestor module paths
- Detects potential circular dependency by checking if the resolved import path is an ancestor of the current file

---

### 3. SubagentStart — Agent Role Enforcer

**Entry**: `src/hooks/entries/agent-enforcer.entry.ts`
**Built output**: `libs/agent-enforcer.mjs`

Fires when any subagent starts. Injects role-based tool restrictions into the agent's context via `additionalContext`.
Does not block agent startup; restrictions are communicated as instructions.

**Supported FCA-AI agent roles and their restrictions**:

| Agent Type | Restriction |
|---|---|
| `fractal-architect` | Read-only. Cannot use Write or Edit tools. Analysis and planning only. |
| `qa-reviewer` | Read-only. Cannot use Write or Edit tools. Review and report only. |
| `implementer` | Must implement within the scope defined by SPEC.md only. No architectural changes. |
| `context-manager` | Can only edit CLAUDE.md and SPEC.md. Cannot modify business logic or source code. |
| `drift-analyzer` | Read-only. Cannot use Write or Edit tools. Detects drift and produces correction plans only. |
| `restructurer` | Can only execute actions from an approved restructuring plan. No structural decisions. |
| `code-surgeon` | Can only apply approved fix items from fix-requests.md. No architectural changes. |

Unrecognized agent types pass through with no restriction.

---

### 4. PreToolUse (ExitPlanMode) — Plan Gate

**Entry**: `src/hooks/entries/plan-gate.entry.ts`
**Built output**: `libs/plan-gate.mjs`

Fires when `ExitPlanMode` tool is called. Injects an FCA-AI compliance checklist reminder into the agent's context before the plan is finalized.

**Behavior**:
- Passes with `additionalContext` containing FCA-AI plan compliance reminders (CLAUDE.md limits, organ boundaries, 3+12 test rule)
- Never blocks plan mode exit (always `continue: true`)

---

### 5. UserPromptSubmit — FCA-AI Context Injector

**Entry**: `src/hooks/entries/context-injector.entry.ts`
**Built output**: `libs/context-injector.mjs`

Fires on each user prompt submission. Injects FCA-AI rules into Claude's context on the first prompt of each session.

**Session gate**: Uses a session marker file in the cache directory (`~/.filid/cache/`) to ensure injection happens only once per session. Subsequent prompts in the same session return immediately.

**Project detection**: Fires only when the working directory contains `.filid/` or `CLAUDE.md`. Returns `continue: true` silently for non-FCA-AI projects.

**Cache**: Content hash-based invalidation. If the generated context matches the cached version, the cached copy is returned immediately (no regeneration cost).

**Injected content**:
1. Active FCA-AI project path
2. Core FCA-AI rules summary:
   - CLAUDE.md max 100 lines with 3-tier boundary sections
   - SPEC.md no append-only growth
   - Organ directories must not have CLAUDE.md
   - Test files max 15 cases per spec (3 basic + 12 complex)
   - LCOM4 >= 2 triggers module split; CC > 15 triggers compress/abstract
3. All 7 built-in fractal structure rules (from `rule-engine.ts`)
4. FractalNode category classification guide

Never blocks user prompts (always `continue: true`).

---

### 6. SessionEnd — Session Cleanup

**Entry**: `src/hooks/entries/session-cleanup.entry.ts`
**Built output**: `libs/session-cleanup.mjs`

Fires when a Claude Code session ends. Cleans up session-specific cache and marker files.

**Behavior**:
- Deletes the session context marker file (`session-context-<hash>`) from the plugin cache directory
- Deletes the cached context file (`cached-context-<hash>`) if present
- Always returns `continue: true` (SessionEnd hooks cannot block session termination)
- Safe: only removes filid's own cache files, never touches project files

---

## Hook Registration

Hooks are registered via `hooks/hooks.json` in the package root.
Each hook command uses `find-node.sh` to locate the Node.js binary (nvm/fnm 환경 대응),
then executes the built `.mjs` file in `libs/`.

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          { "type": "command", "command": "\"${CLAUDE_PLUGIN_ROOT}/scripts/find-node.sh\" \"${CLAUDE_PLUGIN_ROOT}/libs/pre-tool-validator.mjs\"", "timeout": 3 },
          { "type": "command", "command": "\"${CLAUDE_PLUGIN_ROOT}/scripts/find-node.sh\" \"${CLAUDE_PLUGIN_ROOT}/libs/structure-guard.mjs\"", "timeout": 3 }
        ]
      },
      {
        "matcher": "ExitPlanMode",
        "hooks": [
          { "type": "command", "command": "\"${CLAUDE_PLUGIN_ROOT}/scripts/find-node.sh\" \"${CLAUDE_PLUGIN_ROOT}/libs/plan-gate.mjs\"", "timeout": 3 }
        ]
      }
    ],
    "PostToolUse": [],
    "SubagentStart": [
      {
        "matcher": "*",
        "hooks": [
          { "type": "command", "command": "\"${CLAUDE_PLUGIN_ROOT}/scripts/find-node.sh\" \"${CLAUDE_PLUGIN_ROOT}/libs/agent-enforcer.mjs\"", "timeout": 3 }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "matcher": "*",
        "hooks": [
          { "type": "command", "command": "\"${CLAUDE_PLUGIN_ROOT}/scripts/find-node.sh\" \"${CLAUDE_PLUGIN_ROOT}/libs/context-injector.mjs\"", "timeout": 5 }
        ]
      }
    ],
    "SessionEnd": [
      {
        "matcher": "*",
        "hooks": [
          { "type": "command", "command": "\"${CLAUDE_PLUGIN_ROOT}/scripts/find-node.sh\" \"${CLAUDE_PLUGIN_ROOT}/libs/session-cleanup.mjs\"", "timeout": 3 }
        ]
      }
    ]
  }
}
```

After any hook source change, rebuild with `yarn build:plugin` to regenerate `libs/`.
