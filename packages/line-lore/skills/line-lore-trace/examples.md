# line-lore Examples

Concrete workflow recipes for common scenarios. Each example shows the command, expected output pattern, and how to interpret results.

---

## Example 1: Simple line-to-PR lookup

**Scenario**: You encounter a suspicious line during code review and want to know which PR introduced it.

```bash
npx -y @lumy-pack/line-lore trace src/auth/middleware.ts -L 42
```

**Expected output** (human format):
```
● Commit a1b2c3d [exact] via blame-CMw
▸ PR #87 feat: add JWT token validation [exact] via api
  └─ https://github.com/org/repo/pull/87
  └─ merged 2025-02-10
```

**Interpretation**: Line 42 was introduced by commit `a1b2c3d`, which was delivered via PR #87.

---

## Example 2: Tracing a line range

**Scenario**: A block of code (lines 15-30) looks like it was added together. Trace the whole range to confirm.

```bash
npx -y @lumy-pack/line-lore trace src/config/database.ts -L 15,30 --output json
```

**What to look for in the result**: If all lines map to the same PR, they were indeed added together. If multiple PRs appear, the block was built up incrementally across several changes.

---

## Example 3: Squash-merged PR (deep trace)

**Scenario**: Normal trace returns a commit but no PR — likely a squash merge without conventional message.

```bash
# First attempt (no PR found)
npx -y @lumy-pack/line-lore trace src/utils/parser.ts -L 88 -q
# → (empty)

# Retry with deep tracing
npx -y @lumy-pack/line-lore trace src/utils/parser.ts -L 88 --deep -q
# → 156
```

**Why this works**: `--deep` extends the patch-id scan window and performs additional ancestry analysis to catch squash-merged commits whose messages do not follow the `(#NNN)` convention.

---

## Example 4: Full investigation — trace + graph

**Scenario**: You found a bug and want to understand both which PR introduced it and what issues were being addressed.

```bash
# Step 1: Find the PR
npx -y @lumy-pack/line-lore trace src/api/handler.ts -L 127 --output json
# → PR #42

# Step 2: Explore linked issues
npx -y @lumy-pack/line-lore graph pr 42 --depth 1 --json
```

**Or combine in one call**:
```bash
npx -y @lumy-pack/line-lore trace src/api/handler.ts -L 127 --graph-depth 1 --output json
```

**What to look for**: The `nodes` array will contain both `pull_request` and `issue` entries. Issues with state `closed` were resolved by this PR; `open` issues may indicate incomplete work.

---

## Example 5: Issue-first investigation

**Scenario**: You have an issue number and want to find all PRs that reference it, plus the code changes involved.

```bash
# Find PRs linked to issue #200
npx -y @lumy-pack/line-lore graph issue 200 --depth 1 --json
```

**Expected output**:
```json
{
  "nodes": [
    { "type": "issue", "issueNumber": 200, "issueTitle": "Login timeout on slow connections", "issueState": "closed" },
    { "type": "pull_request", "prNumber": 215, "prTitle": "fix: increase auth timeout to 30s" },
    { "type": "pull_request", "prNumber": 220, "prTitle": "feat: add connection retry logic" }
  ],
  "edges": [
    { "from": "pr:215", "to": "issue:200", "relation": "closes" },
    { "from": "pr:220", "to": "issue:200", "relation": "references" }
  ]
}
```

**Interpretation**: PR #215 directly closed the issue, while PR #220 referenced it (possibly a follow-up improvement).

---

## Example 6: Batch tracing for code review

**Scenario**: During code review, you want to check the origin of several key lines in a file.

```bash
# Trace multiple lines — caching makes subsequent calls fast
npx -y @lumy-pack/line-lore trace src/core/engine.ts -L 10 --output json
npx -y @lumy-pack/line-lore trace src/core/engine.ts -L 45 --output json
npx -y @lumy-pack/line-lore trace src/core/engine.ts -L 112 --output json
npx -y @lumy-pack/line-lore trace src/core/engine.ts -L 200 --output json
```

**Tip**: Parse the JSON output and group lines by `prNumber` to see which PRs contributed to the current state of the file.

---

## Example 7: Cache-only fast lookup

**Scenario**: In an IDE integration or repeated workflow, you want instant results without API calls.

```bash
# Only returns cached results (no network, no git operations)
npx -y @lumy-pack/line-lore trace src/auth.ts -L 42 --cache-only --output json
```

**Behavior**: Returns the cached trace result if available, or an empty result if not cached. Use this for real-time IDE hover information where latency matters.

---

## Example 8: Health check before starting

**Scenario**: Before using line-lore in a new repository, verify the environment is ready.

```bash
npx -y @lumy-pack/line-lore health --json
```

**Expected output** (optimal setup):
```json
{
  "gitVersion": "2.53.0",
  "commitGraph": true,
  "bloomFilter": true,
  "operatingLevel": 2,
  "hints": [],
  "partialClone": false,
  "shallow": false
}
```

**If operating level is below 2**: See `references/troubleshooting.md` for setup instructions.

---

## Example 9: Deep graph traversal

**Scenario**: You want to understand the full web of related issues and PRs around a feature area.

```bash
# Depth 2: PR → issues → other PRs that reference those issues
npx -y @lumy-pack/line-lore graph pr 42 --depth 2 --json
```

**Use case**: Building a comprehensive picture for release notes, impact analysis, or understanding feature scope across multiple PRs.

---

## Example 10: Handling "No PR found"

**Scenario**: Trace returns a commit but no PR — how to respond.

```bash
npx -y @lumy-pack/line-lore trace src/legacy/old-module.ts -L 5 --output json
```

**If the result has no `pull_request` node**:

1. Try `--deep`: the commit might be squash-merged
2. Check if the commit predates the PR workflow (very old code)
3. The line may have been committed directly to main without a PR

This is not an error — inform the user that the code was committed directly and provide the commit SHA for further investigation with `git show`.
