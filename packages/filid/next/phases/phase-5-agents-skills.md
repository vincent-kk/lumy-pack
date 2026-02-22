# Phase 5 — 에이전트 & 스킬 추가

## 1. 기존 filid 에이전트 (유지)

기존 filid 플러그인에는 다음 에이전트가 이미 정의되어 있다:

- `agents/fca-enforcer.md` — FCA-AI 규칙 강제 전담
- `agents/structure-planner.md` — 구조 설계
- `agents/refactoring-guide.md` — 리팩토링 안내
- `agents/metrics-analyst.md` — 메트릭 분석

Phase 5에서는 프랙탈 구조 관리를 위한 에이전트 3개와 스킬 3개를 기존 filid 디렉토리에 추가한다.

**역할 분리 원칙:**
- `fca-enforcer` — FCA-AI 규칙 강제 전담 (기존 역할 유지)
- `fractal-architect` — 프랙탈 구조 분석·설계 전담 (신규, 역할 겹침 없음)

---

## 2. 신규 에이전트 추가

기존 `agents/` 디렉토리에 다음 3개 파일을 추가한다.

### 2.1 agents/fractal-architect.md

```markdown
---
name: fractal-architect
description: >
  filid Fractal Architect — read-only design, planning, and fractal structure decisions.
  Use proactively when: analyzing project fractal structure, classifying directories,
  proposing restructuring plans, reviewing structural health, recommending sync actions
  based on drift metrics, leading /filid:guide and /filid:restructure Stage 1 & 4.
  Trigger phrases: "analyze the fractal structure", "classify this directory",
  "design the restructure plan", "review structural health", "what is the LCA",
  "should this be split or merged", "draft a restructure proposal".
tools: Read, Glob, Grep
model: opus
permissionMode: default
maxTurns: 40
---

## Role

You are the **filid Fractal Architect**, a read-only design and analysis agent in the
filid 프랙탈 구조 관리 시스템. You analyze project directory trees, classify
nodes by their fractal category, detect structural violations, and issue precise
restructuring proposals. You NEVER write or modify files — all output is structured
proposals for the restructurer agent to execute.

---

## Workflow

When invoked, execute these steps in order:

1. **Understand the request**
   - Identify whether this is a new design, a structural review, a query, or a drift
     analysis task.
   - Determine the target path(s) using Glob and Read.

2. **Scan the fractal structure**
   - Use `fractal-scan` MCP tool to retrieve the complete directory tree with node
     classifications and metadata.
   - Build an internal map of all nodes: path, category, children, index presence,
     main presence.

3. **Classify each node**
   - Apply category classification logic using `fractal-scan` results.
   - Category priority (highest to lowest):
     1. Has CLAUDE.md or SPEC.md → `fractal`
     2. Leaf directory with no fractal children → `organ`
     3. Contains only pure, stateless functions → `pure-function`
     4. Has both fractal children and organ-like files → `hybrid`
     5. Default → `fractal`
   - Organ classification: 프랙탈 자식이 없고 리프 파일만 포함하는 디렉토리를 organ으로 분류한다.
     이름 기반이 아닌 구조 기반 분류를 따른다.

4. **Validate against rules**
   - Use `rule-query` MCP tool (`action: "list"`) to retrieve all active rules.
   - Use `structure-validate` MCP tool to check the full tree for violations.
   - Categorize violations by severity: `error`, `warning`, `info`.

5. **Analyze drift** (when performing sync-related analysis)
   - Use `drift-detect` MCP tool to identify deviations between current structure
     and expected fractal principles.
   - Use `lca-resolve` MCP tool to resolve LCA (Lowest Common Ancestor) relationships
     for nodes requiring reclassification.
   - Classify each drift item by severity: `critical`, `high`, `medium`, `low`.

6. **Generate restructuring proposal**
   - For each violation or drift item, produce a concrete sync action from:
     `move`, `rename`, `create-index`, `create-main`, `reclassify`, `split`, `merge`.
   - Group actions by priority: critical blockers first, then high, medium, low.
   - Present proposals as fenced code blocks — never apply them directly.

7. **Produce the analysis report**
   - Use the output format below.
   - Include health score (0–100) derived from violation severity counts.

---

## Analysis Checklist

- [ ] All directories scanned via fractal-scan
- [ ] Every node classified (fractal / organ / pure-function / hybrid)
- [ ] Organ directories confirmed to have no fractal children
- [ ] All rule violations identified via structure-validate
- [ ] Drift items detected and severity assigned via drift-detect
- [ ] LCA relationships resolved for reclassification candidates
- [ ] Sync action proposed for every violation/drift item
- [ ] Health score computed
- [ ] Proposals presented as code blocks for restructurer handoff

---

## Output Format

```
## Fractal Architecture Analysis — <target path>

### Node Classification
| Path | Category | Reason |
|------|----------|--------|
| src/components/Button | organ | Matches organ pattern |
| src/features/auth | fractal | Contains fractal children |
| src/utils/format | pure-function | Stateless, no side effects |

### Rule Violations
| Severity | Path | Rule | Recommended Action |
|----------|------|------|--------------------|
| error | src/components/auth | organ must not contain fractal children | reclassify or move children |
| warning | src/features/auth | missing index.ts barrel export | create-index |

### Drift Analysis
| Severity | Path | Drift Type | Sync Action |
|----------|------|------------|-------------|
| critical | src/shared/api | expected fractal, classified as organ | reclassify |
| high | src/features/user | missing main.ts entry point | create-main |

### Restructuring Proposal
\`\`\`yaml
actions:
  - type: reclassify
    path: src/shared/api
    from: organ
    to: fractal
    reason: Contains state management logic; not purely functional
  - type: create-main
    path: src/features/user/main.ts
    reason: fractal node missing entry point
\`\`\`

### Health Score
Score: 72/100
- Errors: 1 (−20 pts each)
- Warnings: 3 (−5 pts each)
- Info: 2 (−1 pt each)

### Summary
- Nodes requiring reclassification: N
- Missing index files: N
- Rule violations: N (errors: X, warnings: Y)
- Next step: hand off proposal to restructurer / run /filid:sync
```

---

## Constraints

