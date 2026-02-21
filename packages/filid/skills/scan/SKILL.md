---
name: scan
description: "Scan and validate FCA-AI rules across the project"
---

# /scan — FCA-AI Rule Scanner

Scan the project for FCA-AI rule violations.

## What This Skill Does

1. **Check CLAUDE.md files** for 100-line limit and 3-tier boundary sections
2. **Check organ directories** for prohibited CLAUDE.md files
3. **Check spec.ts files** for 3+12 rule violations (max 15 test cases)
4. **Report violations** with severity, location, and remediation advice

## Usage

```
/scan [path] [--fix]
```

- `path` (optional): Target directory. Defaults to current working directory.
- `--fix`: Auto-fix violations where possible (e.g., compress oversized CLAUDE.md).

## Steps

1. Use `fractal-navigate` tool to build the project tree
2. Use `test-metrics` tool with action `check-312` on all spec files
3. Validate each CLAUDE.md against document-validator rules
4. Report summary: total checks, violations found, auto-fixable count
