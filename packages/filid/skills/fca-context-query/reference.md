# context-query — Reference Documentation

Detailed workflow, 3-Prompt Limit protocol, and compression strategy for
the context query skill. For the quick-start guide, see [SKILL.md](./SKILL.md).

## Section 1 — Question Parsing

Identify from the question:

- **Target module or concept** — e.g., "payments", "retry logic", "auth"
- **Relevant file paths** — any paths mentioned explicitly
- **Query type** — boundary rule lookup | ownership question | structural question

If the question references a file path directly, use that as the navigation
starting point. Otherwise proceed to Phase 2.

## Section 2 — Navigation Details

Use `fractal-navigate` to locate the target module:

```
fractal-navigate({ action: "tree", path: "<project-root>", entries: [] })
```

Scan the tree for the node whose name or path best matches the target.
If the match is ambiguous, use:

```
fractal-navigate({ action: "classify", path: "<candidate-path>", entries: [] })
```

This counts as **Prompt 1** of the 3-Prompt budget.

## Section 3 — Context Chain Loading

Load the CLAUDE.md chain from the identified leaf node up to the project root:

```
[leaf CLAUDE.md] → [parent CLAUDE.md] → [grandparent CLAUDE.md] → [root CLAUDE.md]
```

Claude Code loads `@`-referenced CLAUDE.md files natively. Construct the
chain by following `parent` relationships in the fractal tree.

Only load CLAUDE.md files that are directly in the ancestor path of the
target node. Do not load sibling or cousin nodes.

## Section 4 — Compression Strategy

If the combined CLAUDE.md chain exceeds working context limits, call
`doc-compress` before generating the response:

```
doc-compress({ mode: "auto" })
```

`auto` mode selects `reversible` compression for structured documents
and `lossy` compression for tool-call history. The original files remain
on disk; only the in-context representation is compressed.

Apply compression only when necessary. Skip if the chain fits in context.

## Section 5 — 3-Prompt Limit Protocol

| Prompt      | Purpose                                                     |
| ----------- | ----------------------------------------------------------- |
| 1           | Module location via `fractal-navigate`                      |
| 2           | Detailed analysis or additional context loading if required |
| 3 (maximum) | Final response generation                                   |

If the question cannot be answered within 3 prompts, respond with:

1. What is known from the loaded context
2. Which additional CLAUDE.md files or information would be needed
3. The specific path or module the user should consult directly

Do not continue searching beyond the 3-prompt budget. Surface what is
known and stop.
