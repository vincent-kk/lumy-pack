# 07. FCA-AI 규칙 레퍼런스

> filid 플러그인이 시행하는 모든 FCA-AI 규칙, 상수, 임계값의 종합 레퍼런스.

---

## 상수 테이블

| 상수명 | 값 | 정의 위치 | 용도 |
|--------|-----|-----------|------|
| `CLAUDE_MD_LINE_LIMIT` | `100` | `core/document-validator.ts:4` | CLAUDE.md 최대 줄 수 |
| `ORGAN_DIR_NAMES` | 9개 문자열 배열 | `core/organ-classifier.ts:4-14` | Organ 디렉토리 식별 |
| `TEST_THRESHOLD` | `15` | `metrics/decision-tree.ts:4` | 3+12 규칙 테스트 상한 |
| `CC_THRESHOLD` | `15` | `metrics/decision-tree.ts:7` | Cyclomatic Complexity 상한 |
| `LCOM4_SPLIT_THRESHOLD` | `2` | `metrics/decision-tree.ts:10` | LCOM4 분할 기준 |
| `DEFAULT_STABILITY_DAYS` | `90` | `metrics/promotion-tracker.ts:4` | 테스트 승격 안정 기간 (일) |
| `THRESHOLD` (3+12) | `15` | `metrics/three-plus-twelve.ts:4` | spec 파일별 테스트 상한 |

### ORGAN_DIR_NAMES 전체 목록

```typescript
const ORGAN_DIR_NAMES: readonly string[] = [
  'components',   // UI 컴포넌트
  'utils',        // 유틸리티 함수
  'types',        // 타입 정의
  'hooks',        // React/프레임워크 훅
  'helpers',      // 헬퍼 함수
  'lib',          // 라이브러리 래퍼
  'styles',       // 스타일시트
  'assets',       // 정적 자원
  'constants',    // 상수 정의
] as const;
```

### BOUNDARY_KEYWORDS (CLAUDE.md 3-tier 검증)

```typescript
const BOUNDARY_KEYWORDS = {
  alwaysDo: /^###?\s*(always\s*do)/im,
  askFirst: /^###?\s*(ask\s*first)/im,
  neverDo:  /^###?\s*(never\s*do)/im,
} as const;
```

> 정의 위치: `core/document-validator.ts:7-11`

---

## 규칙 매트릭스

### 문서 규칙

| 규칙명 | 대상 | 조건 | 액션 | 심각도 |
|--------|------|------|------|--------|
| line-limit | CLAUDE.md | 줄 수 > 100 | Write 차단 | `error` |
| missing-boundaries | CLAUDE.md | Always do/Ask first/Never do 섹션 누락 | 경고 주입 | `warning` |
| append-only | SPEC.md | 기존 내용 유지 + 끝에만 추가 | Write 차단 | `error` |
| organ-guard | CLAUDE.md | Organ 디렉토리 내 생성 시도 | Write 차단 | `error` (implicit) |

### 메트릭 규칙

| 규칙명 | 대상 | 조건 | 액션 | 근거 |
|--------|------|------|------|------|
| 3+12 rule | `*.spec.ts` | 테스트 케이스 > 15 | 위반 보고 | basic 3 + complex 12 = 15 |
| LCOM4 split | 클래스/모듈 | LCOM4 >= 2 | `split` 권고 | SRP 위반, 하위 프랙탈 추출 |
| CC compress | 함수/모듈 | CC > 15 (LCOM4 = 1) | `compress` 권고 | 높은 응집도이지만 복잡한 제어 흐름 |
| CC parameterize | 함수/모듈 | CC <= 15 (LCOM4 = 1, tests > 15) | `parameterize` 권고 | 중복 테스트 병합 |
| promotion | `*.test.ts` | 90일 안정 + 실패 이력 없음 | `spec.ts`로 승격 | 안정된 테스트의 정규화 |

---

## 분류 우선순위

디렉토리 노드 분류 알고리즘 (`core/organ-classifier.ts:classifyNode`):

```
우선순위 1: CLAUDE.md 존재 → fractal (명시적 선언)
우선순위 2: ORGAN_DIR_NAMES 패턴 매칭 → organ
우선순위 3: 사이드이펙트 없음 → pure-function
우선순위 4: 기본값 → fractal (CLAUDE.md 추가 필요)
```

### NodeType 분류 체계

| 타입 | 의미 | 특징 |
|------|------|------|
| `fractal` | 독립 도메인 경계 | CLAUDE.md 보유, 하위 프랙탈/organ 포함 가능 |
| `organ` | 리프 레벨 부속품 | CLAUDE.md 금지, 특정 디렉토리명 패턴 |
| `pure-function` | 순수 함수 모듈 | 사이드이펙트 없음, 독립적 |

---

## 검증 규칙 상세

### CLAUDE.md 검증 (`validateClaudeMd`)

1. **줄 수 제한**: `countLines(content) > 100` → `error`
   - 빈 문자열 = 0줄, 후행 개행 무시
2. **3-tier 경계**: 3개 섹션 전부 존재해야 함 → 누락 시 `warning`
   - `### Always do` 또는 `## Always do` (대소문자 무시)
   - `### Ask first` 또는 `## Ask first`
   - `### Never do` 또는 `## Never do`

