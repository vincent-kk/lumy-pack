# @lumy-pack/line-lore

Trace code lines to their originating Pull Requests via deterministic git blame analysis and platform APIs.

## Features

- **Line-to-PR tracing**: Reverse-trace any code line to its source PR in seconds
- **4-stage pipeline**: Blame → Cosmetic detection → Ancestry traversal → PR lookup
- **Multi-platform support**: GitHub, GitHub Enterprise, GitLab, and GitLab self-hosted
- **Operating levels**: Graceful degradation from offline (Level 0) to full API access (Level 2)
- **Dual deployment**: Use as CLI tool or import as a programmatic library
- **Smart caching**: Built-in caching for git operations and API responses

## Installation

```bash
npm install @lumy-pack/line-lore
# or
yarn add @lumy-pack/line-lore
```

## Quick Start

### CLI Usage

```bash
# Trace a single line to its PR
npx @lumy-pack/line-lore trace src/auth.ts -L 42

# Trace a line range
npx @lumy-pack/line-lore trace src/config.ts -L 10,50

# Deep trace with squash PR exploration
npx @lumy-pack/line-lore trace src/auth.ts -L 42 --deep

# Traverse PR-to-issues graph
npx @lumy-pack/line-lore graph --pr 42 --depth 2

# Check system health
npx @lumy-pack/line-lore health

# Clear caches
npx @lumy-pack/line-lore cache clear

# Output as JSON
npx @lumy-pack/line-lore trace src/auth.ts -L 42 --output json

# Output for LLM consumption
npx @lumy-pack/line-lore trace src/auth.ts -L 42 --output llm

# Suppress formatting, return data only
npx @lumy-pack/line-lore trace src/auth.ts -L 42 --quiet
```

### Programmatic API

```typescript
import { trace, health, clearCache } from '@lumy-pack/line-lore';

// Trace a line to its PR
const result = await trace({
  file: 'src/auth.ts',
  line: 42,
});

console.log(result.nodes);           // TraceNode[]
console.log(result.operatingLevel);  // 0 | 1 | 2
console.log(result.warnings);         // degradation messages
```

## How It Works

@lumy-pack/line-lore executes a 4-stage deterministic pipeline:

1. **Line → Commit (Blame)**: Git blame with `-C -C -M` flags to detect renames and copies
2. **Cosmetic Detection**: AST structural comparison to skip formatting-only changes
3. **Commit → Merge Commit**: Ancestry-path traversal + patch-id matching to resolve merge commits
4. **Merge Commit → PR**: Commit message parsing + platform API lookup

No ML or heuristics — results are always reproducible.

## Understanding the Output

### TraceNode — the core unit of output

