---
name: sync
description: "Synchronize CLAUDE.md/SPEC.md with code changes"
---

# /sync — Document Synchronization

Synchronize CLAUDE.md and SPEC.md documents with accumulated code changes.

## What This Skill Does

1. **Drain the change queue** to get all pending file modifications
2. **Identify affected fractal modules** from changed file paths
3. **Update CLAUDE.md** files to reflect new exports, dependencies, or structure
4. **Update SPEC.md** files if specifications are impacted
5. **Validate** all updated documents against FCA-AI rules

## Usage

```
/sync [--dry-run]
```

- `--dry-run`: Show what would be updated without making changes.

## Steps

1. Review accumulated changes from the change queue
2. Group changes by fractal module
3. For each affected module, check if CLAUDE.md needs updating
4. Apply updates while keeping CLAUDE.md under 100 lines
5. Use `doc-compress` tool if documents approach the line limit
