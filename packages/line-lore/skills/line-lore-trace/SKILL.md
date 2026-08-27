---
name: line-lore-trace
description: Trace local Git repository lines to the pull request that introduced or last meaningfully changed them, and inspect PR-issue links with the line-lore CLI. Use for code provenance, review context, or linked-issue investigation; do not use for general Git history summaries or authorship questions without a file and line.
---

# Line Lore

Turn a file and line into structured commit/PR provenance, or traverse the issue links around a known PR or issue.

## Workflow

1. Resolve the target Git repository and the requested result. Ask only when a required input cannot be inferred safely:
   - Trace: an existing file plus a one-based line or inclusive `start,end` range.
   - Graph: `pr` or `issue`, a positive number, and an optional positive depth.
2. Run commands from the repository root. Keep trace paths relative to that root.
3. For a line's last meaningful change, run:

   ```bash
   npx -y @lumy-pack/line-lore trace "<relative-file>" -L "<line-or-start,end>" --mode change --output llm
   ```

   Use `--mode origin` when the user asks which PR first introduced the line or where copied or moved code originally came from; keep `change` for the last meaningful local change.
4. Parse the JSON envelope before drawing conclusions. Check `status`, `operatingLevel`, `warnings`, and `data.nodes` or `partialData.nodes`. Report commit SHAs, PR/issue numbers and URLs, tracking method, and confidence when present. Keep exact, structural, and heuristic evidence distinct.
5. For known relationships, run one structured traversal:

   ```bash
   npx -y @lumy-pack/line-lore graph pr <number> --depth <n> --json
   npx -y @lumy-pack/line-lore graph issue <number> --depth <n> --json
   ```

   Default depth to `1`. Increase it only when the user requests a deeper graph or the immediate result cannot answer the question.
6. Answer from the returned evidence. A commit without a PR node can mean a direct commit, not a failed trace.

## Failure and stopping rules

- If a trace finds commits but no required PR, retry at most once with `--deep`; preserve the selected `--mode`.
- On `partial`, `error`, or missing platform capability, run `npx -y @lumy-pack/line-lore health --json` and report the actionable hint. Do not silently install or authenticate `gh` or `glab`.
- If the installed CLI rejects a documented flag, run `npx -y @lumy-pack/line-lore --describe` and adapt to that reported interface instead of guessing.
- Stop when the requested provenance or relationship is supported. Do not deepen a graph or expand a line range merely for completeness.

## Boundaries

- Treat operating levels `0` and `1` as partial PR evidence and say what could not be resolved.
- `npx -y` may download the package, and line-lore may write npm and line-lore caches; follow host approval policy. Use `--no-cache` when the user requests no line-lore cache writes.
- Never clear caches, change repository history, modify source files, or alter authentication unless the user explicitly asks.