Every `trace()` call returns a `nodes` array. Each node represents one step in the ancestry chain from the code line back to its PR. Nodes are ordered from most recent (the line's direct commit) to most distant (the PR or issue).

```typescript
interface TraceNode {
  type: TraceNodeType;         // What this node represents
  sha?: string;                // Git commit hash (40 chars)
  trackingMethod: TrackingMethod;  // How this node was discovered
  confidence: Confidence;      // How reliable this result is
  prNumber?: number;           // PR/MR number (only on pull_request nodes)
  prUrl?: string;              // Full URL to PR (only with Level 2 API access)
  prTitle?: string;            // PR title (only with Level 2 API access)
  mergedAt?: string;           // When the PR was merged (ISO 8601)
  patchId?: string;            // Git patch-id (only on rebased_commit nodes)
  note?: string;               // Additional context (e.g., "Cosmetic change: whitespace")
  issueNumber?: number;        // Issue number (only on issue nodes)
  issueUrl?: string;           // Issue URL
  issueTitle?: string;         // Issue title
  issueState?: 'open' | 'closed';
  issueLabels?: string[];
}
```

### Node types

| Type | Symbol | Meaning | When it appears |
|------|--------|---------|-----------------|
| `original_commit` | `●` | The commit that introduced or last modified this line | Always (at least one) |
| `cosmetic_commit` | `○` | A formatting-only change (whitespace, imports) | When AST detects no logic change |
| `merge_commit` | `◆` | The merge commit on the base branch | Merge-based workflows |
| `rebased_commit` | `◇` | A rebased version of the original commit | Rebase workflows with patch-id match |
| `pull_request` | `▸` | The PR/MR that introduced this change | When PR is found (Level 1 or 2) |
| `issue` | `▹` | A linked issue from the PR | When `--graph-depth >= 1` with Level 2 |

### Tracking methods

| Method | Stage | Meaning |
|--------|-------|---------|
| `blame-CMw` | 1 | Found via `git blame -C -C -M -w` |
| `ast-signature` | 1-B | Found via AST structural comparison |
| `message-parse` | 3 | PR number extracted from merge commit message (e.g., `Merge pull request #42`) |
| `ancestry-path` | 3 | Found via `git log --ancestry-path --merges` |
| `patch-id` | 3 | Matched via `git patch-id` (rebase detection) |
| `api` | 4 | Found via GitHub/GitLab REST API |
| `issue-link` | 4+ | Found via PR-to-issue link in API |

### Confidence levels

| Level | Meaning |
|-------|---------|
| `exact` | Deterministic match (blame, API lookup) |
| `structural` | AST structure matches but not byte-identical |
| `heuristic` | Best-effort match (message parsing, patch-id) |

### Output examples

**Typical merge workflow (Level 2):**
```
● Commit a1b2c3d [exact] via blame-CMw
▸ PR #42 feat: add authentication
  └─ https://github.com/org/repo/pull/42
```

**Squash merge (Level 2):**
```
● Commit e4f5a6b [exact] via blame-CMw
▸ PR #55 refactor: user service
  └─ https://github.com/org/repo/pull/55
```

**Cosmetic change detected (AST enabled):**
```
○ Cosmetic d7e8f9a [exact] Cosmetic change: whitespace-only
● Commit b2c3d4e [structural] via ast-signature
▸ PR #31 feat: original logic
  └─ https://github.com/org/repo/pull/31
```

**Level 0 (offline — no platform CLI):**
```
● Commit a1b2c3d [exact] via blame-CMw

⚠ Could not detect platform. Running in Level 0 (git only).
```

**Level 1 (CLI found, not authenticated):**
```
● Commit a1b2c3d [exact] via blame-CMw
▸ PR #42 [heuristic] via message-parse

⚠ Platform CLI not authenticated. Running in Level 1 (local only).
```

**JSON output (`--output json`):**
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
      "sha": "f0e1d2c3b4a5f6e7d8c9b0a1f2e3d4c5b6a7f8e9",
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
    "commitGraph": false,
    "issueGraph": false,
    "graphql": true
  },
  "warnings": []
}
```

**Quiet mode (`--quiet`):**
```
42
```
Returns just the PR number. If no PR is found, returns the short commit SHA (e.g., `a1b2c3d`).

### How to interpret results

| What you see | What it means |
|--------------|---------------|
| Only `original_commit` | The commit was found but no PR could be linked (direct push, or Level 0) |
| `original_commit` + `pull_request` | Successfully traced line → commit → PR |
| `cosmetic_commit` + `original_commit` + `pull_request` | Line was reformatted; AST traced back to the real logic change |
| `prUrl` is empty | PR was found via message parsing (Level 1) but no API details available |
| `warnings` array has entries | Some features are degraded — check `operatingLevel` |
| `operatingLevel: 0` | No platform CLI — only git blame results available |
| `operatingLevel: 1` | CLI found but not authenticated — PR lookup via merge message only |
| `operatingLevel: 2` | Full API access — most accurate results |

## Operating Levels

| Level | Requirements | What works | What doesn't |
|-------|-------------|------------|--------------|
| **0** | Git only | Blame, AST diff | PR lookup, issue graph |
| **1** | `gh`/`glab` CLI installed | Blame, AST diff, PR via merge message | API-based PR lookup, issue graph, deep trace |
| **2** | `gh`/`glab` CLI authenticated | Everything | — |

Run `line-lore health` to check your current level:
```bash
npx @lumy-pack/line-lore health
```

### Upgrading your level

```bash
# Level 0 → 1: Install the CLI
brew install gh        # GitHub
brew install glab      # GitLab

# Level 1 → 2: Authenticate
gh auth login          # GitHub
glab auth login        # GitLab

