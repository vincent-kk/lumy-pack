# fca-pull-request — Reference Documentation

Detailed workflow, git/gh command signatures, base branch detection algorithm,
PR body templates, and error handling for the FCA-aware PR generator skill.
For the quick-start overview, see [SKILL.md](./SKILL.md).

## Section 0 — Prerequisites & Validation

Verify preconditions before PR creation. All checks run sequentially before
Stage 1.

### 0.1 Git Repository Check

```bash
git rev-parse --is-inside-work-tree
```

- Success → proceed to next check
- Failure → abort: "Not a git repository. Run inside a git repository."

### 0.2 Current Branch Check

```bash
CURRENT_BRANCH=$(git branch --show-current)
```

- `main` or `master` → abort: "Cannot create PR directly from main/master. Switch to a feature branch."
- Empty string (detached HEAD) → abort: "Detached HEAD state. Check out a branch first."
- Otherwise → proceed to next check

### 0.3 Uncommitted Changes Check

```bash
git status --porcelain
```

- Output present → abort: "Uncommitted changes detected. Commit your changes before running."
- No output → proceed to next check

### 0.4 GitHub CLI Authentication Check

```bash
gh auth status
```

- Success → proceed to Stage 1
- Failure → set `GH_AUTH = false` flag. Continue through Stage 3, then save
  PR body locally in Stage 4 with manual instructions.

## Section 1 — FCA Context Sync

### Execution

```
Skill("filid:fca-update")
```

fca-update internally runs Stage 0 (Change Detection) → Stage 1 (Scan) →
Stage 2 (Sync) → Stage 3 (Doc & Test Update) → Stage 4 (Finalize).
fca-pull-request only checks the overall success/failure of this flow.

- **Input**: None (fca-update auto-detects from the current branch)
- **Success condition**: fca-update completes without errors
- **Failure handling**: Print the following and block PR creation

```
## fca-pull-request — BLOCKED

FCA context document sync failed.

**Failure reason**: <fca-update error message>

### Resolution
1. Try manual sync with `/filid:fca-update --force`
2. Fix the issue, then re-run `/filid:fca-pull-request`
```

### `--skip-update` Behavior

Skip Stage 1 entirely and proceed to Stage 2. Print:

```
[SKIPPED] FCA context sync (--skip-update)
```

## Section 2 — Base Branch Resolution

### 2.1 Explicit Specification (`--base=<ref>`)

```bash
git rev-parse --verify <ref>
```

- Success → `BASE_REF = <ref>` confirmed
- Failure → abort: "Specified base ref '`<ref>`' not found."

### 2.2 Auto-Detection Algorithm

When `--base` is unspecified, the following fallback chain determines the base
branch.

```bash
# Step 1: Check remote default branch
DEFAULT_BRANCH=$(git remote show origin 2>/dev/null | grep 'HEAD branch' | awk '{print $NF}')

# Step 2: Fallback chain (when DEFAULT_BRANCH is empty)
# → Check "main" exists: git rev-parse --verify origin/main
# → Check "master" exists: git rev-parse --verify origin/master
# → Both fail: abort with error

# Step 3: Build candidate list (default branch only)
CANDIDATES=()
[ -n "$DEFAULT_BRANCH" ] && CANDIDATES+=("origin/$DEFAULT_BRANCH")

# Step 4: Compute merge-base distance for each candidate
for CANDIDATE in "${CANDIDATES[@]}"; do
  MERGE_BASE=$(git merge-base HEAD "$CANDIDATE" 2>/dev/null)
  if [ -n "$MERGE_BASE" ]; then
    DISTANCE=$(git rev-list --count "$MERGE_BASE"..HEAD)
    # Record (CANDIDATE, DISTANCE) pair
  fi
done

# Step 5: Select candidate with minimum distance
```

### Decision Logic

```
candidates = [origin/DEFAULT_BRANCH].filter(exists && has_merge_base)

if candidates.empty:
  → ERROR: "Cannot auto-detect base branch. Specify `--base` explicitly."

for each candidate:
  merge_base = git merge-base HEAD candidate
  distance = git rev-list --count merge_base..HEAD

BASE_REF = candidate with minimum distance
```

### Edge Cases

| Scenario                                    | Handling                                  |
| ------------------------------------------- | ----------------------------------------- |
| Single candidate only                       | Use that branch                           |
| All candidates share same merge-base        | First candidate in priority order wins    |
| No candidates (orphan branch)               | Error: "Specify `--base` explicitly"      |
| `git merge-base` fails (no common ancestor) | Exclude candidate, proceed with remaining |
| Remote (origin) not configured              | Error: "No remote repository configured"  |

