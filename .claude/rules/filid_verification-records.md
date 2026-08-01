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

> **Precedence**: repository instructions (CLAUDE.md, project rules) > repository conventions > this rule > filid defaults — the higher source wins. A verification file serves one of two roles: a spec-document is the current executable contract; a test-record is QA, regression and incident history. This rule rests on a property every codebase has: verification files exist, and their cases can be counted. Applies when you are creating or editing a verification file.

## 1. Verification files hold roles, not ranks

The adapter assigns the role from the file's content, independent of its filename. Test-records are never promoted into spec-documents — a record of what once broke is not a statement of what must hold.

## 2. A spec-document holds 15 cases; a test-record holds 32 per file

The cap is per file, and it caps cases — not coverage. Project-wide test-record file and case totals are unlimited: nothing here limits how much you verify.

## 3. What cannot be counted is indeterminate, never a pass

A normal case, a skip or a todo counts as one. Statically enumerable parameter rows count by row, and a case inside a static parameterized suite multiplies by that suite's row count. A property declaration counts as one, regardless of how many trials it generates. Dynamic tables, unknown wrappers and ambiguous aliases are `indeterminate` — and `indeterminate` and `unsupported` are never converted to a pass.

## 4. Never remove coverage to meet a cap

Curate by splitting and merging, never by discarding: split test-records by behavior or by incident; organize spec-documents by non-overlapping acceptance groups. Deleting a case to get under a cap trades real verification for a green number.

## 5. Multiple spec-documents bind to distinct acceptance groups

Splitting a file must not split a contract. Sibling spec-documents must not declare overlapping contract group sets, and one acceptance group is never split across files to evade the cap. When a fractal has more than one spec-document, it has a DETAIL document, and each spec-document declares at least one existing DETAIL acceptance group through the adapter-recognized `filid:contract <group-id>` marker.

---

**This rule is working if:** every verification file's role is obvious from its content, and case counts are derivable without running anything. **This rule is wrong for you if:** the file is a throwaway probe that will never land in version control — then no cap applies, because there is no contract to keep.
