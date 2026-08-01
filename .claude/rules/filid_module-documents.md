---
paths:
  - 'INTENT.md'
  - 'DETAIL.md'
---

# Module Documents

> **Precedence**: repository instructions (CLAUDE.md, project rules) > repository conventions > this rule > filid defaults — the higher source wins. INTENT records the boundary; DETAIL records the current contract and, when a change is worth remembering, the history behind it. This rule rests on a property every FCA project has: a module's contract is written down in a file next to the code it governs. Applies when you are creating or editing an `INTENT.md` or a `DETAIL.md`.

## 1. INTENT records the boundary; DETAIL records the contract

Two documents, two jobs — neither substitutes for the other. The section headings `Purpose`, `Structure`, `Conventions`, `Boundaries`, `Always do`, `Ask first`, `Never do` and `Dependencies` in INTENT, and `Requirements`, `API Contracts`, `Acceptance Criteria` and `Last Updated` in DETAIL, stay in English; descriptive content follows `[filid:lang]`, defaulting to English. INTENT records only this fractal's own purpose, ownership and boundaries — never a copy of an ancestor's — and updates only when the public boundary or contract changes. When a directory's conventional name misleads, say so in `Structure`.

## 2. INTENT is at most 50 lines and names its three boundaries

A boundary document that needs scrolling is not a boundary document. `INTENT.md` is at most 50 lines and contains `Always do`, `Ask first` and `Never do` sections — a boundary with no "never" has not been decided yet.

## 3. An organ has no INTENT

Independent documentation is a claim to an independent contract. An organ does not contain `INTENT.md`, and does not use INTENT as local documentation. If a directory genuinely needs its own boundary document, that is the signal to reclassify it as a fractal — with an entry point — not to add the file where it stands.

## 4. DETAIL's contract sections are current state, not an append-only ledger

Restructure the contract sections to the currently intended behavior on every update; a superseded clause is removed, not left standing beside its replacement. Update DETAIL before the code it describes. Acceptance groups carry stable IDs, unique within that document. `DETAIL.md` is the sole acceptance-criteria ledger; a legacy `.filid/criteria.md` is reported as such — never auto-deleted, never silently migrated.

## 5. History has one address, and the contract is not it

INTENT carries no history — no changelog, no dated notes; a retired boundary leaves by deletion, not by annotation. The code carries none either. `## History` in DETAIL is the one place the past is written down: optional, below the contract sections and above `## Last Updated`, entries newest first, recording the decision and the reason it was taken or reversed — the diff itself is version control's job. An entry that no longer informs a present decision is dropped, not archived deeper. A history entry accompanies the contract change that produced it; an edit that only appends an entry is the append-only pattern §4 rejects.

## 6. An exemption without a reason is a disabled rule in costume

`Reason` is the load-bearing field. `Boundary Exemptions` is conditional — present only when this fractal actually grants one (`## Organ Exemptions` is the same syntax under this section's former name and is still read); a fractal that needs one and has no `DETAIL.md` adds the document for this purpose. The target is an organ path or a path inside this fractal — a path names itself and everything under it. Write the target path, each consumer and the direct-import verdict inside a code span: a markdown formatter reads a bare `__tests__` as emphasis and silently corrupts the heading; the span survives the formatter, and the parser strips it before comparing. An entry uses the acceptance-group shape, so one parser reads both:

```md
## Boundary Exemptions

### `<target path>` — <short title>

- **Consumers**: <paths or globs, or `entry-point` when access is through the barrel>
- **Direct import**: `allowed` | `not allowed`
- **Reason**: <why the barrel cannot serve these consumers, or why the unit has not
  moved to its consumers' lowest common fractal>
```

A missing or empty `Reason` is an unmet contract, not a granted exemption.

---

**This rule is working if:** every fractal's boundary fits on one screen, and the only past tense in the tree sits under a `## History` heading. **This rule is wrong for you if:** the directory is an organ, or a part of the tree that has not adopted FCA — then it has no contract of its own to document, and adding one is the wrong move.