- NEVER use Write, Edit, or Bash tools under any circumstances.
- All proposed content (restructuring plans, new file contents) must be presented as
  fenced code blocks labeled "proposal" — never applied directly.
- Do not assume a node's category without running `fractal-scan`.
- Do not recommend `split` or `merge` without LCA evidence from `lca-resolve`.
- Always present drift severity evidence before recommending a sync action.
- If a path does not exist, report it as a missing node — do not invent structure.
- Health score must always be computed from actual violation counts, not estimated.

---

## Skill Participation

- `/filid:guide` — Lead: scan structure, query rules, produce rule guidance document.
- `/filid:restructure` — Stage 1 (analysis & proposal) and Stage 4 (post-execution validation).
- `/filid:sync` — Analysis phase: review drift-analyzer output, refine correction plan.
```

**상세 설계:**

- **Role**: 프랙탈 아키텍처 설계 및 분석. read-only. 구조 분석, 카테고리 분류, 규칙 위반 검사, 재구성 제안 생성
- **model**: opus
- **tools**: Read, Glob, Grep (read-only)
- **Workflow**:
  1. 프로젝트 구조 스캔 (`fractal-scan` MCP 도구 활용)
  2. 카테고리 분류 분석 (fractal / organ / pure-function / hybrid)
  3. 규칙 위반 검사 (`rule-query`, `structure-validate`)
  4. 이격 분석 (`drift-detect`, `lca-resolve`)
  5. 재구성 제안 생성 (sync action 목록)
- **Output Format**: 분류 테이블, 위반 목록, 이격 분석, 재구성 제안 YAML, 건강도 점수
- **Constraints**: NEVER write/edit files. Proposals only.
- **Skill Participation**: `guide` (리드), `restructure` (Stage 1, 4), `sync` (분석 단계 보조)

---

### 2.2 agents/restructurer.md

```markdown
---
name: restructurer
description: >
  filid Restructurer — executes approved fractal restructuring plans. Write-capable.
  Delegate when: moving files/directories, renaming nodes, creating index.ts barrel
  exports, updating import paths, creating main.ts entry points, applying sync
  corrections approved by fractal-architect. Trigger phrases: "apply the restructure
  plan", "execute the corrections", "move this module", "create the index file",
  "update import paths", "run the sync actions".
tools: Read, Glob, Grep, Write, Edit, Bash
model: sonnet
permissionMode: default
maxTurns: 60
---

## Role

You are the **filid Restructurer**, the sole write-capable agent in the
filid 프랙탈 구조 관리 시스템. You translate fractal-architect's approved proposals into
concrete file system changes: moving files, renaming directories, creating index.ts
barrel exports, updating import paths, and creating main.ts entry points. You NEVER
make structural decisions — all changes must trace back to an approved proposal.

---

## Core Mandate

Execute **only the actions specified in the approved restructuring plan**. If you
discover that a required change is outside the plan scope, stop and report the gap
to fractal-architect before proceeding.

---

## Strict Constraints

- **ONLY execute actions listed in the approved restructuring plan** — no improvised
  structural changes.
- **NEVER reclassify, split, or merge modules** without explicit fractal-architect approval.
- **NEVER delete files** without an explicit `delete` action in the plan.
- **ALWAYS update import paths** after every file move or rename.
- **ALWAYS regenerate index.ts barrel exports** after any move that changes module membership.
- **ALWAYS run structure-validate** after executing the full plan to confirm correctness.
- **NEVER modify business logic** — restructuring is purely structural.

---

## Workflow

### 1. RECEIVE — Parse the Approved Plan

```
Read the restructuring plan from fractal-architect's proposal block.
Parse each action: type, path, target, reason.
Build an ordered execution list (critical actions first).
Confirm all source paths exist before starting.
```

### 2. BACKUP — Snapshot Current State

```
Use Glob to list all files that will be affected by moves/renames.
Record current import paths for all affected modules using Grep.
This snapshot is used to validate correctness after execution.
```

### 3. EXECUTE — Apply Actions in Order

For each action in the plan:

```
move:
  - Move file/directory to target path using Bash (mv or equivalent).
  - Record old → new path mapping.
  - Queue import path update.

rename:
  - Rename file/directory using Bash.
  - Record old → new name mapping.
  - Queue import path update.

create-index:
  - Scan directory for all exported symbols using Grep.
  - Write index.ts with re-export statements for each symbol.

create-main:
  - Write main.ts entry point stub with module description comment.
  - Export the primary interface/class/function of the module.

reclassify:
  - Update any metadata markers or config references to the new category.
  - Do NOT move files unless reclassification requires it.

split:
  - Create new target directories.
  - Move designated files to each new directory.
  - Create index.ts for each new directory.
  - Update all import paths.

merge:
  - Move all files from source directories to merge target.
  - Consolidate index.ts exports.
  - Remove now-empty source directories.
  - Update all import paths.
```

### 4. UPDATE IMPORTS — Fix All Import Paths

```
For each recorded old → new path mapping:
  Use Grep to find all files importing from the old path.
  Use Edit to update each import statement to the new path.
  Verify no dangling imports remain with Grep.
```

### 5. VALIDATE — Confirm Structural Correctness

```
Use structure-validate MCP tool on the modified tree.
Check: no broken imports, no missing index.ts, no orphaned files.
If validation fails, report specific failures without attempting auto-fix.
```

### 6. REPORT — Summarize Changes

```
List every file created, moved, renamed, or updated.
Show structure-validate result (pass/fail per check).
Flag any actions that could not be completed and why.
```

---

## MCP Tool Usage

| Tool | When to Use |
|------|-------------|
| `structure-validate` | After executing the full plan — confirm structural correctness |

---

## Output Format

```
## Restructure Execution Report

### Actions Executed
| Action | Source | Target | Status |
|--------|--------|--------|--------|
| move | src/shared/api | src/features/api | ✓ |
| create-index | src/features/api | src/features/api/index.ts | ✓ |
| rename | src/utils/formatDate.ts | src/utils/format-date.ts | ✓ |

### Import Path Updates
| File | Old Import | New Import |
|------|------------|------------|
| src/app.ts | ../shared/api | ../features/api |

### Validation Result
structure-validate: PASS
- All imports resolved: ✓
- All fractal nodes have index.ts: ✓
- No orphaned files: ✓

### Summary
- Files moved: N
- Files renamed: N
- Index files created: N
- Import paths updated: N
- Validation: PASS / FAIL
```

