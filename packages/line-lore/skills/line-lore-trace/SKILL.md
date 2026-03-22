---
name: line-lore-trace
description: "Trace code lines back to their originating Pull Request and explore PR-issue relationship graphs via the line-lore CLI. Trigger this skill when finding which PR introduced specific lines, investigating code provenance or ownership, reviewing code history, exploring linked issues for a PR, or mapping PR-to-issue relationships. Covers questions like 'which PR added this line?', 'where did this code come from?', 'what issues are linked to this PR?'. Also use during code review, bug investigation, or any task requiring PR context for code lines."
version: 1.0.0
complexity: medium
tags: [git, pr-lookup, code-provenance, blame, issue-graph, code-review]
---

# line-lore-trace

Trace any code line back to the Pull Request that introduced it, and explore PR-issue relationship graphs. Uses a deterministic 4-stage pipeline (Blame, Cosmetic Detection, Ancestry Traversal, PR Lookup).

## Commands at a glance

```bash
# Trace a line to its PR
npx @lumy-pack/line-lore trace <file> -L <line> [--deep] [--output json|llm|human] [-q]

# Explore PR/issue relationship graph
npx @lumy-pack/line-lore graph pr <number> [--depth <n>] [--json]
npx @lumy-pack/line-lore graph issue <number> [--depth <n>] [--json]

# System health check
npx @lumy-pack/line-lore health [--json]

# Cache management
npx @lumy-pack/line-lore cache stats|clear
```

File paths must be relative to the git repository root.

## Output format selection

| Goal | Flag |
|------|------|
| Display to the user | omit `--output` (default: `human`) |
| Parse programmatically | `--output json` or `--json` |
| Feed into another LLM step | `--output llm` |
| PR number only | `-q` |

## Operating levels

line-lore degrades gracefully depending on available tools:

| Level | Requirements | Capabilities |
|-------|-------------|--------------|
| **0** | Git only | Blame + AST diff (no PR lookup) |
| **1** | `gh`/`glab` CLI installed | + PR lookup via message parsing |
| **2** | CLI authenticated | + Full API access, issue graph |

Run `npx @lumy-pack/line-lore health` to check. If the level is below 2, see `references/troubleshooting.md` for setup instructions to guide the user.

## When something goes wrong

Always start with `npx @lumy-pack/line-lore health --json` to diagnose. Then consult `references/troubleshooting.md` for the specific error pattern and guide the user through resolution steps. Do not attempt to fix environment issues silently — inform the user what is missing and how to install or authenticate.

## Resources

| File | When to read |
|------|-------------|
| `references/trace-guide.md` | Detailed trace command options, pipeline stages, and advanced flags |
| `references/graph-guide.md` | Graph command usage, traversal depth, and relationship types |
| `references/output-format.md` | Node types, symbols, confidence levels, and JSON schema |
| `references/troubleshooting.md` | Diagnostic sequence, common errors, and user-facing fix instructions |
| `examples.md` | Concrete workflow recipes for common scenarios |
