---
name: fca-pull-request
user_invocable: true
description: Auto-sync FCA context documents and create a structured GitHub PR from the current branch changes — blocks PR creation when fca-update fails
version: 1.1.0
complexity: medium
---

# fca-pull-request — FCA-Aware Pull Request Generator

Synchronize FCA context documents (CLAUDE.md/SPEC.md) with the latest code,
then analyze branch changes to automatically generate a structured GitHub PR.
The fca-update sync is enforced as a prerequisite — PR creation is blocked on
sync failure unless explicitly skipped.

> **Detail Reference**: See `reference.md` for git command signatures, base
> branch detection algorithm, PR body templates, and error handling details.

## When to Use This Skill

- After completing branch work, before opening a PR
- When FCA context documents and implementation code need synchronized PR delivery
- When a structured PR body (Architecture / Code / Test sections) is required
- To automate repetitive manual PR authoring

### Relationship with Other Skills

- `/filid:fca-update`: Automatically invoked in Stage 1 to sync context documents
- `/filid:fca-review`: Can be chained after PR creation for the code review pipeline
- `/filid:fca-structure-review`: Run separately before PR creation for structural verification

## Core Workflow

### Stage 0 — Prerequisites & Validation

Verify preconditions before PR creation.

1. Confirm git repository
2. Verify current branch (block direct PR from main/master)
3. Check for uncommitted changes
4. Verify `gh` CLI authentication

See [reference.md Section 0](./reference.md#section-0--prerequisites--validation).

### Stage 1 — FCA Context Sync

Invoke `Skill("filid:fca-update")` to synchronize CLAUDE.md/SPEC.md with the
current codebase.

- **Success**: Proceed to Stage 2
- **Failure**: Block PR creation, report failure reason, and exit
- **`--skip-update`**: Skip Stage 1 entirely and proceed directly to Stage 2

See [reference.md Section 1](./reference.md#section-1--fca-context-sync).

### Stage 2 — Base Branch Resolution

Determine the PR base branch.

- **`--base=<ref>`**: Use the specified branch
- **Unspecified**: Run merge-base distance auto-detection algorithm

See [reference.md Section 2](./reference.md#section-2--base-branch-resolution).

### Stage 3 — Change Analysis & PR Body Generation

Analyze the base↔HEAD diff and generate a 4-section structured PR body.

- **Summary**: Core purpose, change scope, affected modules
- **Architecture Changes (FCA Context Diff)**: Context document change analysis
- **Code Changes**: Per-module/file changes with development intent
- **Test Scenarios**: Given-When-Then based scenarios

Existing PR body is fully replaced (manual edits are not preserved).

See [reference.md Section 3](./reference.md#section-3--change-analysis--pr-body-generation).

### Stage 4 — PR Publication

Create or update a GitHub PR with the generated body.

1. Re-verify `gh auth status`
2. Check for existing PR → update or create new
3. `git push -u origin <branch>` (if needed)
4. Execute `gh pr create` or `gh pr edit`

See [reference.md Section 4](./reference.md#section-4--pr-publication).

## Available MCP Tools

None — this skill uses only Bash commands (git, gh) and the Skill tool.
Stage 1 delegates to `/filid:fca-update`, which internally uses `cache_manage`,
`fractal_scan`, `test_metrics`, etc.

## Options

> Options are LLM-interpreted hints, not strict CLI flags. Natural language
> works equally well (e.g., "create a PR against main" instead of `--base=main`).

```
/filid:fca-pull-request [--base=<ref>] [--skip-update] [--draft] [--title=<title>]
```

| Option          | Type   | Default | Description                                                       |
| --------------- | ------ | ------- | ----------------------------------------------------------------- |
| `--base`        | string | auto    | PR base branch (auto-detected when unspecified)                   |
| `--skip-update` | flag   | off     | Skip Stage 1 (fca-update)                                         |
| `--draft`       | flag   | off     | Create as draft PR                                                |
| `--title`       | string | auto    | Explicit PR title (auto-generated when unspecified, max 70 chars) |

## Quick Reference

```bash
# Default execution (auto base, fca-update included)
/filid:fca-pull-request

# Target main branch
/filid:fca-pull-request --base=main

# Skip fca-update (already ran manually)
/filid:fca-pull-request --skip-update

# Create as draft PR
/filid:fca-pull-request --draft

# Explicit title
/filid:fca-pull-request --title="feat(filid): add fca-pull-request skill"
```

```
Stages:   Prerequisites → FCA Sync → Base Resolution → Change Analysis → PR Publication
Agents:   (Stage 1 delegates to fca-update internal agents)
Output:   GitHub PR URL
Language: PR body in Korean (tech terms / code identifiers kept as-is)
```

Key rules:

- fca-update failure blocks PR creation (`--skip-update` to bypass)
- Existing PR body is fully replaced after user confirmation
- If `gh` auth fails, PR body is saved locally to `.filid/pr-draft/<branch>.md`
- PR body written in Korean; technical terms and code identifiers remain in original form
- File-level detail for ≤30 changed files; directory-level summary for >30 files