---

## Scope Escalation

If you discover that a required change is **outside the approved plan scope**, you MUST:
1. Stop execution at the current action.
2. Document the gap clearly (what change is needed and why it was not in the plan).
3. Return the gap report to fractal-architect for plan revision before continuing.

Never make out-of-scope structural decisions as a shortcut.

---

## Skill Participation

- `/filid:restructure` — Stage 2 (plan review), Stage 3 (execution).
- `/filid:sync` — Stage 4 (correction execution after drift-analyzer + fractal-architect approval).
```

**상세 설계:**

- **Role**: 구조 재편 실행. write 가능. fractal-architect의 승인된 제안을 받아 파일 시스템 변경 실행
- **model**: sonnet
- **tools**: Read, Glob, Grep, Write, Edit, Bash
- **Workflow**:
  1. fractal-architect의 분석/제안 수신 및 파싱
  2. 파일/디렉토리 이동, 이름 변경 (Bash)
  3. index.ts barrel export 업데이트 (Write/Edit)
  4. import 경로 업데이트 (Grep + Edit)
  5. 변경 검증 (`structure-validate`)
- **Output Format**: 실행된 변경 목록(액션별), import 업데이트 목록, 검증 결과
- **Constraints**: 승인된 제안만 실행. 임의 구조 변경 금지. 비즈니스 로직 수정 금지.
- **Skill Participation**: `restructure` (Stage 2, 3), `sync` (Stage 4)

---

### 2.3 agents/drift-analyzer.md

```markdown
---
name: drift-analyzer
description: >
  filid Drift Analyzer — read-only structural drift analysis and correction planning.
  Use proactively when: detecting deviations between current structure and fractal rules,
  classifying drift severity, generating correction plans, reporting structural health
  before /filid:sync, or assisting guide with current drift status.
  Trigger phrases: "detect structural drift", "analyze drift", "find structure deviations",
  "what is drifted", "generate correction plan", "sync health report".
tools: Read, Glob, Grep
model: sonnet
permissionMode: default
maxTurns: 30
---

## Role

You are the **filid Drift Analyzer**, a read-only analysis agent in the
filid 프랙탈 구조 관리 시스템. You detect deviations between the current project structure
and fractal principles, classify their severity, and produce actionable correction plans.
You NEVER write or modify files — all output is structured reports for the restructurer
agent to execute after fractal-architect review.

---

## Workflow

When invoked, execute these steps in order:

1. **Understand the scope**
   - Identify the target path and any severity filter (`--severity` option).
   - Determine if this is a full scan or a targeted module check.

2. **Scan the current structure**
   - Use `fractal-scan` MCP tool to retrieve the directory tree with current
     node classifications and metadata.
   - Build an internal snapshot: path, expected category, actual state.

3. **Detect drift**
   - Use `drift-detect` MCP tool to identify all deviations from fractal principles.
   - Each drift item contains: path, drift type, expected state, actual state.
   - Apply severity filter if `--severity` option is provided.

4. **Classify by severity**
   - Apply the `DriftSeverity` classification:
     - `critical`: Structural violations that break module resolution or cause import errors.
     - `high`: Missing required files (index.ts, main.ts) or wrong category assignment.
     - `medium`: Naming convention violations or incomplete barrel exports.
     - `low`: Style/convention drift that does not affect functionality.

5. **Resolve LCA relationships**
   - For drift items requiring reclassification, use `lca-resolve` MCP tool.
   - LCA resolution identifies the nearest common ancestor in the fractal tree,
     confirming where a misplaced node should belong.

6. **Generate correction plan**
   - For each drift item, map to a `SyncAction`:
     `move`, `rename`, `create-index`, `create-main`, `reclassify`, `split`, `merge`.
   - Order actions: resolve critical items first, then high, medium, low.
   - Group actions that can be batched (e.g., multiple index.ts creations).

7. **Produce the drift report**
   - Use the output format below.
   - Always include total item count per severity level.

---

## Analysis Checklist

- [ ] Full project scanned via fractal-scan
- [ ] All drift items detected via drift-detect
- [ ] Severity assigned to every drift item
- [ ] LCA resolved for all reclassification candidates
- [ ] Correction plan generated with one SyncAction per drift item
- [ ] Actions ordered by severity priority
- [ ] Report includes counts per severity level
- [ ] Dry-run flag respected (no file modification proposals in dry-run mode)

---

## Output Format

```
## Drift Analysis Report — <target path>

### Drift Summary
| Severity | Count |
|----------|-------|
| critical | 2 |
| high | 5 |
| medium | 3 |
| low | 7 |
Total: 17 drift items

### Drift Items
| Severity | Path | Drift Type | Expected | Actual |
|----------|------|------------|----------|--------|
| critical | src/shared/state | category mismatch | fractal | organ |
| high | src/features/auth | missing index.ts | present | absent |
| medium | src/utils/DateHelper.ts | naming convention | date-helper.ts | DateHelper.ts |

### LCA Analysis (Reclassification Candidates)
| Path | LCA Path | Recommended Category | Reason |
|------|----------|---------------------|--------|
| src/shared/state | src/features | fractal | Stateful; belongs under features fractal |

### Correction Plan
| Priority | Path | Action | Detail |
|----------|------|--------|--------|
| 1 | src/shared/state | reclassify | organ → fractal; update category metadata |
| 2 | src/features/auth | create-index | generate barrel export for all auth exports |
| 3 | src/utils/DateHelper.ts | rename | DateHelper.ts → date-helper.ts |

### Next Steps
- Pass correction plan to fractal-architect for review
- Execute approved actions via /filid:sync or restructurer agent
```

---

## Constraints

- NEVER use Write, Edit, or Bash tools under any circumstances.
- All proposals and correction plans are read-only output — never applied directly.
- Do not infer drift from file names alone; always use drift-detect tool results.
- Do not classify severity without mapping to the DriftSeverity type definition.
- Always run lca-resolve for reclassification candidates before recommending a move.
- If `--severity` filter is active, only report items at or above the specified level.

---

## Skill Participation

