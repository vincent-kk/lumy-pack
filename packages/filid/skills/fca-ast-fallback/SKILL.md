---
name: fca-ast-fallback
user_invocable: true
description: AST pattern search/replace fallback using LLM when ast-grep is unavailable
version: 1.0.0
complexity: low
---

# fca-ast-fallback — AST Pattern Matching Fallback

When `@ast-grep/napi` is not installed, this skill provides a best-effort
AST pattern search and replace using LLM capabilities with Read and Grep tools.

> **Note**: This is a fallback for environments where ast-grep cannot be installed.
> For production use, install ast-grep: `npm install -g @ast-grep/napi`

## When to Use This Skill

- `ast_grep_search` or `ast_grep_replace` MCP tools return "@ast-grep/napi is not available"
- You need basic AST pattern matching but cannot install native dependencies
- Quick one-off pattern searches where exact AST precision isn't critical

## Core Workflow

### Step 1 — Attempt Native Tool

First, try calling `ast_grep_search` MCP tool with the user's pattern. If it succeeds,
return the result directly. No fallback needed.

### Step 2 — Detect Unavailability

If the response contains "@ast-grep/napi is not available", switch to LLM fallback mode.
Inform the user:

```
[INFO] ast-grep is not installed. Using LLM-based pattern matching fallback.
Results may be less precise than ast-grep. For better accuracy: npm install -g @ast-grep/napi
```

### Step 3 — LLM Search Fallback

For **search** requests:

1. Use `Glob` tool to find files matching the target language extensions:
   - TypeScript: `**/*.ts`, `**/*.tsx`
   - JavaScript: `**/*.js`, `**/*.jsx`, `**/*.mjs`
   - Python: `**/*.py`
   - (Other languages similarly)
2. Exclude: `node_modules/`, `dist/`, `build/`, `.git/`
3. Use `Grep` tool with a regex approximation of the AST pattern:
   - Convert meta-variables (`$NAME`, `$$$ARGS`) to regex wildcards
   - `$NAME` → `[\w.]+` (single identifier/expression)
   - `$$$ARGS` → `[\s\S]*?` (multiple items)
4. Read matching files with `Read` tool for context
5. Analyze the code structure using LLM understanding to filter false positives
6. Format results as:
   ```
   file/path.ts:42
   >   42: matched code line
       43: context line after
   ```

### Step 4 — LLM Replace Fallback

For **replace** requests:

1. Perform search (Step 3) to find all matches
2. Show a **dry-run preview** of proposed changes:
   ```
   file/path.ts:42
     - old code
     + new code
   ```
3. Ask for user confirmation before applying
4. Use `Edit` tool to apply changes one by one
5. Report summary: N replacements in M files

## Limitations

- **Accuracy**: LLM pattern matching is approximate. Complex AST patterns (nested structures,
  type-aware matching) may produce false positives or miss matches.
- **Scale**: Works best for small-to-medium codebases. For large projects (>1000 files),
  install `@ast-grep/napi` for performance.
- **Meta-variables**: Only `$NAME` and `$$$ARGS` are approximated. Advanced ast-grep features
  (rules, constraints, fix patterns) are not supported.

## Options

```
/filid:fca-ast-fallback <pattern> [--language <lang>] [--path <dir>] [--replace <replacement>]
```

| Parameter | Type   | Default | Description |
|-----------|--------|---------|-------------|
| pattern   | string | required | AST-like pattern (e.g., `console.log($MSG)`) |
| --language | string | typescript | Target language |
| --path | string | . | Search directory |
| --replace | string | — | Replacement pattern (enables replace mode) |

## Quick Reference

```bash
# Search for all console.log calls
/filid:fca-ast-fallback "console.log($MSG)"

# Search in specific directory
/filid:fca-ast-fallback "function $NAME($$$ARGS)" --path src/

# Replace var with const
/filid:fca-ast-fallback "var $NAME = $VALUE" --replace "const $NAME = $VALUE"
```
