# promote — Reference Documentation

Detailed workflow, eligibility rules, and spec generation logic for the
promote skill. For the quick-start guide, see [SKILL.md](./SKILL.md).

## Section 1 — Discovery Details

Locate all `test.ts` files and analyze their content:

```
testFiles = glob("**/test.ts", root: targetPath ?? cwd)

for each file in testFiles:
    metrics = test-metrics(action: "count", files: [{ filePath: file, content: readFile(file) }])
    // Returns: { file, basic: number, complex: number, total: number,
    //            stableDays: number, lastFailure: string | null }
```

## Section 2 — Eligibility Rules

Apply promotion eligibility criteria:

```
DEFAULT_STABILITY_DAYS = 90

function checkPromotionEligibility(metrics, stabilityThreshold):
    eligible = (
        metrics.stableDays >= stabilityThreshold &&
        metrics.lastFailure === null
    )
    return { file: metrics.file, eligible, reason: ineligibilityReason }
```

Ineligibility reasons:

- `stableDays < threshold` — file has not been stable long enough
- `lastFailure !== null` — file has a recent recorded failure

Candidate list format:

```
Promotion candidates (5 files found):
  ✓ src/core/test.ts          — stable 120 days, 0 failures  → ELIGIBLE
  ✓ src/parser/test.ts        — stable 95 days, 0 failures   → ELIGIBLE
  ✗ src/commands/test.ts      — stable 45 days               → INELIGIBLE (45 < 90)
  ✗ src/utils/test.ts         — last failure: 2026-01-10     → INELIGIBLE (recent failure)
  ✓ src/schemas/test.ts       — stable 200 days, 0 failures  → ELIGIBLE
```

## Section 3 — Pattern Analysis

For each eligible file, analyze internal test structure:

- Read test.ts and identify all test cases
- Categorize each case as basic (simple assertion, single path) or complex
  (multiple assertions, branching, setup/teardown, mocked dependencies)
- Identify duplicate or structurally identical test cases
- Map test inputs/outputs that can be expressed as parameter rows
- Determine if total cases exceed 15 and which can be consolidated

## Section 4 — Spec Generation (3+12 Rule)

Generate a parameterized `spec.ts`:

```
for each eligible file:
    specContent = buildSpec({
        basicTests:   select up to 3 representative basic cases,
        complexTests: select up to 12 representative complex cases,
        parameterize: group duplicate patterns into data-driven test rows,
        consolidate:  merge structurally identical cases into single parameterized tests
    })

    // Total cases in generated spec.ts must be <= 15
    assert(specContent.totalCases <= TEST_THRESHOLD)
```

**3+12 rule:**

- `basic` cases: ≤ 3 — straightforward happy-path or single-condition tests
- `complex` cases: ≤ 12 — multi-condition, parameterized, or integration-level tests
- `total`: ≤ 15 — hard ceiling enforced before writing

## Section 5 — Validation and Migration

### Validation

```
for each generated spec:
    result = test-metrics(action: "check-312", files: [{ filePath: generatedSpec, content: readFile(generatedSpec) }])
    // Must return: { pass: true, basic: <=3, complex: <=12, total: <=15 }

    if not result.pass:
        adjustAndRetry(spec, result)   // Trim lowest-value cases until compliant
```

### Migration

```
for each validated spec:
    write(file.replace("test.ts", "spec.ts"), specContent)
    delete(originalTestTs)
    log("Promoted: " + originalTestTs + " → " + specPath)
```

Final report format:

```
Promotion complete (2/3 eligible files promoted):
  ✓ src/core/test.ts     → src/core/spec.ts     (15 cases: 3 basic + 12 complex)
  ✓ src/parser/test.ts   → src/parser/spec.ts   (11 cases: 2 basic + 9 complex)
  ✗ src/schemas/test.ts  → skipped (validation failed after 2 retries — manual review needed)
```

## MCP Tool Examples

**test-metrics count:**

```
test-metrics(action: "count", files: [{ filePath: "src/core/test.ts", content: readFile("src/core/test.ts") }])
// Returns:
// {
//   file: "src/core/test.ts",
//   basic: 4,
//   complex: 18,
//   total: 22,
//   stableDays: 120,
//   lastFailure: null
// }
```

**test-metrics check-312:**

```
test-metrics(action: "check-312", files: [{ filePath: "src/core/spec.ts", content: readFile("src/core/spec.ts") }])
// Returns:
// { file: "src/core/spec.ts", basic: 3, complex: 12, total: 15, pass: true }
```