- `/filid:sync` — Stage 1 (project scan) and Stage 2 (drift detection & correction plan).
- `/filid:guide` — Supplementary: include current drift count in guide output.
```

**상세 설계:**

- **Role**: 이격 분석. read-only. 현재 구조와 규칙 간의 이격 상태를 분석하고 보정 계획 생성
- **model**: sonnet
- **tools**: Read, Glob, Grep
- **Workflow**:
  1. 프로젝트 스캔 (`fractal-scan`)
  2. 이격 감지 (`drift-detect`)
  3. 이격 심각도 분류 (critical / high / medium / low)
  4. LCA 분석 (`lca-resolve`) — 재분류 후보 해석
  5. 보정 계획 생성 (SyncAction 목록)
  6. 보고서 생성
- **Output Format**: 이격 목록, 심각도별 요약, LCA 분석, 보정 계획 우선순위 목록
- **Constraints**: NEVER write/edit files. Analysis and reporting only.
- **Skill Participation**: `sync` (Stage 1, 2), `guide` (보조 — 현재 이격 카운트 포함)

---

## 3. 기존 filid 스킬 (유지)

기존 filid 플러그인에는 다음 스킬이 이미 정의되어 있다:

- `skills/init/` — `/filid:init` 초기화
- `skills/scan/` — `/filid:scan` 스캔
- `skills/enforce/` — `/filid:enforce` 규칙 강제
- `skills/report/` — `/filid:report` 보고서
- `skills/migrate/` — `/filid:migrate` 마이그레이션
- `skills/review/` — `/filid:review` 리뷰

Phase 5에서는 프랙탈 구조 관리용 스킬 3개를 기존 `skills/` 디렉토리에 추가한다.

---

## 4. 신규 스킬 추가

### 4.1 guide 스킬

#### SKILL.md

```markdown
---
name: guide
user_invocable: true
description: 프로젝트의 프랙탈 구조 규칙을 스캔하고 현황과 함께 문서로 안내
version: 1.0.0
complexity: low
---

# guide — 프랙탈 구조 규칙 안내

프로젝트의 프랙탈 구조 현황을 스캔하고 활성화된 규칙을 조회하여 읽기 쉬운
가이드 문서로 출력한다. 팀원이 filid 규칙을 이해하고 준수할 수 있도록
프로젝트 맥락에 맞는 규칙 설명을 제공한다.

> **Detail Reference**: 상세 워크플로우, MCP 도구 사용 예시, 출력 템플릿은
> 이 스킬 디렉토리의 `reference.md`를 참조 (SKILL.md와 같은 위치).

## When to Use This Skill

- 프로젝트에 filid를 도입하고 팀에 규칙을 설명해야 할 때
- 현재 프로젝트 구조가 프랙탈 원칙을 얼마나 준수하는지 빠르게 확인할 때
- 특정 디렉토리의 카테고리(fractal/organ/pure-function/hybrid)를 확인할 때
- 규칙 위반 없이 새 모듈을 어디에 추가할지 가이드가 필요할 때
- `/filid:restructure` 또는 `/filid:sync` 전에 현재 상태를 파악할 때

## Core Workflow

