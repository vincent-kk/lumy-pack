---
paths:
  - '*.test.*'
  - '*.spec.*'
  - '*_test.*'
  - '*_spec.*'
  - 'test_*.*'
  - '*Test.*'
  - '*Tests.*'
  - '*Spec.*'
  - 'conftest.py'
  - '__tests__'
  - 'test'
  - 'tests'
  - 'spec'
  - 'specs'
  - 'e2e'
---

# Verification Records

> **Precedence**: repository instructions (CLAUDE.md, project rules) > repository conventions > this rule > filid defaults. On conflict, the higher source wins and this rule yields.

A verification file serves one of two roles: a spec-document is the current executable contract, a test-record is QA, regression and incident history. These rules define the cap each role carries and how its cases are counted. This rule rests on a property every codebase has: verification files exist, and their cases can be counted.

**Tradeoff:** classifying and splitting verification files costs a decision per file, in exchange for a contract you can read in one sitting. **Applies when:** you are creating or editing a verification file.

## 1. Verification files hold roles, not ranks

**A test-record is not a junior spec-document waiting for promotion.**

- The adapter assigns the role from the file's content, independent of its filename.
- A `spec-document` is the current executable contract. A `test-record` is QA, regression and incident history.
- Test-records are never promoted into spec-documents. A record of what once broke is not a statement of what must hold.

Ask yourself: "Is this file stating the contract, or remembering an incident?"

## 2. A spec-document holds 15 cases; a test-record holds 32 per file

**The cap is per file, and it caps cases — not coverage.**

- A spec-document contains at most 15 semantic cases.
- A test-record contains at most 32 semantic cases per file. Project-wide test-record file and case totals are unlimited — nothing here limits how much you verify.

Ask yourself: "Am I over the cap because this file has too many cases, or because it holds two subjects?"

## 3. What cannot be counted is indeterminate, never a pass

**The counting rules are fixed; where they do not reach, the answer says so.**

- A normal case, a skip or a todo counts as one.
- Statically enumerable parameter rows count by row, and a case inside a static parameterized suite multiplies by that suite's row count.
- A property declaration counts as one, regardless of how many trials it generates.
- Dynamic tables, unknown wrappers and ambiguous aliases are `indeterminate`. `indeterminate` and `unsupported` are never converted to a pass.

Ask yourself: "Can this count be derived statically — and if not, have I said so instead of guessing?"

## 4. Never remove coverage to meet a cap

**Curate by splitting and merging; never by discarding.**

- Split test-records by behavior or by incident.
- Organize spec-documents by non-overlapping acceptance groups.
- Deleting a case to get under a cap trades real verification for a green number.

Ask yourself: "Did this file get smaller because it got organized, or because it verifies less?"

## 5. Multiple spec-documents bind to distinct acceptance groups

**Splitting a file must not split a contract.**

- Sibling spec-documents must not declare overlapping contract group sets, and one acceptance group is never split across files to evade the cap.
- When a fractal has more than one spec-document, it has a DETAIL document.
- Each spec-document declares at least one existing DETAIL acceptance group through the adapter-recognized `filid:contract <group-id>` marker.

Ask yourself: "Which acceptance group does this file answer for — and does a sibling claim the same one?"

---

**This rule is working if:** every verification file's role is obvious from its content; case counts are derivable without running anything; a split file still maps to exactly one acceptance group. **This rule is wrong for you if:** the file is a throwaway probe that will never land in version control — then no cap applies, because there is no contract to keep.
