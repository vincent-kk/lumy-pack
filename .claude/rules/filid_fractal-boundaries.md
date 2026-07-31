# Fractal Boundaries

> **Precedence**: repository instructions (CLAUDE.md, project rules) > repository conventions > this rule > filid defaults. On conflict, the higher source wins and this rule yields.

Fractal Context Architecture organizes a codebase as nested independent modules: a fractal owns a contract and a public boundary, and an organ is an internal compartment owned by exactly one fractal. This rule governs what a directory is and how anything outside it may reach in. This rule rests on properties every codebase has: directories contain files, and files reference one another.

**Tradeoff:** routing through an entry point costs one indirection per crossing, in exchange for a boundary you can change behind. **Applies when:** the repository has adopted FCA — module documents or a filid configuration are present.

Companion rules: `filid_module-documents.md` for the INTENT and DETAIL contracts, `filid_verification-records.md` for verification roles and caps, `filid_code-placement.md` for where a unit belongs and how it moves.

## 1. Classification comes from files that exist

**What a node is comes from what is on disk, in a fixed order — not from what it ought to be.**

| Type            | INTENT.md | Children | Entry point  | Meaning                                   |
| --------------- | --------- | -------- | ------------ | ----------------------------------------- |
| `fractal`       | required  | allowed  | required     | Independent module with a public contract |
| `organ`         | forbidden | files    | not required | Internal compartment owned by one fractal |
| `pure-function` | optional  | none     | not required | Explicitly isolated effect-free unit      |
| `hybrid`        | optional  | allowed  | required     | Manually assigned transitional node       |

- Resolve in this strict order: (1) `INTENT.md` present → fractal; (2) `DETAIL.md` present → fractal; (3) double-underscore-wrapped or dot-prefixed infrastructure name → organ; (4) directory name in the configured known organ list → organ; (5) a registered adapter reports a module index → fractal; (6) a leaf directory with no fractal children → organ; (7) an adapter proves both statelessness and no side effects → pure-function; (8) otherwise → organ.
- Step 5 reads one signal: a module index. Of the entry points an adapter reports, only a module entry classifies. An executable, framework or manifest entry, and any path injected by the config `entryPointOverrides`, never turns a directory into a fractal — they feed the entry-point surface, not classification. Without that split, markdown-as-implementation such as a skill document would make a directory a fractal and subject prose to rules written for code.
- Step 6 comes before purity on purpose, so `pure-function` is only ever reached by a directory that has children: a leaf that never claimed isolation is an organ even when nothing in it has an effect.
- Step 8 is organ on purpose: a directory that declares neither a document nor an index has never claimed an independent contract, and defaulting to fractal would manufacture "add a boundary document" demands from incidentals — whether a directory happens to have a subdirectory, for instance.
- Default organ names are `components`, `utils`, `types`, `hooks`, `helpers`, `lib`, `styles`, `assets`, `constants`, `test`, `tests`, `spec`, `specs`, `fixtures` and `e2e`. Docs-as-code compartment names such as `references`, `docs` or `plans` are deliberately absent — shipping one here would silently reclassify a real code module of that name as an organ. Config extends this list through `structure.additionalOrganNames`.

Ask yourself: "Which step in the order decided this — and does the file it names actually exist?"

## 2. Classification describes; it never prescribes

**What a node is and what it should be are different questions with different answers.**

- Traversal continues inside organs: a nested directory with its own documents or module index is reclassified as its own fractal.
- `hybrid` is never auto-assigned. An unsupported purity analysis is not proof of purity — an unproven node stays an organ.
- What a node _should_ be is a rule result, not a classification. An organ consumed from outside its owner's subtree has an external boundary, and that is reported with the consumer paths as evidence rather than by silently reclassifying it. Keeping the two apart is what lets a non-FCA codebase be adopted: the scan names the fractals that are missing instead of assuming them.

Ask yourself: "Am I reading what the tree says, or what I wish it said?"

## 3. A fractal is crossed through its entry point

**Outside consumers hold entry-point symbols; nothing else is theirs to reach.**