### SPEC.md 검증 (`validateSpecMd`)

1. **Append-only 감지**: `detectAppendOnly(oldContent, newContent)`
   - 기존 줄이 모두 동일하게 유지되고 새 줄만 끝에 추가 → `error`
   - 재구조화(restructure) 요구

### Organ Guard (`guardOrganWrite`)

1. **대상**: `Write` 도구로 CLAUDE.md 생성 시
2. **검사**: 경로의 모든 부모 세그먼트가 `ORGAN_DIR_NAMES`에 포함되는지
3. **결과**: Organ 디렉토리 내부면 차단 + 이유 메시지

---

## 에이전트 역할 제한

| 에이전트 | 도구 제한 | 범위 |
|----------|-----------|------|
| `architect` | Write, Edit, Bash **금지** | 읽기 전용 — 분석, 설계, 계획만 |
| `qa-reviewer` | Write, Edit, Bash **금지** | 읽기 전용 — 리뷰, 분석, 보고만 |
| `implementer` | 제한 없음 (범위 제한) | SPEC.md 범위 내 코드만 수정 |
| `context-manager` | 제한 없음 (범위 제한) | CLAUDE.md, SPEC.md 문서만 수정 |

### ROLE_RESTRICTIONS 메시지 (`hooks/agent-enforcer.ts:11-20`)

```typescript
const ROLE_RESTRICTIONS: Record<string, string> = {
  architect:
    'ROLE RESTRICTION: You are an Architect agent. You MUST NOT use Write or Edit tools. ...',
  'qa-reviewer':
    'ROLE RESTRICTION: You are a QA/Reviewer agent. You MUST NOT use Write or Edit tools. ...',
  implementer:
    'ROLE RESTRICTION: You are an Implementer agent. You MUST only implement within the scope defined by SPEC.md. ...',
  'context-manager':
    'ROLE RESTRICTION: You are a Context Manager agent. You may only edit CLAUDE.md and SPEC.md documents. ...',
};
```

---

## 의사결정 트리 파이프라인

```
입력: { testCount, lcom4, cyclomaticComplexity }

testCount <= 15 ──────────────→ ok (조치 불필요)
       │ > 15
       ▼
LCOM4 >= 2 ───────────────────→ split (SRP 위반, 하위 프랙탈 추출)
       │ < 2 (= 1)
       ▼
CC > 15 ──────────────────────→ compress (메서드 추출, 전략 패턴, 조건 평탄화)
       │ <= 15
       ▼
parameterize ─────────────────→ 중복 에지케이스 테스트를 데이터 기반 테스트로 병합
```

### DecisionAction 타입

```typescript
type DecisionAction = 'split' | 'compress' | 'parameterize' | 'ok';
```

---

## 테스트 분류 기준

### basic vs complex 테스트

| 분류 | 기준 | 설명 |
|------|------|------|
| `basic` | `describe` 깊이 <= 1 내 `it`/`test` | 최상위 describe 직하의 테스트 |
| `complex` | `describe` 깊이 >= 2 내 `it`/`test` | 중첩 describe 내부의 테스트 |

### 파일 유형 판별

| 패턴 | 분류 | 3+12 규칙 적용 |
|------|------|----------------|
| `*.spec.ts` / `*.spec.tsx` | `spec` | O (적용) |
| `*.test.ts` / `*.test.tsx` | `test` | X (무시) |

> `check312Rule`은 `spec` 파일만 평가한다. `test` 파일은 필터링되어 제외.

---

## 승격 기준 (test → spec)

| 조건 | 기준값 | 설명 |
|------|--------|------|
| `stableDays` | >= 90 (기본) | 연속 안정 일수 |
| `lastFailure` | `null` | 실패 이력 없음 |

두 조건을 모두 만족해야 `eligible: true`.

---

## Hook 이벤트별 규칙 적용

| Hook 이벤트 | 적용 규칙 | 차단 가능 |
|-------------|-----------|-----------|
| `PreToolUse` (Write\|Edit) | CLAUDE.md 검증, Organ Guard | O |
| `PostToolUse` (Write\|Edit) | Change Queue 기록 | X (항상 통과) |
| `SubagentStart` (*) | 에이전트 역할 제한 주입 | X (항상 통과) |
| `UserPromptSubmit` (*) | FCA-AI 규칙 리마인더 주입 | X (항상 통과) |

### Context Injector 주입 내용 (~200자)

```
[FCA-AI] Active in: {cwd}
Rules:
- CLAUDE.md: max 100 lines, must include 3-tier boundary sections
- SPEC.md: no append-only growth, must restructure on updates
- Organ directories (...) must NOT have CLAUDE.md
- Test files: max 15 cases per spec.ts (3 basic + 12 complex)
- LCOM4 >= 2 → split module, CC > 15 → compress/abstract
```

---

## 관련 문서

- [01-ARCHITECTURE.md](./01-ARCHITECTURE.md) — 규칙이 아키텍처에서 차지하는 위치
- [02-BLUEPRINT.md](./02-BLUEPRINT.md) — 각 규칙의 구현 모듈
- [06-HOW-IT-WORKS.md](./06-HOW-IT-WORKS.md) — 규칙이 Hook 파이프라인에서 실행되는 방식
