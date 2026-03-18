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
line-lore trace src/auth.ts -L 42

# Trace a line range
line-lore trace src/config.ts -L 10,50

# Deep trace with squash PR exploration
line-lore trace src/auth.ts -L 42 --deep

# Traverse PR-to-issues graph
line-lore graph --pr 42 --depth 2

# Check system health
line-lore health

# Clear caches
line-lore cache clear

# Output as JSON
line-lore trace src/auth.ts -L 42 --output json

# Output for LLM consumption
line-lore trace src/auth.ts -L 42 --output llm

# Suppress formatting, return data only
line-lore trace src/auth.ts -L 42 --quiet
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

line-lore executes a 4-stage deterministic pipeline:

1. **Line → Commit (Blame)**: Git blame with `-C -C -M` flags to detect renames and copies
2. **Cosmetic Detection**: AST structural comparison to skip formatting-only changes
3. **Commit → Merge Commit**: Ancestry-path traversal + patch-id matching to resolve merge commits
4. **Merge Commit → PR**: Commit message parsing + platform API lookup

No ML or heuristics — results are always reproducible.

## Operating Levels

- **Level 0**: Git only (offline, fastest)
- **Level 1**: Platform CLI detected but not authenticated
- **Level 2**: Full API access (GitHub/GitLab authenticated)

Higher levels unlock deep tracing, issue graph traversal, and more accurate PR matching.

## Platform Support

- GitHub.com
- GitHub Enterprise Server
- GitLab.com
- GitLab Self-Hosted

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
  nodes: TraceNode[];           // Ancestry nodes (commits, PRs, etc)
  operatingLevel: 0 | 1 | 2;    // Capability level
  featureFlags: FeatureFlags;   // Enabled features
  warnings: string[];           // Degradation notices
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
| `trace <file>` | Trace a line to its PR |
| `-L, --line <num>` | Starting line (required) |
| `--end-line <num>` | Ending line for range |
| `--deep` | Deep trace (squash merges) |
| `--output <format>` | Output as json, llm, or human |
| `--quiet` | Suppress formatting |
| `health` | Check system health |
| `graph --pr <num>` | Traverse PR graph |
| `--depth <num>` | Graph traversal depth |
| `cache clear` | Clear caches |

## Error Handling

Errors are typed via `LineLoreError` with specific error codes:

```typescript
import { LineLoreError, LineLoreErrorCode } from '@lumy-pack/line-lore';

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