- Every fractal and hybrid has an adapter-reported module, executable, framework or manifest entry point. Organs and pure-function nodes do not need one.
- A package manifest is an entry point. Where an ecosystem declares a package's public surface in its manifest rather than in a module file, that declaration _is_ the boundary, and a package root that routes consumers through it has an entry point already — exempting the root instead would waive a requirement it meets. A manifest entry does not classify: it states a package's surface, not a directory's claim to be a module.
- The public surface is adapter-inspectable. An enumerated surface declares its exports by name, and widening it is a contract change. An opaque or unsupported framework surface keeps its certainty instead of passing.
- Sibling fractals import the sibling's entry point — never an internal file, and never a shared parent barrel that re-exports the sibling.
- Inside one fractal, files import concrete internal peers directly, not their own local entry point.

Ask yourself: "Does this import name a boundary, or reach past one?"

## 4. A fractal root holds documents and entry points, not code

**The root states the contract; the implementation lives one level in.**

- A fractal root contains its documents, adapter-reported entry points, at most one eponymous implementation, and adapter-confirmed framework peers.
- Any other implementation file belongs in an organ or a child fractal, unless config grants a scoped allowed-peer override.

Ask yourself: "If I list this directory, can I tell the contract from the implementation?"

## 5. Organ access is judged by where the consumer sits

**An organ has no entry point, so "route through the entry point" cannot apply to it.**

| Consumer                   | Path                            | Verdict                            |
| -------------------------- | ------------------------------- | ---------------------------------- |
| Inside the owner's subtree | organ file, directly            | allowed                            |
| Outside                    | the owner fractal's entry point | allowed — needs a retention reason |
| Outside                    | organ file, directly            | violation — unless exempted        |

- Inside the owner's subtree a nested fractal may import an organ's concrete files directly. That is the shape placement produces: shared code sits at the lowest common fractal of its consumers precisely so those descendants can use it.
- When the owner's entry point re-exports an organ symbol, external use is legitimate — but a unit with external consumers naturally belongs at _their_ lowest common fractal, so staying put is a deliberate choice that carries a reason.
- Direct import from outside is sometimes correct. The standing case is a build whose target cannot be represented by the entry point — for example, selecting one executable module instead of a package surface. Such an exemption is declared, not assumed, and it carries its reason.
- Both the retention reason and the direct-import exemption are declared in the owning fractal's `DETAIL.md`; the entry shape lives in `filid_module-documents.md`. An organ consumed from outside with neither is the signal that it has an external boundary — promote it to a fractal, or move it to its consumers' lowest common fractal. The finding names both resolutions and cites the consumer paths; it does not choose between them.
- The same declaration covers a fractal's internals. A consumer barred from the entry point by something the boundary cannot represent — a build selecting one executable module, for example — declares the exemption rather than widening the contract. Undeclared, it stays a violation.
- **A verification file is not judged by this rule at all, and its references do not close a cycle.** Verification exists to check a unit, and checking an internal unit means reaching it; the alternative is exporting internals for tests alone, which puts symbols on the public surface whose only consumer is a test. Which files are verification comes from the adapter, not from a filename pattern.

Ask yourself: "Does this consumer sit inside the owner's subtree — and if not, where is the declaration?"

## 6. The graph is acyclic and depth is a toll

**A cycle is two modules pretending to be one; a deep tree is a toll every reader pays.**

- Dependency edges point from consumers to entry points and form a DAG. A reported cycle carries its source files and resolved dependency evidence.
- A node stays within the configured structural depth, measured from the scanned project root over classified nodes.
- A pure-function node depends on no fractal or hybrid. Where isolation cannot be proven, reclassify the node or pass its dependencies in as inputs.
- Where evidence is missing the answer is `indeterminate` — an unresolved dependency that could change a cycle conclusion, or a file no adapter owns. `indeterminate` and `unsupported` are never converted to a pass.

Ask yourself: "Can I order these modules so every reference points one way — and do I have the evidence to say so?"

---

**This rule is working if:** a directory's type can be predicted from its files before any tool runs; imports name entry points rather than internals; every organ used from outside carries a declaration that says why. **This rule is wrong for you if:** the repository has not adopted FCA — then a scan names the fractals that are missing, and nothing here binds until you decide to add them.
