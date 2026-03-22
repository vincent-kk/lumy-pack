# Output Format Reference

## Node types

The trace result is a chain of **nodes**, each representing one step in the provenance chain:

| Node type | Symbol | Meaning |
|-----------|--------|---------|
| `original_commit` | `●` | The commit that introduced or last meaningfully modified the line |
| `cosmetic_commit` | `○` | A formatting-only change (AST identical, different whitespace/style) |
| `merge_commit` | `◆` | The merge commit that delivered the change to the base branch |
| `rebased_commit` | `◇` | The original commit found via patch-id matching (rebase workflow) |
| `pull_request` | `▸` | The PR/MR that delivered the change |
| `issue` | `▹` | A linked issue (when `--graph-depth` is set or via `graph` command) |

## Confidence levels

| Level | Meaning | How determined |
|-------|---------|----------------|
| `exact` | Deterministic match | git blame, direct API lookup |
| `structural` | AST structure matches but not byte-identical | AST diff comparison |
| `heuristic` | Best-effort guess | Merge message parsing, patch-id matching |

## Tracking methods

| Method | Pipeline stage | Description |
|--------|---------------|-------------|
| `blame-CMw` | Stage 1 | Discovered via `git blame -C -C -M -w` |
| `ast-signature` | Stage 2 | Discovered via AST structural comparison |
| `message-parse` | Stage 3 | PR number extracted from merge commit message |
| `ancestry-path` | Stage 3 | Found via `git log --ancestry-path` |
| `patch-id` | Stage 3 | Matched via `git patch-id` (rebase detection) |
| `api` | Stage 4 | Resolved via GitHub/GitLab REST API |
| `issue-link` | Stage 4+ | Discovered via PR-issue link traversal |

## JSON schema (trace)

```json
{
  "nodes": [
    {
      "type": "original_commit",
      "sha": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
      "trackingMethod": "blame-CMw",
      "confidence": "exact"
    },
    {
      "type": "pull_request",
      "sha": "d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0a1b2c3",
      "trackingMethod": "api",
      "confidence": "exact",
      "prNumber": 42,
      "prUrl": "https://github.com/org/repo/pull/42",
      "prTitle": "feat: add authentication",
      "mergedAt": "2025-03-15T10:30:00Z"
    }
  ],
  "operatingLevel": 2,
  "featureFlags": {
    "astDiff": true,
    "deepTrace": false,
    "commitGraph": true,
    "graphql": true
  },
  "warnings": []
}
```

## JSON schema (graph)

```json
{
  "nodes": [
    {
      "type": "pull_request",
      "prNumber": 42,
      "prTitle": "feat: add authentication",
      "prUrl": "https://github.com/org/repo/pull/42"
    },
    {
      "type": "issue",
      "issueNumber": 10,
      "issueTitle": "Users cannot log in",
      "issueUrl": "https://github.com/org/repo/issues/10",
      "issueState": "closed",
      "issueLabels": ["bug", "auth"]
    }
  ],
  "edges": [
    { "from": "pr:42", "to": "issue:10", "relation": "closes" }
  ]
}
```

## LLM output format

When using `--output llm`, the response is wrapped in a structured envelope optimized for LLM consumption:

```json
{
  "tool": "line-lore",
  "status": "success",
  "data": { /* same as json output */ },
  "operatingLevel": 2
}
```

The `status` field can be: `success`, `partial` (some data missing), or `error`.

## Human output format

The default `human` format uses Unicode symbols for a compact visual chain:

```
● Commit a1b2c3d [exact] via blame-CMw
○ Cosmetic b2c3d4e [structural] via ast-signature (formatting only, tracing parent)
◆ Merge c3d4e5f [heuristic] via ancestry-path
▸ PR #42 feat: add authentication [exact] via api
  └─ https://github.com/org/repo/pull/42
  └─ merged 2025-03-15
```
