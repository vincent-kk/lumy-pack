---
name: query
description: "Interactive FCA-AI context query with 3-Prompt Limit"
---

# /query — Context Query

Query the FCA-AI context hierarchy interactively.

## What This Skill Does

1. **Navigate the fractal tree** to find relevant context for a question
2. **Load minimal context** — only the CLAUDE.md chain from leaf to root
3. **Enforce 3-Prompt Limit** — answer within 3 agent interactions maximum
4. **Compress context** if the chain exceeds working memory limits

## Usage

```
/query <question>
```

## Steps

1. Parse the question to identify relevant modules and paths
2. Use `fractal-navigate` tool to locate the target in the tree
3. Load the CLAUDE.md chain (Claude Code handles this natively)
4. If context is too large, use `doc-compress` tool with mode `auto`
5. Answer the question within 3 prompt interactions maximum

## 3-Prompt Limit Rule

FCA-AI enforces a maximum of 3 agent prompts per query to prevent
unbounded context exploration. If the answer cannot be determined
within 3 interactions, respond with what is known and indicate
what additional information would be needed.
