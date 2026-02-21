# sync — Reference Documentation

Detailed workflow, ChangeQueue protocol, and update rules for the sync skill.
For the quick-start guide, see [SKILL.md](./SKILL.md).

## Section 1 — Change Collection Details

Drain the ChangeQueue to retrieve all pending `ChangeRecord[]` entries:

```
changeRecords = drainChangeQueue()
// Returns: ChangeRecord[] sorted by timestamp
```

Each record captures the changed file path, change type (add/modify/delete),
and a summary of what changed.

## Section 2 — Impact Analysis Details

Identify which fractal modules are affected and group changes:

```
affectedFractals = getAffectedFractals(changeRecords)
// Returns: string[] of parent fractal directory paths (deduped)

changesByPath = getChangesByPath(changeRecords)
// Returns: Map<fractalPath, ChangeRecord[]>
```

Use `fractal-navigate(action: "tree")` to confirm module boundaries and
ensure affected paths are correctly classified as fractal (not organ).

## Section 3 — CLAUDE.md Update Rules

For each affected fractal module, determine and apply updates:

```
for fractalPath in affectedFractals:
    changes = changesByPath[fractalPath]
    claudeMd = read(fractalPath + "/CLAUDE.md")

    if hasExportChanges(changes):
        updateStructureSection(claudeMd, changes)

    if hasDependencyChanges(changes):
        updateDependenciesSection(claudeMd, changes)

    if lineCount(claudeMd) >= 90:
        doc-compress(mode: "auto", file: claudeMd)

    write(fractalPath + "/CLAUDE.md", claudeMd)
```

**Key constraint**: CLAUDE.md must never exceed 100 lines. Restructure
content rather than append.

## Section 4 — SPEC.md Update Rules

Update SPEC.md files where specifications are impacted:

```
for fractalPath in affectedFractals:
    if hasSpecImpact(changesByPath[fractalPath]):
        specMd = read(fractalPath + "/SPEC.md")
        updateFunctionalRequirements(specMd, changes)
        updateApiDefinitions(specMd, changes)
        write(fractalPath + "/SPEC.md", specMd)
```

Rules:
- **Functional requirements altered** → rewrite affected entries (no append-only growth)
- **API interfaces changed** → sync definitions with current implementation
- **New behavior introduced** → integrate into existing spec structure
- **Key constraint**: Restructure content — never append without consolidating

## Section 5 — Validation Details

Validate every updated document:

```
for updatedDoc in allUpdatedDocs:
    if isClaudeMd(updatedDoc):
        result = validateClaudeMd(updatedDoc)
    else:
        result = validateSpecMd(updatedDoc)

    if result.hasCriticalErrors:
        flagForManualReview(updatedDoc, result.errors)
```

## Section 6 — Report and Dry-Run Formats

### Standard report

```
Updated documents (3):
  ✓ packages/filid/src/core/CLAUDE.md — exports updated, 87 lines
  ✓ packages/filid/src/core/SPEC.md — API interfaces synced
  ✓ packages/filid/src/commands/CLAUDE.md — dependencies updated, compressed (94→81 lines)

Validation: 3/3 PASSED
ChangeQueue: drained (12 records processed)
```

### Dry-run output format

```
[DRY RUN] Would update 3 documents:
  ~ packages/filid/src/core/CLAUDE.md
    + exports: addDocCompress, addFractalNavigate
    - exports: removedHelper
  ~ packages/filid/src/core/SPEC.md
    ~ API: updateSyncInterface
  No changes written.
```

## MCP Tool Examples

**doc-compress:**
```
doc-compress(mode: "auto", file: "packages/filid/src/core/CLAUDE.md")
// Compresses to under 100 lines, returns compressed content
```

**fractal-navigate:**
```
fractal-navigate(action: "tree", root: "packages/filid/src")
// Returns: hierarchical module tree with fractal/organ classifications
```