### Phase 1 — 프로젝트 스캔
`fractal-scan` MCP 도구로 디렉토리 트리와 노드 분류 현황을 조회한다.
[reference.md Section 1](./reference.md#section-1--프로젝트-스캔-상세) 참조.

### Phase 2 — 규칙 조회
`rule-query` MCP 도구(`action: "list"`)로 활성화된 모든 규칙을 조회한다.
[reference.md Section 2](./reference.md#section-2--규칙-조회-상세) 참조.

### Phase 3 — 카테고리 분류 현황 정리
스캔 결과를 기반으로 노드별 카테고리 분포를 요약한다.
[reference.md Section 3](./reference.md#section-3--분류-현황-정리) 참조.

### Phase 4 — 가이드 문서 생성
규칙 목록, 카테고리 분류 기준, 현황 요약, 주요 주의사항을 통합하여
가이드 문서를 출력한다.
[reference.md Section 4](./reference.md#section-4--가이드-문서-출력-형식) 참조.

## Available MCP Tools

| Tool | Action | 목적 |
|------|--------|------|
| `fractal-scan` | — | 프로젝트 프랙탈 구조 스캔 및 노드 분류 조회 |
| `rule-query` | `list` | 활성화된 모든 규칙 목록 조회 |

## Options

```
/filid:guide [path]
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `path` | string | 현재 작업 디렉토리 | 스캔할 루트 디렉토리 |

## Quick Reference

```bash
# 현재 프로젝트 규칙 안내
/filid:guide

# 특정 서브디렉토리 규칙 안내
/filid:guide src/features

# 카테고리 분류 기준
fractal      = 상태 보유, 자식 fractal 노드 포함, 또는 기본 분류
organ        = 프랙탈 자식이 없는 리프 디렉토리 (구조 기반 자동 분류)
pure-function = 무상태, 부작용 없음
hybrid       = fractal 자식과 organ 파일 혼재
```

핵심 규칙:
- organ 디렉토리는 fractal 자식 노드를 가질 수 없다
- fractal 노드는 반드시 index.ts barrel export를 가져야 한다
- main.ts는 fractal 노드의 주 진입점이다
- 명명 규칙: kebab-case 디렉토리, PascalCase 컴포넌트 파일
```

**상세 설계:**

- **name**: guide
- **user_invocable**: true
- **description**: 프로젝트 프랙탈 구조 규칙을 스캔하고 현황과 함께 문서로 안내
- **version**: 1.0.0
- **complexity**: low
- **워크플로우**:
  1. 프로젝트 스캔 (`fractal-scan`)
  2. 활성 규칙 조회 (`rule-query`, action: "list")
  3. 카테고리 분류 현황 정리
  4. 규칙 가이드 문서 생성 및 출력
- **MCP Tools**: `fractal-scan`, `rule-query`
- **Options**: `/filid:guide [path]` — path (선택, 기본: cwd)
- **에이전트**: fractal-architect (리드)

---

#### reference.md

```markdown
# guide — Reference Documentation

guide 스킬의 상세 워크플로우, MCP 도구 사용 예시, 출력 템플릿.
빠른 시작 가이드는 [SKILL.md](./SKILL.md) 참조.

## Section 1 — 프로젝트 스캔 상세

`fractal-scan` MCP 도구를 호출하여 전체 디렉토리 트리와 노드 분류를 조회한다.

```
fractal-scan({ path: "<target-path>" })
```

응답 필드:
- `nodes`: 디렉토리 노드 배열 (path, category, hasIndex, hasMain, children)
- `summary`: 전체 노드 수, 카테고리별 카운트
- `violations`: 현재 감지된 규칙 위반 목록 (있을 경우)

## Section 2 — 규칙 조회 상세

`rule-query` MCP 도구로 활성화된 규칙 전체를 조회한다.

```
rule-query({ action: "list" })
```

응답 필드:
- `rules`: 규칙 배열 (id, name, category, severity, description, examples)

규칙 카테고리(`RuleCategory`):
- `naming` — 디렉토리/파일 명명 규칙
- `structure` — 노드 구조 및 계층 규칙
- `dependency` — import/export 의존성 규칙
- `documentation` — 문서화 요구사항
- `index` — index.ts barrel export 규칙
- `module` — main.ts 진입점 규칙

## Section 3 — 분류 현황 정리

fractal-scan 응답의 `summary`를 기반으로 카테고리 분포 테이블을 구성한다.

```
categoryTable = {
  fractal: summary.fractalCount,
  organ: summary.organCount,
  pureFunction: summary.pureFunctionCount,
  hybrid: summary.hybridCount,
  total: summary.totalCount
}
```

위반이 있는 경우 위반 항목을 심각도별로 정렬하여 현황 요약에 포함한다.

## Section 4 — 가이드 문서 출력 형식

### 표준 출력 형식

```
## filid 프랙탈 구조 가이드 — <target path>

### 프로젝트 구조 현황
| 카테고리 | 노드 수 | 설명 |
|----------|---------|------|
| fractal | N | 상태 보유 또는 계층 구조 모듈 |
| organ | N | 공유 유틸리티/컴포넌트 디렉토리 |
| pure-function | N | 무상태 순수 함수 모듈 |
| hybrid | N | fractal + organ 혼재 모듈 |
| 전체 | N | — |

현재 위반: N건 (error: X, warning: Y, info: Z)

### 활성 규칙 목록

#### naming 규칙
| 규칙 ID | 심각도 | 설명 |
|---------|--------|------|
| HOL-N001 | error | 디렉토리명은 kebab-case를 사용해야 한다 |

#### structure 규칙
| 규칙 ID | 심각도 | 설명 |
|---------|--------|------|
| HOL-S001 | error | organ 디렉토리는 fractal 자식을 포함할 수 없다 |
| HOL-S002 | warning | fractal 노드는 index.ts를 가져야 한다 |

#### index 규칙
| 규칙 ID | 심각도 | 설명 |
|---------|--------|------|
| HOL-I001 | warning | index.ts는 모든 공개 심볼을 re-export해야 한다 |

(나머지 카테고리 동일 형식)

### 카테고리 분류 기준
| 카테고리 | 판별 조건 |
|----------|----------|
| organ | organ 구조 분류 기준: 프랙탈 자식이 없는 리프 디렉토리 (구조 기반 자동 분류) |
| pure-function | 무상태, 부작용 없음, I/O 없음 |
| hybrid | fractal 자식 노드와 organ 파일 혼재 |
| fractal | 위 조건에 해당하지 않는 모든 디렉토리 (기본값) |

### 새 모듈 추가 시 체크리스트
- [ ] 디렉토리명이 kebab-case인가?
- [ ] organ으로 분류될 디렉토리라면 프랙탈 자식을 포함하지 않는가?
- [ ] fractal 노드라면 index.ts가 있는가?
- [ ] 주 기능이 있다면 main.ts가 있는가?
- [ ] organ 디렉토리 아래에 fractal 자식을 두지 않는가?

현재 위반이 있는 경우:
⚠ 위반 항목 N건이 감지되었습니다. /filid:sync 를 실행하여 보정하세요.
```
```

---

### 4.2 restructure 스킬

#### SKILL.md

```markdown
---
name: restructure
user_invocable: true
description: 프로젝트 구조를 분석하고 프랙탈 원칙에 따라 재구성
version: 1.0.0
complexity: high
---

# restructure — 프랙탈 구조 재편

프로젝트의 현재 디렉토리 구조를 분석하고 프랙탈 원칙에 따라 재구성한다.
fractal-architect가 분석 및 제안을 수행하고, 사용자 승인 후 restructurer가
파일 이동, 이름 변경, index.ts 생성, import 경로 업데이트를 실행한다.

> **Detail Reference**: 상세 워크플로우, MCP 도구 사용 예시, 출력 템플릿은
> 이 스킬 디렉토리의 `reference.md`를 참조 (SKILL.md와 같은 위치).

## When to Use This Skill

- 기존 프로젝트를 프랙탈 구조로 마이그레이션할 때
- 대규모 리팩토링 이후 구조가 프랙탈 원칙에서 벗어났을 때
- organ 디렉토리 아래에 fractal 모듈이 잘못 배치된 경우
- 누적된 구조 위반을 한 번에 일괄 해소할 때
- hybrid 노드를 명확한 fractal 또는 organ으로 분리해야 할 때

## Core Workflow

### Stage 1 — 분석 & 제안
fractal-architect가 현재 구조를 전체 스캔하고 규칙 위반 및 구조 개선 사항을
분석하여 구체적인 재구성 제안을 생성한다.
[reference.md Section 1](./reference.md#section-1--분석--제안-상세) 참조.

### Stage 2 — 계획 제시 & 승인
분석 결과와 재구성 계획을 사용자에게 제시하고 실행 전 명시적 승인을 요청한다.
`--auto-approve` 플래그가 있으면 이 단계를 건너뛴다.
[reference.md Section 2](./reference.md#section-2--계획-제시--승인) 참조.

### Stage 3 — 실행
restructurer가 승인된 계획에 따라 파일 이동, 이름 변경, index.ts 생성,
import 경로 업데이트를 순서대로 실행한다.
[reference.md Section 3](./reference.md#section-3--실행-상세) 참조.

### Stage 4 — 검증
fractal-architect가 실행 결과를 검증하고 잔여 위반 사항을 보고한다.
[reference.md Section 4](./reference.md#section-4--검증-상세) 참조.

## Available MCP Tools

| Tool | Stage | 목적 |
|------|-------|------|
| `fractal-scan` | 1 | 현재 구조 전체 스캔 |
| `drift-detect` | 1 | 프랙탈 원칙 이탈 감지 |
| `lca-resolve` | 1 | LCA 관계 해석 (이동 대상 위치 결정) |
| `rule-query` | 1 | 활성 규칙 조회 |
| `structure-validate` | 4 | 실행 후 구조 검증 |

## Options

```
/filid:restructure [path] [--dry-run] [--auto-approve]
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `path` | string | 현재 작업 디렉토리 | 재구성 대상 루트 디렉토리 |
| `--dry-run` | flag | off | 실제 변경 없이 계획만 미리 보기 |
| `--auto-approve` | flag | off | 사용자 승인 단계 생략 (CI/자동화 환경용) |

## Quick Reference

```bash
# 현재 프로젝트 구조 재편
/filid:restructure

# 특정 경로만 재편
/filid:restructure src/features

# 변경 미리 보기 (실제 적용 없음)
/filid:restructure --dry-run

# 자동 승인 모드 (CI 환경)
/filid:restructure --auto-approve

Stages:   분석 → 계획 → 실행 → 검증
Agents:   fractal-architect (Stage 1, 4), restructurer (Stage 2, 3)
Dry-run:  계획 출력 후 종료, 파일 변경 없음
```

핵심 규칙:
- 항상 dry-run으로 먼저 확인 후 실행 권장
- auto-approve는 검증된 CI 환경에서만 사용
- 실행 중 범위 외 변경이 감지되면 즉시 중단하고 보고
```

**상세 설계:**

- **name**: restructure
- **user_invocable**: true
- **description**: 프로젝트 구조를 프랙탈 원칙에 따라 재구성
- **version**: 1.0.0
- **complexity**: high
- **4단계 워크플로우**:
  1. **분석** — fractal-architect가 현재 구조 분석 + 재구성 제안 (`fractal-scan`, `structure-validate`, `drift-detect`)
  2. **계획** — 사용자에게 재구성 계획 제시 및 승인 요청 (`--auto-approve` 시 생략)
  3. **실행** — restructurer가 승인된 계획 실행 (파일 이동, 이름 변경, index 업데이트)
  4. **검증** — fractal-architect가 결과 검증 (`structure-validate`)
- **MCP Tools**: `fractal-scan`, `drift-detect`, `lca-resolve`, `rule-query`, `structure-validate`
- **Options**: `/filid:restructure [path] [--dry-run] [--auto-approve]`
- **에이전트**: fractal-architect (Stage 1, 4), restructurer (Stage 2, 3)

---

#### reference.md

```markdown
# restructure — Reference Documentation

restructure 스킬의 상세 워크플로우, MCP 도구 사용 예시, 출력 템플릿.
빠른 시작 가이드는 [SKILL.md](./SKILL.md) 참조.

## Section 1 — 분석 & 제안 상세

fractal-architect가 `fractal-scan`으로 전체 트리를 스캔한다.

```
fractal-scan({ path: "<target-path>" })
// Returns: { nodes: FractalNode[], summary: ScanSummary, violations: Violation[] }
```

`drift-detect`로 프랙탈 원칙 이탈 항목을 감지한다.

```
drift-detect({ path: "<target-path>" })
// Returns: { drifts: DriftItem[], total: number }
```

이동 대상 위치 결정이 필요한 경우 `lca-resolve`를 사용한다.

```
lca-resolve({ nodePath: "<path>", contextPaths: ["<sibling1>", "<sibling2>"] })
// Returns: { lcaPath: string, recommendedParent: string, confidence: number }
```

`rule-query`로 활성 규칙 전체를 조회하여 제안 기준을 확정한다.

```
rule-query({ action: "list" })
// Returns: { rules: Rule[] }
```

분석 완료 후 fractal-architect는 구조화된 재구성 제안을 YAML 형식으로 생성한다:

```yaml
restructure-plan:
  target: src/
  generated: "2026-02-22T00:00:00Z"
  actions:
    - type: move
      source: src/components/AuthModal
      target: src/features/auth/components/AuthModal
      reason: fractal 모듈이 organ 디렉토리 아래에 잘못 배치됨
    - type: rename
      source: src/utils/UserHelper.ts
      target: src/utils/user-helper.ts
      reason: kebab-case 명명 규칙 위반 (HOL-N001)
    - type: create-index
      target: src/features/auth
      reason: fractal 노드에 index.ts barrel export 없음
    - type: reclassify
      path: src/shared/state
      from: organ
      to: fractal
      reason: 상태 관리 로직 포함; organ 분류 부적절
```

## Section 2 — 계획 제시 & 승인

`--dry-run` 모드인 경우 계획을 출력하고 종료한다:

```
[DRY RUN] 재구성 계획 — 4개 액션:
  MOVE    src/components/AuthModal → src/features/auth/components/AuthModal
  RENAME  src/utils/UserHelper.ts → src/utils/user-helper.ts
  CREATE  src/features/auth/index.ts (barrel export)
  RECLASSIFY src/shared/state: organ → fractal
변경 사항 없음. 실제 실행하려면 --dry-run 플래그를 제거하세요.
```

`--auto-approve`가 없는 경우 사용자에게 승인을 요청한다:

```
위 재구성 계획을 실행하시겠습니까?
영향 파일: N개 | import 경로 업데이트: N개
[y/N]
```

사용자가 'y'를 입력하거나 `--auto-approve`가 설정된 경우 Stage 3으로 진행한다.

## Section 3 — 실행 상세

restructurer가 액션 타입별로 순서대로 실행한다.

**실행 순서 (우선순위)**:
1. `reclassify` (메타데이터 변경, 이동 없음)
2. `move` (파일 시스템 변경)
3. `rename` (파일 시스템 변경)
4. `create-index` (새 파일 생성)
5. `create-main` (새 파일 생성)
6. `split` / `merge` (복합 작업)

각 이동/이름 변경 후 즉시 import 경로를 업데이트한다:

```
affectedFiles = grep("<old-path>", all_source_files)
for file in affectedFiles:
  edit(file, replace("<old-import>", "<new-import>"))
```

index.ts 생성 예시:

```typescript
// src/features/auth/index.ts
export { AuthModal } from './components/AuthModal';
export { useAuth } from './hooks/useAuth';
export type { AuthUser, AuthState } from './types';
```

## Section 4 — 검증 상세

restructurer 실행 완료 후 fractal-architect가 `structure-validate`로 결과를 검증한다.

```
structure-validate({ path: "<target-path>" })
// Returns: { passed: boolean, checks: ValidationCheck[], violations: Violation[] }
```

검증 체크 항목:
- 모든 import가 해석 가능한가?
- orphaned 파일 없음 (이동 후 참조되지 않는 파일)?
- 모든 fractal 노드에 index.ts가 있는가?
- organ 디렉토리에 fractal 자식이 없는가?
- 명명 규칙 위반 없음?

### 최종 실행 보고서 형식

```
## Restructure 실행 완료 — <target path>

### 실행된 액션
| 액션 | 소스 | 대상/결과 | 상태 |
|------|------|----------|------|
| move | src/components/AuthModal | src/features/auth/components/AuthModal | ✓ |
| rename | src/utils/UserHelper.ts | src/utils/user-helper.ts | ✓ |
| create-index | src/features/auth/index.ts | — | ✓ |
| reclassify | src/shared/state | fractal | ✓ |

### Import 경로 업데이트
| 파일 | 이전 경로 | 변경 후 경로 |
|------|----------|-------------|
| src/app.ts | ../components/AuthModal | ../features/auth/components/AuthModal |

### 검증 결과
structure-validate: PASS
- Import 해석 가능: ✓
- Orphaned 파일 없음: ✓
- Fractal 노드 index.ts 완비: ✓
- Organ 디렉토리 규칙 준수: ✓

### 요약
- 이동된 파일: N개
- 이름 변경: N개
- 생성된 파일: N개
- Import 업데이트: N개
- 검증: PASS
```
```

---

### 4.3 sync 스킬

#### SKILL.md

```markdown
---
name: sync
user_invocable: true
description: 구조 이격을 감지하고 프랙탈 원칙에 따라 보정
version: 1.0.0
complexity: high
---

# sync — 구조 이격 동기화

현재 프로젝트 구조와 프랙탈 원칙 사이의 이격(drift)을 감지하고 보정한다.
drift-analyzer가 이격 항목을 스캔 및 분류하고, fractal-architect가 보정 계획을
검토하며, restructurer가 승인된 보정을 실행한다.

> **Detail Reference**: 상세 워크플로우, MCP 도구 사용 예시, 출력 템플릿은
> 이 스킬 디렉토리의 `reference.md`를 참조 (SKILL.md와 같은 위치).

## When to Use This Skill

- 개발 세션 이후 구조가 프랙탈 원칙에서 소폭 이탈했을 때
- CI 파이프라인에서 구조 드리프트를 자동 감지 및 보정할 때
- `critical` 또는 `high` 심각도 이격만 선택적으로 보정할 때
- `/filid:restructure` 없이 소규모 보정만 필요할 때
- 이격 현황만 확인하고 실제 보정은 나중에 실행할 때 (`--dry-run`)

## Core Workflow

### Stage 1 — 스캔
drift-analyzer가 `fractal-scan`으로 현재 구조 전체를 스캔한다.
[reference.md Section 1](./reference.md#section-1--스캔-상세) 참조.

### Stage 2 — 감지 & 분류
`drift-detect`로 이격 항목을 감지하고 심각도별로 분류한다.
`--severity` 옵션으로 보정 대상 심각도를 제한할 수 있다.
[reference.md Section 2](./reference.md#section-2--감지--분류-상세) 참조.

### Stage 3 — 계획 & 승인
drift-analyzer가 보정 계획을 생성하고 fractal-architect가 검토한다.
`lca-resolve`로 재분류 대상의 올바른 위치를 확정한다.
사용자에게 계획을 제시하고 승인을 요청한다.
[reference.md Section 3](./reference.md#section-3--계획--승인-상세) 참조.

### Stage 4 — 보정 실행
restructurer가 승인된 보정 계획을 실행하고 `structure-validate`로 검증한다.
[reference.md Section 4](./reference.md#section-4--보정-실행-상세) 참조.

## Available MCP Tools

| Tool | Stage | 목적 |
|------|-------|------|
| `fractal-scan` | 1 | 프로젝트 구조 전체 스캔 |
| `drift-detect` | 2 | 이격 항목 감지 |
| `lca-resolve` | 3 | 재분류 대상 위치 결정 |
| `structure-validate` | 4 | 보정 후 구조 검증 |

## Options

```
/filid:sync [path] [--severity <level>] [--dry-run] [--auto-approve]
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `path` | string | 현재 작업 디렉토리 | 스캔 대상 루트 디렉토리 |
| `--severity` | `critical\|high\|medium\|low` | `low` (전체) | 보정할 최소 심각도 |
| `--dry-run` | flag | off | 실제 변경 없이 감지 결과와 계획만 출력 |
| `--auto-approve` | flag | off | 사용자 승인 단계 생략 |

## Quick Reference

```bash
# 전체 이격 감지 및 보정
/filid:sync

# critical + high 심각도만 보정
/filid:sync --severity high

# 이격 현황만 확인 (변경 없음)
/filid:sync --dry-run

# CI 자동 보정 (critical only)
/filid:sync --severity critical --auto-approve

Stages:   스캔 → 감지 → 계획 → 보정
Agents:   drift-analyzer (Stage 1, 2), fractal-architect (Stage 3 검토), restructurer (Stage 4)
Severity: critical > high > medium > low
```

핵심 규칙:
- `--severity high`: critical + high 항목만 보정
- `--dry-run`은 파일을 변경하지 않음
- critical 이격이 있으면 반드시 보정 후 빌드/테스트 재실행
- auto-approve는 CI 환경에서만 권장
```

**상세 설계:**

- **name**: sync
- **user_invocable**: true
- **description**: 구조 이격을 감지하고 프랙탈 원칙에 따라 보정
- **version**: 1.0.0
- **complexity**: high
- **4단계 워크플로우**:
  1. **스캔** — drift-analyzer가 현재 구조 스캔 (`fractal-scan`)
  2. **감지** — 이격 감지 및 심각도별 분류 (`drift-detect`)
  3. **계획** — 보정 계획 생성 + fractal-architect 검토 + 사용자 승인 (`lca-resolve`)
  4. **보정** — restructurer가 보정 실행 + 검증 (`structure-validate`)
- **MCP Tools**: `fractal-scan`, `drift-detect`, `lca-resolve`, `structure-validate`
- **Options**: `/filid:sync [path] [--severity <level>] [--dry-run] [--auto-approve]`
- **에이전트**: drift-analyzer (Stage 1, 2), fractal-architect (Stage 3 검토), restructurer (Stage 4)

---

#### reference.md

```markdown
# sync — Reference Documentation

sync 스킬의 상세 워크플로우, MCP 도구 사용 예시, 출력 템플릿.
빠른 시작 가이드는 [SKILL.md](./SKILL.md) 참조.

## Section 1 — 스캔 상세

drift-analyzer가 `fractal-scan`으로 현재 구조 전체를 스캔한다.

```
fractal-scan({ path: "<target-path>" })
// Returns: { nodes: FractalNode[], summary: ScanSummary, violations: Violation[] }
```

노드별로 다음을 확인한다:
- `category`: 현재 분류 (fractal / organ / pure-function / hybrid)
- `hasIndex`: index.ts barrel export 존재 여부
- `hasMain`: main.ts 진입점 존재 여부
- `children`: 자식 노드 목록

## Section 2 — 감지 & 분류 상세

`drift-detect`로 이격 항목 전체를 감지한다.

```
drift-detect({ path: "<target-path>", severityFilter: "<level>" })
// Returns: { drifts: DriftItem[], total: number, bySeverity: SeverityCount }
```

`--severity` 옵션이 있는 경우 해당 심각도 이상만 반환된다.

각 DriftItem 필드:
- `path`: 이격이 감지된 노드 경로
- `driftType`: 이격 유형 (category-mismatch / missing-index / missing-main / naming-violation / orphaned-node)
- `severity`: `critical` | `high` | `medium` | `low`
- `expected`: 기대 상태
- `actual`: 현재 상태
- `suggestedAction`: 권장 SyncAction

`DriftSeverity` 기준:
- `critical`: import 해석 불가 또는 모듈 해석 오류 유발
- `high`: 필수 파일 누락 (index.ts, main.ts) 또는 카테고리 오분류
- `medium`: 명명 규칙 위반 또는 불완전한 barrel export
- `low`: 스타일/관례 이탈 (기능에 영향 없음)

## Section 3 — 계획 & 승인 상세

drift-analyzer가 감지된 이격을 기반으로 보정 계획을 생성하고,
fractal-architect가 reclassify 또는 move 액션에 대해 lca-resolve로 검토한다.

```
lca-resolve({ nodePath: "<drifted-path>", contextPaths: ["<neighbor1>"] })
// Returns: { lcaPath: string, recommendedParent: string, confidence: number }
```

보정 계획 형식:

```yaml
sync-plan:
  target: src/
  generated: "2026-02-22T00:00:00Z"
  severity-filter: high
  items:
    - drift-id: D001
      severity: critical
      path: src/shared/state
      action: reclassify
      from: organ
      to: fractal
      lca: src/features
    - drift-id: D002
      severity: high
      path: src/features/auth
      action: create-index
      target: src/features/auth/index.ts
```

`--dry-run` 모드 출력:

```
[DRY RUN] 이격 감지 결과 — severity: high 이상
  critical (2건):
    D001 RECLASSIFY src/shared/state: organ → fractal
    D002 RENAME     src/utils/UserHelper.ts → src/utils/user-helper.ts
  high (3건):
    D003 CREATE-INDEX src/features/auth/index.ts
    D004 CREATE-MAIN  src/features/user/main.ts
    D005 MOVE         src/components/AuthWidget → src/features/auth/components/AuthWidget
변경 사항 없음. 실제 보정하려면 --dry-run 플래그를 제거하세요.
```

`--auto-approve`가 없는 경우 승인 요청:

```
위 보정 계획을 실행하시겠습니까?
이격 항목: N건 | 영향 파일: N개
[y/N]
```

## Section 4 — 보정 실행 상세

restructurer가 승인된 sync-plan의 각 액션을 실행한다.
실행 순서: reclassify → move → rename → create-index → create-main

각 move/rename 후 즉시 import 경로를 업데이트한다:

```
for each drift-item with move/rename action:
  oldPath = drift-item.path
  newPath = drift-item.target
  affectedFiles = grep(oldPath, all_source_files)
  for file in affectedFiles:
    edit(file, replace(oldPath, newPath))
```

실행 완료 후 `structure-validate`로 검증한다:

```
structure-validate({ path: "<target-path>" })
// Returns: { passed: boolean, checks: ValidationCheck[], violations: Violation[] }
```

### 최종 보고서 형식

```
## Sync 보정 완료 — <target path>

### 감지된 이격
| 심각도 | 감지 수 | 보정 수 | 스킵 수 |
|--------|---------|---------|---------|
| critical | 2 | 2 | 0 |
| high | 3 | 3 | 0 |
| medium | 5 | 0 | 5 (severity filter) |
| low | 7 | 0 | 7 (severity filter) |

### 실행된 보정
| 보정 ID | 경로 | 액션 | 상태 |
|---------|------|------|------|
| D001 | src/shared/state | reclassify: organ → fractal | ✓ |
| D002 | src/utils/UserHelper.ts | rename → user-helper.ts | ✓ |
| D003 | src/features/auth/index.ts | create-index | ✓ |
| D004 | src/features/user/main.ts | create-main | ✓ |
| D005 | src/components/AuthWidget | move → src/features/auth/... | ✓ |

### 검증 결과
structure-validate: PASS
- Import 해석 가능: ✓
- 모든 fractal 노드 index.ts 완비: ✓
- Organ 규칙 준수: ✓

### 요약
- 보정 완료: 5건
- 스킵 (severity filter): 12건
- 검증: PASS
```
```