### 2.3 Output

```
Base branch resolved: <BASE_REF> (method: explicit | auto-detected)
Merge base: <commit-hash-short>
Commits ahead: <N>
```

## Section 3 — Change Analysis & PR Body Generation

### 3.1 Collecting Changes

```bash
# Diff statistics
git diff <BASE_REF>..HEAD --stat

# File list with status (A=added, M=modified, D=deleted, R=renamed)
git diff <BASE_REF>..HEAD --name-status

# Full diff (for body generation)
git diff <BASE_REF>..HEAD

# Commit history (for intent extraction)
git log <BASE_REF>..HEAD --oneline --no-decorate

# Detailed commit messages (for Summary generation)
git log <BASE_REF>..HEAD --format="%s%n%b" --no-decorate

# FCA context document changes (for Architecture Changes section)
git diff <BASE_REF>..HEAD -- "**/CLAUDE.md" "**/SPEC.md"
```

When no changes exist (`git diff --name-status` output is empty):

```
No changes detected. The base branch (<BASE_REF>) and current branch are identical.
```

### 3.2 Directory Grouping

Group changed files by module/directory:

```
changed_files grouped by:
  Level 1: Package (packages/filid, packages/syncpoint, etc.)
  Level 2: Source directory (src/core, src/mcp, src/hooks, etc.)
  Level 3: Feature module (subdirectories)
```

### 3.3 Auto-Generated PR Title

When `--title` is unspecified:

1. Extract common prefix from commit messages (feat, fix, refactor, docs, chore, test)
2. Combine most frequent prefix + change scope summary
3. Truncate to 70 characters

Pattern:

```
{prefix}({scope}): {summary}
```

Examples:

- `feat(filid): add fca-pull-request skill for automated PR generation`
- `fix(syncpoint): resolve backup path resolution on macOS`

Falls back to first commit message line (truncated to 70 chars) when prefix
extraction fails.

### 3.4 PR Body Template

Generate a 4-section structure. Print "No relevant changes" for any section
with no applicable changes.

```markdown
## Summary

<!-- Summarize all changes in 3-5 lines. Optimize for human readability -->

- Core purpose of this PR (why this change is needed)
- Summary of change scope
- Affected modules/features

## Architecture Changes (FCA Context Diff)

<!-- Analyze changes to FCA context documents (CLAUDE.md, SPEC.md) -->
<!-- Context docs are committed in the PR; focus on "design intent" here -->

- What architectural decisions changed
- Module structure/boundary changes
- New contracts or interface changes

## Code Changes

<!-- Group code changes by module/file with development intent -->

### {module/directory}

- **{filename}**: Change description
  - Intent: Why this change was needed

## Test Scenarios

<!-- Given-When-Then scenarios in collapsible sections -->
<!-- Written precisely for future automated test generation -->

- [ ] {Test scenario name 1}
  <details>
  <summary>Scenario</summary>

  **Given** (preconditions):
  - {condition 1}
  - {condition 2}

  **When** (action):
  - {action 1}

  **Then** (expected result):
  - {result 1}
  - {result 2}

  </details>

- [ ] {Test scenario name 2}
  <details>
  <summary>Scenario</summary>

  **Given** (preconditions):
  - {condition 1}

  **When** (action):
  - {action 1}
  - {action 2}

  **Then** (expected result):
  - {result 1}

  </details>
```

### 3.5 Section Generation Rules

**Summary**:

- Analyze all commit messages to derive core purpose
- Extract file count and insertion/deletion line counts from `git diff --stat`
- Generate affected module list from changed directory paths
- 3-5 lines, human readability first

**Architecture Changes**:

- Check FCA context document changes via `git diff <BASE_REF>..HEAD -- "**/CLAUDE.md" "**/SPEC.md"`
- If CLAUDE.md/SPEC.md diff exists, describe specific changes
- If new directories created or modules moved/split, describe structural changes
- If `index.ts` or public export changed, describe interface changes
- No applicable changes: "No relevant changes"

**Code Changes**:

- Group each file from `git diff --name-status` by directory
- For each file: analyze `git diff <BASE_REF>..HEAD -- <file>`
- Summarize what changed + why (development intent)
- Extract intent from commit messages associated with each file
- **Scale threshold**: ≤30 changed files → file-level detail; >30 files → directory-level summary with key files only

**Test Scenarios**:

