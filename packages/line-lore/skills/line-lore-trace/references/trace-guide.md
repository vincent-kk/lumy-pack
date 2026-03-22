# Trace Command Reference

## Synopsis

```bash
npx @lumy-pack/line-lore trace <file> -L <line-or-range> [options]
```

## Options

| Option | Description |
|--------|-------------|
| `-L, --line <range>` | Line number or range (e.g., `42` or `10,50`). **Required.** |
| `--deep` | Enable deep tracing — follows squash-merged PRs by scanning patch-ids across recent history |
| `--output <format>` | Output format: `human` (default), `json`, `llm` |
| `--json` | Shorthand for `--output json` |
| `-q, --quiet` | Print only the PR number |
| `--graph-depth <n>` | Issue graph traversal depth (0 = PR only, default: 0). When set above 0, automatically fetches linked issues after finding the PR |
| `--no-ast` | Skip AST diff analysis. Useful when ast-grep is unavailable or you want faster execution |
| `--no-cache` | Bypass cache — forces fresh git operations and API calls |
| `--cache-only` | Only return cached results. No git operations or API calls. Returns empty if cache miss |
| `--no-color` | Disable colored terminal output |

## The 4-stage pipeline

line-lore uses a deterministic pipeline — no ML, no heuristics beyond message pattern matching:

### Stage 1: Line to Commit (Blame)

Runs `git blame -C -C -M -w` to find the commit that last modified the target line. The `-C -C` flags detect code copied/moved across files, `-M` detects moved lines within a file, and `-w` ignores whitespace.

### Stage 2: Cosmetic Detection (AST Diff)

Compares the AST structure of the blamed commit's diff. If only formatting changed (same AST, different whitespace/style), the commit is marked `cosmetic_commit` and blame recurses to the parent to find the real logic change. Requires `ast-grep` — gracefully skips if unavailable.

### Stage 3: Commit to Merge Commit (Ancestry Traversal)

Uses `git log --ancestry-path --merges` to walk from the blamed commit up to the merge commit on the base branch. Extracts PR numbers from merge commit messages using platform-specific patterns:
- GitHub: `Merge pull request #NNN` or `(#NNN)` (squash convention)
- GitLab: `!NNN`

If no merge commit is found (rebase workflow), falls back to patch-id matching — computes `git patch-id` for the blamed commit and scans recent merge commits for a matching patch.

### Stage 4: Merge Commit to PR (API Lookup)

Resolves the PR using a minimum-cost strategy:
1. **Cache lookup** — O(1), returns immediately if cached
2. **Message parsing** — O(1), extracts PR number from merge message without API
3. **API lookup** — O(1) HTTP call via `gh`/`glab` CLI
4. **Patch-ID scan** — O(n), scans 500-2000 recent commits as last resort

Each step is tried in order; the pipeline stops at the first success.

## When to use --deep

Use `--deep` when:
- The repository uses squash merges (common in GitHub Flow)
- A normal trace returns a merge commit but no PR
- You suspect the commit was rebased or cherry-picked

Deep tracing extends the patch-id scan window and performs additional ancestry path analysis, which is slower but catches more edge cases.

## When to use --graph-depth

Setting `--graph-depth` above 0 combines trace + graph in one call:

```bash
# Trace line AND fetch linked issues (depth 1)
npx @lumy-pack/line-lore trace src/auth.ts -L 42 --graph-depth 1

# Equivalent to running trace then graph separately
npx @lumy-pack/line-lore trace src/auth.ts -L 42
npx @lumy-pack/line-lore graph pr <result-pr-number> --depth 1
```

This is convenient for one-shot investigations where you want both the PR and its linked issues.

## Batch tracing

line-lore caches git operations (blame, ancestry path) and API responses. When tracing multiple lines in the same file or repo, subsequent calls are significantly faster:

```bash
npx @lumy-pack/line-lore trace src/auth.ts -L 10 --output json
npx @lumy-pack/line-lore trace src/auth.ts -L 25 --output json
npx @lumy-pack/line-lore trace src/auth.ts -L 47 --output json
```

For cache-only lookups (instant, no API), use `--cache-only` — useful for IDE integrations or repeated queries.