# GitHub Enterprise: authenticate with your hostname
gh auth login --hostname git.corp.com
```

## Platform Support

- GitHub.com
- GitHub Enterprise Server
- GitLab.com
- GitLab Self-Hosted

Platform is auto-detected from your git remote URL. Unknown hosts default to GitHub Enterprise.

## API Reference

### `trace(options: TraceOptions): Promise<TraceFullResult>`

Trace a code line to its originating PR.

**Options:**
- `file` (string): Path to the file
- `line` (number): Starting line number (1-indexed)
- `endLine?` (number): Ending line for range queries
- `remote?` (string): Git remote name (default: 'origin')
- `deep?` (boolean): Enable deep trace for squash merges
- `graphDepth?` (number): Issue graph traversal depth
- `output?` ('human' | 'json' | 'llm'): Output format
- `quiet?` (boolean): Suppress formatting
- `noAst?` (boolean): Disable AST analysis
- `noCache?` (boolean): Disable caching

**Returns:**
```typescript
{
  nodes: TraceNode[];           // Ancestry chain (commits → PRs → issues)
  operatingLevel: 0 | 1 | 2;    // Current capability level
  featureFlags: FeatureFlags;   // Which features are active
  warnings: string[];           // Degradation notices
}
```

**How to read the result:**
```typescript
const result = await trace({ file: 'src/auth.ts', line: 42 });

// Did we find a PR?
const prNode = result.nodes.find(n => n.type === 'pull_request');
if (prNode) {
  console.log(`PR #${prNode.prNumber}: ${prNode.prTitle}`);
  console.log(`URL: ${prNode.prUrl}`);       // only at Level 2
  console.log(`Merged: ${prNode.mergedAt}`);  // only at Level 2
} else {
  // No PR found — line was a direct commit or Level 0
  const commit = result.nodes.find(n => n.type === 'original_commit');
  console.log(`Direct commit: ${commit?.sha}`);
}

// Check if results are degraded
if (result.operatingLevel < 2) {
  console.warn('Limited results:', result.warnings);
}
```

### `health(options?: { cwd?: string }): Promise<HealthReport>`

Check system health: git version, platform CLI status, authentication.

### `clearCache(): Promise<void>`

Clear PR lookup and patch-id caches.

### `traverseIssueGraph(adapter, startType, startNumber, options?): Promise<GraphResult>`

Traverse PR-to-issues graph (requires Level 2 access).

## CLI Reference

| Command | Purpose |
|---------|---------|
| `npx @lumy-pack/line-lore trace <file>` | Trace a line to its PR |
| `-L, --line <num>` | Starting line (required) |
| `--end-line <num>` | Ending line for range |
| `--deep` | Deep trace (squash merges) |
| `--output <format>` | Output as json, llm, or human |
| `--quiet` | Suppress formatting |
| `npx @lumy-pack/line-lore health` | Check system health |
| `npx @lumy-pack/line-lore graph --pr <num>` | Traverse PR graph |
| `--depth <num>` | Graph traversal depth |
| `npx @lumy-pack/line-lore cache clear` | Clear caches |

## Error Handling

Errors are typed via `LineLoreError` with specific error codes:

```typescript
import { trace, LineLoreError } from '@lumy-pack/line-lore';

try {
  await trace({ file: 'src/auth.ts', line: 42 });
} catch (error) {
  if (error instanceof LineLoreError) {
    console.error(error.code);  // e.g., 'FILE_NOT_FOUND'
    console.error(error.message);
    console.error(error.context); // additional metadata
  }
}
```

Common codes:
- `NOT_GIT_REPO` — not in a git repository
- `FILE_NOT_FOUND` — file does not exist
- `INVALID_LINE` — line number out of range
- `GIT_BLAME_FAILED` — git blame execution failed
- `PR_NOT_FOUND` — PR not found for commit
- `CLI_NOT_AUTHENTICATED` — platform CLI not authenticated
- `API_RATE_LIMITED` — platform API rate limit exceeded

## Requirements

- Node.js >= 20
- Git >= 2.27
- Optional: `gh` CLI >= 2.0 (for GitHub API)
- Optional: `glab` CLI >= 1.30 (for GitLab API)

## License

MIT