- Derive scenarios from public functions/methods of changed source files
- Given-When-Then format in `<details>` collapsible sections
- Include happy path + edge cases + error cases
- Reflect existing test changes when test files are also modified
- Write precisely for downstream automated test code generation

### 3.6 Language Rules

- PR body: Korean
- Exceptions (keep original form):
  - Code inside code blocks
  - Filenames, variable names, function names, type names
  - CLI commands and option flags
  - Technical abbreviations (FCA, PR, API, MCP, AST, LCOM4, CC, etc.)
  - Commit prefixes (feat, fix, refactor, etc.)

## Section 4 — PR Publication

### 4.1 GitHub CLI Auth Re-check

When `GH_AUTH = false` was set in Stage 0, save the PR body locally:

```bash
# Ensure pr-draft directory exists
mkdir -p .filid/pr-draft
```

Then write the generated body to `.filid/pr-draft/<branch>.md` and display:

```
## fca-pull-request — Manual PR Required

GitHub CLI authentication not verified. PR body saved locally.

**Saved to**: .filid/pr-draft/<branch>.md

### Manual PR Creation
1. Run `gh auth login` to authenticate
2. Re-run `/filid:fca-pull-request`

Or copy the file contents and create the PR manually on GitHub web.
```

### 4.2 Existing PR Check

```bash
gh pr list --head <CURRENT_BRANCH> --state open --json number,title
```

- If an open PR exists: confirm with `AskUserQuestion`

```
An open PR #<N> already exists for this branch: "<title>"
Replace the existing PR body entirely?
- Overwrite: Replace PR body with newly generated content
- Skip: Exit without updating
```

- Overwrite selected → `gh pr edit <N> --body "<new-body>"`
- Skip selected → print PR body and exit
- No existing PR → create new

### 4.3 Remote Push

```bash
# Check if remote tracking branch exists
git ls-remote --heads origin <CURRENT_BRANCH>

# Push if missing
git push -u origin <CURRENT_BRANCH>
```

### 4.4 PR Creation

```bash
gh pr create \
  --base <BASE_REF> \
  --title "<title>" \
  --body "$(cat <<'EOF'
<generated-body>
EOF
)"
```

With `--draft` option:

```bash
gh pr create \
  --base <BASE_REF> \
  --title "<title>" \
  --body "$(cat <<'EOF'
<generated-body>
EOF
)" \
  --draft
```

### 4.5 Final Report

```
## fca-pull-request — Complete

**PR**: <PR URL>
**Title**: <title>
**Base**: <BASE_REF> ← <CURRENT_BRANCH>
**Status**: created | updated (draft)

### Stages Summary
| Stage | Status | Detail |
|-------|--------|--------|
| 0. Prerequisites | PASS | All preconditions met |
| 1. FCA Sync | DONE / SKIPPED | fca-update completed |
| 2. Base Resolution | DONE | <BASE_REF> (auto / explicit) |
| 3. Body Generation | DONE | <N> files, <M> modules analyzed |
| 4. PR Publication | DONE | <PR URL> |
```

## Section 5 — Error Handling

### Error-Action Map by Stage

| Stage             | Error                          | Action                                                   |
| ----------------- | ------------------------------ | -------------------------------------------------------- |
| 0 (Prerequisites) | Not a git repo                 | "Not a git repository" → abort                           |
| 0                 | On main/master branch          | "Cannot create PR from main/master" → abort              |
| 0                 | Detached HEAD                  | "Check out a branch first" → abort                       |
| 0                 | Uncommitted changes            | "Commit changes before running" → abort                  |
| 0                 | gh CLI not authenticated       | Set `GH_AUTH = false`, continue through Stage 3          |
| 1                 | fca-update failure             | Print BLOCKED message → abort                            |
| 2                 | `--base` ref not found         | "Specified ref not found" → abort                        |
| 2                 | No auto-detect candidates      | "Specify `--base` explicitly" → abort                    |
| 2                 | Remote (origin) not configured | "No remote repository configured" → abort                |
| 3                 | Empty diff (no changes)        | "No changes detected" → abort                            |
| 4                 | `gh auth` not authenticated    | Save PR body to `.filid/pr-draft/` + manual instructions |
| 4                 | Existing PR update rejected    | Print PR body and exit                                   |
| 4                 | `git push` failure             | Print push error → abort                                 |
| 4                 | `gh pr create` failure         | Print error + save PR body to `.filid/pr-draft/`         |

### Common Error Output Format

```
## fca-pull-request — ERROR

**Stage**: <N> (<Stage Name>)
**Error**: <error description>

### Resolution
<specific resolution steps>
```
