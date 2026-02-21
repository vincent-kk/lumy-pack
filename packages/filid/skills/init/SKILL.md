---
name: init
description: "Initialize FCA-AI structure in a project directory"
---

# /init — FCA-AI Initialization

Initialize the FCA-AI fractal context architecture in the current project.

## What This Skill Does

1. **Scan directory structure** to identify existing modules
2. **Classify directories** as fractal or organ using naming conventions
3. **Generate CLAUDE.md** files for fractal directories (max 100 lines each)
4. **Generate SPEC.md** files for modules that need specifications
5. **Validate** the resulting structure against FCA-AI rules

## Usage

```
/init [path]
```

- `path` (optional): Target directory. Defaults to current working directory.

## Steps

1. Use `fractal-navigate` tool with action `tree` to build the hierarchy
2. For each fractal directory without CLAUDE.md, create one with 3-tier boundaries
3. Skip organ directories (components, utils, types, hooks, helpers, lib, styles, assets, constants)
4. Report initialization summary: directories scanned, CLAUDE.md created, warnings
