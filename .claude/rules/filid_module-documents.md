---
paths:
  - 'INTENT.md'
  - 'DETAIL.md'
---

# Module Documents

> **Precedence**: repository instructions (CLAUDE.md, project rules) > repository conventions > this rule > filid defaults. On conflict, the higher source wins and this rule yields.

A fractal's contract is written down beside its code: INTENT records the boundary, DETAIL records the current contract and — when a change is worth remembering — the history behind it. These rules define what those documents must contain to count as one. This rule rests on a property every FCA project has: a module's contract is written down in a file next to the code it governs.

**Tradeoff:** two documents per fractal to maintain, in exchange for a boundary a newcomer can read without running anything. **Applies when:** you are creating or editing an `INTENT.md` or a `DETAIL.md`.

## 1. INTENT records the boundary; DETAIL records the contract

**Two documents, two jobs — neither substitutes for the other.**

- The section headings `Purpose`, `Structure`, `Conventions`, `Boundaries`, `Always do`, `Ask first`, `Never do` and `Dependencies` in INTENT, and `Requirements`, `API Contracts`, `Acceptance Criteria` and `Last Updated` in DETAIL, stay in English. Descriptive content follows `[filid:lang]`, defaulting to English.
- INTENT records only this fractal's own purpose, ownership and boundaries — never a copy of an ancestor's. Update it only when the public boundary or contract changes.
- When a directory's conventional name misleads, say so in `Structure`.

Ask yourself: "Is this fact about the module's boundary, or about its current contract?"

## 2. INTENT is at most 50 lines and names its three boundaries

**A boundary document that needs scrolling is not a boundary document.**

- `INTENT.md` is at most 50 lines.
- It contains `Always do`, `Ask first` and `Never do` sections. A boundary with no "never" has not been decided yet.

Ask yourself: "Can a newcomer read this whole file before deciding what to touch?"

## 3. An organ has no INTENT

**Independent documentation is a claim to an independent contract.**

- An organ does not contain `INTENT.md`, and does not use INTENT as local documentation.
- If a directory genuinely needs its own boundary document, that is the signal to reclassify it as a fractal — with an entry point — not to add the file where it stands.

Ask yourself: "Does this directory want its own boundary, or does it belong inside its owner's?"

## 4. DETAIL's contract sections are current state, not an append-only ledger

**A contract that only grows stops describing anything.**

- Restructure the contract sections to the currently intended behavior on every update. A superseded clause is removed, not left standing beside its replacement.
- Update DETAIL before the code it describes.
- Acceptance groups carry stable IDs, unique within that document.
- `DETAIL.md` is the sole acceptance-criteria ledger. A legacy `.filid/criteria.md` is reported as such — never auto-deleted, never silently migrated.

Ask yourself: "Does this document describe the code as it should be now, or as it has been?"

## 5. History has one address, and the contract is not it

**Every other surface answers "what holds now"; one section answers "how it got here".**

- INTENT carries no history — no changelog, no dated notes, no record of a boundary it used to draw. It has 50 lines to state the boundary that holds today, and a retired boundary leaves by deletion, not by annotation.
- The code carries none either. A module keeps its history in the documents beside it, not in the source it describes.
- `## History` in DETAIL is the one place the past is written down. The section is optional, sits below the contract sections and above `## Last Updated`, and lists entries newest first. Record the decision and the reason it was taken or reversed — the diff itself is version control's job, not this section's.
- `## Last Updated` names the most recent change; `## History` keeps the earlier ones that are still worth carrying. An entry that no longer informs a present decision is dropped, not archived deeper.
- A history entry accompanies the contract change that produced it. An edit that only appends an entry is the append-only pattern §4 rejects.

Ask yourself: "Is this sentence what holds now, or how it came to hold — and is it in the section for that?"

## 6. An exemption without a reason is a disabled rule in costume

**`Reason` is the load-bearing field.**

- `Boundary Exemptions` is conditional: present only when this fractal actually grants one, and a fractal that needs one and has no `DETAIL.md` adds the document for this purpose. `## Organ Exemptions` is the same syntax under this section's former name and is still read.
- The target is an organ path or a path inside this fractal — a consumer that cannot route through the entry point needs the same escape hatch either way. A path names itself and everything under it.
- Write the target path, each consumer and the direct-import verdict inside a code span. A markdown formatter reads a bare `__tests__` as emphasis and writes the heading back as `**tests**`, silently pointing the exemption at a path that does not exist; the span survives the formatter, and the parser strips it before comparing. A bare value is still read, so the span costs nothing and is the safe default. `Reason` is prose and keeps its own backticks.
- An entry uses the acceptance-group shape, so one parser reads both:

```md
## Boundary Exemptions

### `<target path>` — <short title>

- **Consumers**: <paths or globs, or `entry-point` when access is through the barrel>
- **Direct import**: `allowed` | `not allowed`
- **Reason**: <why the barrel cannot serve these consumers, or why the unit has not
  moved to its consumers' lowest common fractal>
```

- A missing or empty `Reason` is an unmet contract, not a granted exemption.

Ask yourself: "Would someone who has never seen this code understand why the exemption exists?"

---

**This rule is working if:** every fractal's boundary fits on one screen; DETAIL diffs read as contract changes rather than appended notes; the only past tense in the tree sits under a `## History` heading; every exemption in the tree is explained by reading its own entry. **This rule is wrong for you if:** the directory is an organ, or a part of the tree that has not adopted FCA — then it has no contract of its own to document, and adding one is the wrong move.
