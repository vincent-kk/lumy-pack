# Fractal Boundaries

> **Precedence**: repository instructions (CLAUDE.md, project rules) > repository conventions > this rule > filid defaults — the higher source wins. Fractal Context Architecture organizes a codebase as nested independent modules: a fractal owns a contract and a public boundary; an organ is an internal compartment owned by exactly one fractal. This rule rests on properties every codebase has: directories contain files, and files reference one another. Applies when the repository has adopted FCA — module documents or a filid configuration are present. Companions: `filid_module-documents.md` (INTENT/DETAIL contracts), `filid_verification-records.md` (verification roles and caps), `filid_code-placement.md` (where a unit belongs and how it moves).

## 1. Classification comes from files that exist

| Type            | INTENT.md | Children | Entry point  | Meaning                                   |
| --------------- | --------- | -------- | ------------ | ----------------------------------------- |
| `fractal`       | required  | allowed  | required     | Independent module with a public contract |
| `organ`         | forbidden | files (nested dirs classify on their own) | not required | Internal compartment owned by one fractal |
| `pure-function` | optional  | none     | not required | Explicitly isolated effect-free unit      |
| `hybrid`        | optional  | allowed  | required     | Manually assigned transitional node       |

Resolve in this strict order: (1) `INTENT.md` present → fractal; (2) `DETAIL.md` present → fractal — a missing-INTENT signal; (3) double-underscore-wrapped or dot-prefixed infrastructure name → organ; (4) name in the known organ list → organ; (5) a registered adapter reports a **module** index → fractal; (6) a leaf directory with no fractal children → organ; (7) an adapter proves both statelessness and no side effects → pure-function; (8) otherwise → organ.

- Step 5 reads module entries only. Executable, framework and manifest entries — and any `entryPointOverrides` path — feed the entry-point surface, never classification; otherwise markdown-as-implementation (a skill document) would turn a prose directory into a fractal.
- Step 6 precedes purity on purpose: a leaf that never claimed isolation is an organ even when nothing in it has an effect. Step 8 defaults to organ on purpose: a directory that declares neither a document nor an index has never claimed an independent contract.
- Default organ names: `components`, `utils`, `types`, `hooks`, `helpers`, `lib`, `styles`, `assets`, `constants`, `test`, `tests`, `spec`, `specs`, `fixtures`, `e2e`. Docs-as-code names (`references`, `docs`, `plans`) are deliberately absent — adding one would silently reclassify a real code module of that name. Config extends the list via `structure.additionalOrganNames`.

## 2. Classification describes; it never prescribes

Traversal continues inside organs: a nested directory with its own documents or module index is reclassified as its own fractal. `hybrid` is never auto-assigned, and an unproven purity analysis stays an organ. What a node _should_ be is a rule result, not a classification: an organ consumed from outside its owner's subtree is reported with the consumer paths as evidence, never silently reclassified — which is what lets a non-FCA codebase be adopted.

## 3. A fractal is crossed through its entry point

- Every fractal and hybrid has an adapter-reported module, executable, framework or manifest entry point; organs and pure-function nodes need none.
- A package manifest is an entry point: where the ecosystem declares the package's public surface in its manifest, that declaration IS the boundary. A manifest entry states a surface; it does not classify.
- The public surface is adapter-inspectable: an enumerated surface declares its exports by name, and widening it is a contract change. An opaque or unsupported framework surface keeps its uncertainty instead of passing.
- Sibling fractals import the sibling's entry point — never an internal file, and never a shared parent barrel that re-exports the sibling.
- Inside one fractal, files import concrete internal peers directly, not their own local entry point.

## 4. A fractal root holds documents and entry points, not code

A fractal root contains its documents, adapter-reported entry points, at most one eponymous implementation, and adapter-confirmed framework peers. Any other implementation file belongs in an organ or a child fractal, unless config grants a scoped allowed-peer override.

## 5. Organ access is judged by where the consumer sits

An organ has no entry point, so "route through the entry point" cannot apply to it.

| Consumer                   | Path                            | Verdict                            |
| -------------------------- | ------------------------------- | ---------------------------------- |
| Inside the owner's subtree | organ file, directly            | allowed                            |
| Outside                    | the owner fractal's entry point | allowed — needs a retention reason |
| Outside                    | organ file, directly            | violation — unless exempted        |

- Inside the owner's subtree a nested fractal may import an organ's concrete files directly — that is the shape lowest-common-fractal placement produces.
- A unit with external consumers naturally belongs at _their_ lowest common fractal, so staying put is a deliberate choice that carries a reason. A direct import from outside is sometimes correct — the standing case is a build whose target the entry point cannot represent — but it is declared, not assumed. Both declarations live in the owning fractal's `DETAIL.md` (entry shape in `filid_module-documents.md`). An organ consumed from outside with neither declaration has an external boundary: the finding names both resolutions — promote it to a fractal, or move it to its consumers' lowest common fractal — and cites the consumer paths.
- The same declaration covers a fractal's internals: a consumer barred from the entry point by something the boundary cannot represent declares the exemption rather than widening the contract. Undeclared, it stays a violation.
- **A verification file is not judged by this rule at all, and its references do not close a cycle.** Checking an internal unit means reaching it; the alternative exports internals for tests alone. Which files are verification comes from the adapter, not from a filename pattern.

## 6. The graph is acyclic and depth is a toll

- Dependency edges point from consumers to entry points and form a DAG; a reported cycle carries its source files and resolved dependency evidence.
- A node stays within the configured structural depth, measured from the scanned project root over classified nodes.
- A pure-function node depends on no fractal or hybrid; where isolation cannot be proven, reclassify the node or pass its dependencies in as inputs.
- Where evidence is missing the answer is `indeterminate` — and `indeterminate` and `unsupported` are never converted to a pass.

---

**This rule is working if:** a directory's type can be predicted from its files before any tool runs, and every organ used from outside carries a declaration that says why. **This rule is wrong for you if:** the repository has not adopted FCA — then a scan names the fractals that are missing, and nothing here binds until you decide to add them.
