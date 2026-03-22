# Troubleshooting Guide

When line-lore fails or returns incomplete results, follow this diagnostic sequence. The goal is to identify the issue and guide the user through resolution — do not attempt to fix environment issues silently.

## Step 1: Run health check

```bash
npx @lumy-pack/line-lore health --json
```

This returns the operating level, git version, and optimization status. Use this output to determine which category the problem falls into.

## Step 2: Diagnose by symptom

### "Not a git repository"

**Cause**: The command was run outside a git repository, or the file path is absolute instead of relative.

**Fix**: Ensure you are inside a git repository and the file path is relative to the repo root.

```bash
# Wrong
npx @lumy-pack/line-lore trace /Users/me/project/src/auth.ts -L 42

# Correct
cd /Users/me/project
npx @lumy-pack/line-lore trace src/auth.ts -L 42
```

### Operating level 0 (no PR lookup)

**Cause**: Neither `gh` (GitHub CLI) nor `glab` (GitLab CLI) is installed. line-lore can only perform git blame and AST diff — it cannot look up PR metadata.

**User action required**:
- For GitHub repositories: install `gh`
  ```bash
  brew install gh        # macOS
  # or see https://cli.github.com/ for other platforms
  ```
- For GitLab repositories: install `glab`
  ```bash
  brew install glab      # macOS
  # or see https://gitlab.com/gitlab-org/cli for other platforms
  ```

### Operating level 1 (limited API access)

**Cause**: The CLI is installed but not authenticated. PR lookup works via message parsing only — no API calls, no issue graph.

**User action required**:
- GitHub: `gh auth login`
- GitLab: `glab auth login`

After authenticating, re-run `health` to confirm level 2.

### "No PR found" despite operating level 2

**Possible causes** (in order of likelihood):
1. The commit was pushed directly to the main branch without a PR
2. The repository uses squash merges and the merge message does not follow conventions
3. The commit was cherry-picked from another branch
4. The PR was created on a different remote or fork

**Remediation**:
1. Try `--deep` flag: `npx @lumy-pack/line-lore trace <file> -L <line> --deep`
2. If still not found, the line was likely committed without a PR. Inform the user — this is not an error.

### Slow execution

**Cause**: First run in a large repository requires scanning git history.

**User action** (optional optimization):
```bash
git commit-graph write --reachable --changed-paths
```

This creates a commit-graph with bloom filters, significantly speeding up ancestry-path queries. Subsequent runs benefit from line-lore's built-in caching automatically.

### "ast-grep not found" warning

**Cause**: The `ast-grep` binary is not installed. AST diff analysis (Stage 2) is skipped. The tool still works but may attribute formatting-only commits as the origin.

**User action** (optional):
```bash
brew install ast-grep              # macOS
# or
npm install -g @ast-grep/cli       # cross-platform
```

### Graph command returns empty

**Cause**: Operating level below 2, or the PR/issue has no linked items.

**Diagnostic**:
1. Verify operating level: `npx @lumy-pack/line-lore health --json`
2. If level 2, the PR/issue genuinely has no linked items — this is not an error

### Permission / rate limit errors

**Cause**: The `gh`/`glab` token lacks required scopes, or API rate limit is exceeded.

**User action**:
- GitHub: `gh auth refresh -s repo` to add repo scope
- Rate limits: wait and retry, or use `--cache-only` for cached results

## Step 3: Escalation

If the issue persists after the above steps, ask the user to share the full output with `--output json` for detailed diagnostics. The JSON output includes `warnings` and `featureFlags` that reveal exactly which pipeline stages succeeded or failed.
