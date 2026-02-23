# fca-ast-fallback Reference

Detailed workflow steps, language mappings, meta-variable conversion rules,
and error detection strings for the AST pattern matching fallback skill.

---

## Table of Contents

1. [Native Tool Attempt](#section-1--native-tool-attempt)
2. [Unavailability Detection](#section-2--unavailability-detection)
3. [LLM Search Fallback](#section-3--llm-search-fallback)
4. [LLM Replace Fallback](#section-4--llm-replace-fallback)
5. [Limitations](#section-5--limitations)

---

## Section 1 — Native Tool Attempt

Always attempt the native MCP tool first. The fallback should only activate
when the native tool is genuinely unavailable.

### Search Request

```
Tool: ast_grep_search
Input:
  pattern: <user pattern>
  language: <language>
  path: <directory>
  context: 2
  max_results: 20
```

### Replace Request

```
Tool: ast_grep_replace
Input:
  pattern: <user pattern>
  replacement: <user replacement>
  language: <language>
  path: <directory>
  dry_run: true    ← default is true (preview only)
```

**Important**: `dry_run` defaults to `true` in the native tool.
Always show preview first, then re-call with `dry_run: false` after
user confirmation.

---

## Section 2 — Unavailability Detection

### Error String

The exact error returned by both `ast_grep_search` and `ast_grep_replace`:

```
@ast-grep/napi is not available. Install it with: npm install -g @ast-grep/napi
```

The response object also includes an `sgLoadError` field with the
underlying module load failure message.

### Detection Logic

```
IF response contains key "error"
AND response.error starts with "@ast-grep/napi is not available"
THEN activate fallback mode
```

### User Notification

Print once per session:

```
[INFO] ast-grep is not installed. Using LLM-based pattern matching fallback.
Results may be less precise than ast-grep.
To install: npm install -g @ast-grep/napi
```

---

## Section 3 — LLM Search Fallback

### Step 1: File Discovery

Use `Glob` tool to find files matching the target language extensions.

#### Language-to-Extension Map

Sourced from `src/mcp/tools/ast-grep-shared.ts` (`EXT_TO_LANG`):

| Language     | Extensions                              |
| ------------ | --------------------------------------- |
| javascript   | `.js`, `.mjs`, `.cjs`, `.jsx`           |
| typescript   | `.ts`, `.mts`, `.cts`                   |
| tsx          | `.tsx`                                  |
| python       | `.py`                                   |
| ruby         | `.rb`                                   |
| go           | `.go`                                   |
| rust         | `.rs`                                   |
| java         | `.java`                                 |
| kotlin       | `.kt`, `.kts`                           |
| swift        | `.swift`                                |
| c            | `.c`, `.h`                              |
| cpp          | `.cpp`, `.cc`, `.cxx`, `.hpp`           |
| csharp       | `.cs`                                   |
| html         | `.html`, `.htm`                         |
| css          | `.css`                                  |
| json         | `.json`                                 |
| yaml         | `.yaml`, `.yml`                         |

#### Glob Patterns

For language `typescript`:
```
**/*.ts
**/*.mts
**/*.cts
```

#### Exclusions

Always exclude these directories:
- `node_modules/`
- `.git/`
- `dist/`
- `build/`
- `__pycache__/`
- `.venv/`, `venv/`

### Step 2: Meta-Variable to Regex Conversion

AST meta-variables are converted to regex patterns for Grep:

| Meta-Variable Pattern | Regex Approximation | Matches                           |
| --------------------- | ------------------- | --------------------------------- |
| `$NAME`               | `[\w.]+`            | Single identifier or dotted path  |
| `$VALUE`              | `[\w.]+`            | Single value expression           |
| `$TYPE`               | `[\w.<>,\[\] ]+`    | Type annotation                   |
| `$$$ARGS`             | `[\s\S]*?`          | Multiple items (non-greedy)       |
| `$$$BODY`             | `[\s\S]*?`          | Block body (non-greedy)           |

**Conversion algorithm**:

1. Escape regex special chars in the pattern (except `$`)
2. Replace `$$$[A-Z_][A-Z0-9_]*` with `[\s\S]*?`
3. Replace `$[A-Z_][A-Z0-9_]*` with `[\w.]+`
4. Collapse whitespace in the pattern to `\s+`

**Example**:

```
Pattern:  console.log($MSG)
Regex:    console\.log\([\w.]+\)

Pattern:  function $NAME($$$ARGS) { $$$BODY }
Regex:    function\s+[\w.]+\([\s\S]*?\)\s*\{\s*[\s\S]*?\s*\}
```

### Step 3: Search Execution

1. Run `Grep` with the converted regex, filtering by language file type
2. Read matching files with `Read` tool for surrounding context
3. Use LLM understanding to filter false positives:
   - Check that the match is a complete AST node, not a substring
   - Verify structural context (e.g., inside a function body, at top level)
   - Discard matches inside comments or string literals

### Step 4: Result Formatting

Format results matching the native tool's output style:

```
file/path.ts:42
>   42: matched code line
    43: context line after
    44: context line after
```

Include a summary line:

```
Found N match(es) in M file(s) [LLM fallback — results may be approximate]
```

---

## Section 4 — LLM Replace Fallback

### Step 1: Search

Perform the full search workflow from Section 3 to find all matches.

### Step 2: Build Replacement

For each match, apply the replacement pattern:

1. Extract captured values from the search match using positional mapping
2. Substitute meta-variables in the replacement string with captured values
3. Handle `$$$` variables by preserving the original matched content

**Example**:

```
Pattern:     var $NAME = $VALUE
Match:       var count = 0
Replacement: const $NAME = $VALUE
Result:      const count = 0
```

### Step 3: Dry-Run Preview

Always show a preview before applying changes:

```
[DRY RUN] Proposed changes:

file/path.ts:42
  - var count = 0
  + const count = 0

file/path.ts:67
  - var total = 100
  + const total = 100

Total: 2 replacement(s) in 1 file(s)
Apply changes? [y/N]
```

### Step 4: Apply Changes

After user confirmation:

1. Use `Edit` tool for each replacement (one at a time)
2. Process files in order, matches within each file from bottom to top
   (to preserve line numbers for subsequent edits)
3. Report summary:

```
Applied 2 replacement(s) in 1 file(s) [LLM fallback]
```

---

## Section 5 — Limitations

### Accuracy

- LLM pattern matching is approximate. Complex AST patterns
  (nested structures, type-aware matching) may produce false positives
  or miss matches.
- Regex conversion cannot capture true AST structure — it matches
  text patterns, not parse tree nodes.
- Comments and string literals containing matching text may produce
  false positives (Step 3 of search attempts to filter these).

### Scale

- Works best for small-to-medium codebases (<500 files per language).
- For large projects (>1000 files), install `@ast-grep/napi` for
  performance and accuracy.
- The native tool processes ~1000 files in seconds; fallback may
  take significantly longer.

### Unsupported Features

The following ast-grep features are NOT available in fallback mode:

- **Rule-based matching**: `kind`, `has`, `inside`, `follows` constraints
- **Fix patterns**: `fix` field with auto-formatting
- **Multiple patterns**: combining patterns with `all`/`any`/`not`
- **Type-aware matching**: matching based on TypeScript/Flow types
- **Regex-in-pattern**: using regex inside AST patterns

### When to Escalate

Recommend installing the native tool when:

- The user needs exact AST precision (refactoring, linting)
- The codebase exceeds 500 files for the target language
- The pattern uses advanced features (rules, constraints)
- False positive rate from fallback is unacceptable
