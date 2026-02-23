---
name: fca-ast-fallback
user_invocable: true
description: AST pattern search/replace fallback using LLM when ast-grep is unavailable.
version: 1.0.0
complexity: low
---

# fca-ast-fallback — AST Pattern Matching Fallback

Provide best-effort AST pattern search and replace using LLM capabilities
with Read, Glob, Grep, and Edit tools when `@ast-grep/napi` is unavailable.

> **Detail Reference**: For language-to-extension mappings, meta-variable
> conversion rules, and exact MCP error detection strings, read the
> `reference.md` file in this skill's directory (same location as this SKILL.md).

## When to Use This Skill

- `ast_grep_search` or `ast_grep_replace` MCP tools return `@ast-grep/napi is not available`
- The environment cannot install native dependencies (sandboxed, CI, etc.)
- Quick one-off pattern searches where exact AST precision is not critical
- Searching across multiple languages in a single pass

> **Note**: This is a fallback. For production use, install ast-grep:
> `npm install -g @ast-grep/napi`

## Core Workflow

### Phase 1 — Attempt Native Tool

Call `ast_grep_search` (or `ast_grep_replace`) MCP tool with the user's
pattern. If it succeeds, return the result directly. No fallback needed.
See [reference.md Section 1](./reference.md#section-1--native-tool-attempt).

### Phase 2 — Detect Unavailability

If the MCP response contains the error string, switch to fallback mode
and inform the user.
See [reference.md Section 2](./reference.md#section-2--unavailability-detection).

### Phase 3 — LLM Search Fallback

Convert AST meta-variables to regex approximations, find matching files
by language extension, search with Grep, then filter false positives
using LLM code understanding.
See [reference.md Section 3](./reference.md#section-3--llm-search-fallback).

### Phase 4 — LLM Replace Fallback

Perform search (Phase 3), show dry-run preview of proposed changes,
ask for user confirmation, then apply via Edit tool.
See [reference.md Section 4](./reference.md#section-4--llm-replace-fallback).

## Available MCP Tools

| Tool               | Purpose                                      | Fallback          |
| ------------------ | -------------------------------------------- | ----------------- |
| `ast_grep_search`  | Native AST pattern search (Phase 1 attempt)  | Grep + Read + LLM |
| `ast_grep_replace` | Native AST pattern replace (Phase 1 attempt) | Edit + LLM        |

## Options

> Options are LLM-interpreted hints, not strict CLI flags. Natural language works equally well.

```
/filid:fca-ast-fallback <pattern> [--language <lang>] [--path <dir>] [--replace <replacement>]
```

| Parameter    | Type   | Default    | Description                                      |
| ------------ | ------ | ---------- | ------------------------------------------------ |
| `pattern`    | string | required   | AST-like pattern (e.g., `console.log($MSG)`)     |
| `--language` | string | typescript | Target language (17 supported, see reference.md) |
| `--path`     | string | .          | Search directory                                 |
| `--replace`  | string | —          | Replacement pattern (enables replace mode)       |

## Quick Reference

```bash
# Search for all console.log calls
/filid:fca-ast-fallback "console.log($MSG)"

# Search in specific directory for Python
/filid:fca-ast-fallback "def $NAME($$$ARGS)" --language python --path src/

# Replace var with const
/filid:fca-ast-fallback "var $NAME = $VALUE" --replace "const $NAME = $VALUE"

# Supported meta-variables (regex approximation)
$NAME       → single identifier/expression  ([\w.]+)
$VALUE      → single value expression       ([\w.]+)
$$$ARGS     → multiple items/arguments       ([\s\S]*?)

# 17 supported languages
javascript typescript tsx python ruby go rust java
kotlin swift c cpp csharp html css json yaml
```
