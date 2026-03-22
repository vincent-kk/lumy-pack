# Graph Command Reference

## Synopsis

```bash
npx -y @lumy-pack/line-lore graph pr <number> [--depth <n>] [--json]
npx -y @lumy-pack/line-lore graph issue <number> [--depth <n>] [--json]
```

**Requires operating level 2** (authenticated `gh` or `glab` CLI). Run `npx -y @lumy-pack/line-lore health` to verify.

## Subcommands

### graph pr

Explore issues linked to a Pull Request.

```bash
# Show issues linked to PR #42
npx -y @lumy-pack/line-lore graph pr 42

# Deeper traversal — follow issue links to other PRs, then to their issues
npx -y @lumy-pack/line-lore graph pr 42 --depth 2 --json
```

### graph issue

Explore PRs linked to an Issue.

```bash
# Show PRs that reference issue #100
npx -y @lumy-pack/line-lore graph issue 100

# With deeper traversal
npx -y @lumy-pack/line-lore graph issue 100 --depth 2 --json
```

## Options

| Option | Description |
|--------|-------------|
| `--depth <n>` | Graph traversal depth. Default: 1. Higher values follow more links but increase API calls |
| `--json` | Output in JSON format |

## How traversal works

The graph command builds a relationship graph by following links between PRs and issues:

```
depth 1: PR #42 → linked issues (#10, #15)
depth 2: PR #42 → #10 → PRs referencing #10 (#43, #50)
                → #15 → PRs referencing #15 (#42, #51)
```

Each depth level alternates between PR-to-issue and issue-to-PR lookups. The graph is deduplicated — nodes visited at a shallower depth are not re-traversed.

## JSON output structure

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
    {
      "from": "pr:42",
      "to": "issue:10",
      "relation": "closes"
    }
  ]
}
```

## Relationship types

| Relation | Meaning |
|----------|---------|
| `closes` | PR closes the issue (via "Closes #N", "Fixes #N") |
| `references` | PR or issue mentions the other without closing |
| `linked` | GitHub/GitLab manual link |

## Use cases

**Bug investigation**: Found a buggy line via `trace` — use `graph pr` to see which issues the PR was supposed to fix, and whether related issues exist.

**Impact analysis**: Before modifying code, trace its origin PR, then use `graph` to understand the full scope of requirements and linked issues.

**Release notes**: Gather all issues resolved by a set of PRs for changelog generation.

**Dependency mapping**: Use depth 2+ to discover transitive relationships between features and bug reports.
