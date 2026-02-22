# 05. 플러그인 운영 비용 & 성능 영향

> Hook 오버헤드, MCP 서버 비용, 컨텍스트 비용, 번들 크기, 비용 절감 설계의 분석.

---

## Hook 오버헤드

### 실행 시간 (timeout 기준)

| Hook 스크립트            | 이벤트           | timeout | 번들 크기 | 예상 실행 시간 |
| ------------------------ | ---------------- | ------- | --------- | -------------- |
| `pre-tool-validator.mjs` | PreToolUse       | 3초     | 4.1KB     | <50ms          |
| `structure-guard.mjs`    | PreToolUse       | 3초     | 1.5KB     | <30ms          |
| `change-tracker.mjs`     | _(disabled)_     | —       | 633B      | —              |
| `agent-enforcer.mjs`     | SubagentStart    | 3초     | 1.3KB     | <30ms          |
| `context-injector.mjs`   | UserPromptSubmit | 5초     | 988B      | <20ms          |

> 예상 실행 시간은 Node.js 프로세스 시작 + stdin 읽기 + 로직 실행 + stdout 쓰기 합산.
> 모든 Hook 스크립트는 esbuild self-contained 번들이므로 모듈 해석 오버헤드 없음.

### 호출 빈도

| Hook               | 트리거 조건           | 예상 호출 빈도               |
| ------------------ | --------------------- | ---------------------------- |
| context-injector   | 매 사용자 프롬프트    | **높음** — 모든 상호작용마다 |
| pre-tool-validator | Write\|Edit 도구 호출 | **중간** — 파일 수정 시      |
| structure-guard    | Write\|Edit 도구 호출 | **중간** — 파일 수정 시      |
| change-tracker     | _(disabled)_          | —                            |
| agent-enforcer     | 서브에이전트 생성     | **낮음** — 에이전트 생성 시  |

### stdin/stdout JSON 직렬화 비용

- **입력 크기**: `PreToolUseInput`이 가장 큼 — `content` 필드에 파일 전체 내용 포함 가능
- **큰 파일 Write**: 예) 500줄 파일 Write → stdin JSON ~15KB → `JSON.parse` ~1-2ms
- **출력 크기**: 항상 작음 — `HookOutput` 최대 ~500B (additionalContext 메시지)
- **병목**: stdin 데이터 수집 (`for await...of`) 이 가장 오래 걸림

### PreToolUse 이중 Hook 비용

Write|Edit 시 `pre-tool-validator` + `structure-guard` 두 Hook이 순차 실행:

```
Write 도구 호출
    │
    ├─ pre-tool-validator.mjs (Node 시작 → 실행 → 종료): ~50ms
    │
    ├─ structure-guard.mjs (Node 시작 → 실행 → 종료): ~30ms
    │
    ▼
합계: ~80ms (Write 1회당 추가 지연)
```

CLAUDE.md/SPEC.md가 아닌 일반 파일 Write 시:

- `pre-tool-validator`: 즉시 `{ continue: true }` 반환 (~20ms)
- `structure-guard`: CLAUDE.md가 아니므로 즉시 통과 (~15ms)
- 합계: ~35ms (최소 지연)

---

## MCP 서버 비용

### 서버 기동 시간

| 항목           | 설명                                     |
| -------------- | ---------------------------------------- |
| 번들 형식      | CJS (CommonJS)                           |
| 번들 크기      | ~516KB (`libs/server.cjs`)               |
| 외부 의존성    | `typescript` (external, ~50MB 설치 크기) |
| 기동 방식      | `node libs/server.cjs` → stdio transport |
| 예상 기동 시간 | ~200-500ms (TypeScript 모듈 로딩 포함)   |

> MCP 서버는 세션당 1회 기동 후 상주. 기동 비용은 초기 1회만 발생.

### 도구 호출당 응답 시간

| 도구               | 액션                  | AST 파싱 | 예상 응답 시간            |
| ------------------ | --------------------- | -------- | ------------------------- |
| `ast-analyze`      | dependency-graph      | O        | 50-200ms (소스 크기 비례) |
| `ast-analyze`      | lcom4                 | O        | 50-200ms                  |
| `ast-analyze`      | cyclomatic-complexity | O        | 30-100ms                  |
| `ast-analyze`      | tree-diff             | O (2회)  | 100-400ms                 |
| `ast-analyze`      | full                  | O        | 100-500ms                 |
| `fractal-navigate` | classify              | X        | <10ms                     |
| `fractal-navigate` | sibling-list          | X        | <20ms (트리 구축 포함)    |
| `fractal-navigate` | tree                  | X        | <30ms                     |
| `doc-compress`     | reversible            | X        | <5ms                      |
| `doc-compress`     | lossy                 | X        | <10ms                     |
| `test-metrics`     | count                 | X        | <10ms (파일 수 비례)      |
| `test-metrics`     | check-312             | X        | <15ms                     |
| `test-metrics`     | decide                | X        | <5ms                      |

> AST 파싱이 포함된 `ast-analyze` 도구가 가장 느림.
> `ts.createSourceFile()`의 시간 복잡도: O(n) where n = 소스 코드 크기.

### TypeScript Compiler API 메모리 사용량

| 시나리오           | 소스 크기 | 추정 메모리 |
| ------------------ | --------- | ----------- |
| 소형 파일 (100줄)  | ~3KB      | ~5-10MB     |
| 중형 파일 (500줄)  | ~15KB     | ~15-30MB    |
| 대형 파일 (2000줄) | ~60KB     | ~50-100MB   |

> 파일 단위로 파싱 (`createSourceFile`, Program 생성 안 함) → 메모리 효율적.
> 각 도구 호출은 독립적 → GC 후 메모리 해제.

---

## 컨텍스트 비용

### context-injector 주입량 (매 프롬프트)

```
[FCA-AI] Active in: /Users/user/project
Rules:
- CLAUDE.md: max 100 lines, must include 3-tier boundary sections
- SPEC.md: no append-only growth, must restructure on updates
- Organ directories (components, utils, types, hooks, helpers, lib, styles, assets, constants) must NOT have CLAUDE.md
- Test files: max 15 cases per spec.ts (3 basic + 12 complex)
- LCOM4 >= 2 → split module, CC > 15 → compress/abstract
```

| 항목      | 값                 |
| --------- | ------------------ |
| 문자 수   | ~400자             |
| 추정 토큰 | ~100-120 토큰      |
| 주입 빈도 | 매 사용자 프롬프트 |

### agent-enforcer 역할 제한 메시지

| 에이전트        | 메시지 길이 | 추정 토큰 |
| --------------- | ----------- | --------- |
| architect       | ~130자      | ~35 토큰  |
| qa-reviewer     | ~120자      | ~30 토큰  |
| implementer     | ~170자      | ~45 토큰  |
| context-manager | ~140자      | ~35 토큰  |

> 서브에이전트 생성 시 1회 주입. 에이전트 세션 내내 유지.

### pre-tool-validator 경고/차단 메시지

| 시나리오             | 메시지 예시                                                  | 추정 토큰 |
| -------------------- | ------------------------------------------------------------ | --------- |
| CLAUDE.md 100줄 초과 | "BLOCKED: CLAUDE.md exceeds 100-line limit (142 lines)..."   | ~25 토큰  |
| 3-tier 섹션 누락     | "CLAUDE.md is missing 3-tier boundary sections: Ask first"   | ~15 토큰  |
| SPEC.md append-only  | "BLOCKED: SPEC.md must not be append-only..."                | ~20 토큰  |
| Organ guard 차단     | "BLOCKED: Cannot create CLAUDE.md inside organ directory..." | ~25 토큰  |

> 차단/경고 시에만 발생. 정상 통과 시 추가 토큰 없음.

### 세션당 누적 컨텍스트 비용 추정

| 항목                        | 계산     | 추정 토큰       |
| --------------------------- | -------- | --------------- |
| 규칙 리마인더 (30 프롬프트) | 30 × 110 | ~3,300          |
| 에이전트 제한 (4 에이전트)  | 4 × 36   | ~144            |
| 경고 메시지 (5회 가정)      | 5 × 20   | ~100            |
| **세션 합계**               |          | **~3,544 토큰** |

---

## 번들 크기

### MCP 서버 번들

| 파일              | 크기  | 형식 | 포함 내용                                             |
| ----------------- | ----- | ---- | ----------------------------------------------------- |
| `libs/server.cjs` | 516KB | CJS  | MCP SDK + core + ast + metrics + compress + mcp/tools |

> `typescript`는 `external`로 제외 → 실행 시 `node_modules`에서 로드.
> minify 미적용 (디버깅 가독성 우선).
> sourcemap 미생성 (크기 절감).

### Hook 스크립트 번들

| 파일                             | 크기       | 형식 | 포함 내용                                 |
| -------------------------------- | ---------- | ---- | ----------------------------------------- |
| `scripts/pre-tool-validator.mjs` | 4.1KB      | ESM  | document-validator + hook 로직            |
| `scripts/structure-guard.mjs`    | 1.5KB      | ESM  | organ-classifier + hook 로직              |
| `scripts/agent-enforcer.mjs`     | 1.3KB      | ESM  | ROLE_RESTRICTIONS + hook 로직             |
| `scripts/context-injector.mjs`   | 988B       | ESM  | 규칙 문자열 + hook 로직                   |
| `scripts/change-tracker.mjs`     | 633B       | ESM  | ChangeQueue 타입 + hook 로직 _(disabled)_ |
| **Hook 합계**                    | **~8.5KB** |      |                                           |

### 전체 번들 합계

| 카테고리            | 크기       |
| ------------------- | ---------- |
| MCP 서버            | 516KB      |
| Hook 스크립트 (5개) | 8.5KB      |
| **총 번들**         | **~525KB** |

> `typescript` 패키지 (~50MB)는 별도. `npm install` 시 설치.

---

## 비용 절감 설계

### 1. PR 시점 동기화 (매 커밋 X)

```
개발 중 (커밋 N회)
├── PostToolUse hook: ChangeQueue에 기록만 ← 경량
├── 에이전트: 문서 수정 안 함
└── 비용: hook 실행 ~20ms × N회

PR 생성 시 (1회)
├── /sync: ChangeQueue drain → 배치 문서 갱신
├── 에이전트: CLAUDE.md/SPEC.md 갱신
└── 비용: MCP 호출 + 문서 재작성 (1회성)
```

**절감 효과**: 커밋 10회 중 문서 갱신은 1회만 실행 → 에이전트 비용 90% 절감.

### 2. 가역적 압축으로 토큰 절약

```
원본: 129줄 소스 코드 → ~500 토큰
압축: 3줄 레퍼런스 → ~15 토큰

절감율: ~97%
복원: 필요 시 디스크에서 원본 로드
```

에이전트가 모듈 존재를 인지하되, 상세 코드를 로드하지 않을 때 유용.
`/query` 스킬에서 컨텍스트 창 초과 방지에 활용.

### 3. 손실 요약으로 이력 압축

```
원본: 도구 호출 100회 이력 → ~2,000 토큰
요약: 집계 통계 1개 → ~50 토큰

절감율: ~97.5%
트레이드오프: 개별 호출 순서/내용 복원 불가
```

긴 세션에서 도구 호출 이력이 컨텍스트 창을 잠식하는 것을 방지.

### 4. 경량 Hook 설계

```
Hook 스크립트 특성:
├── esbuild self-contained → 모듈 해석 없음
├── 외부 의존성 0개 → 네트워크/파일시스템 I/O 없음
├── 순수 함수 → 상태 없음, 캐시 없음
└── 최소 출력 → 정상 시 `{"continue":true}` (17B)
```

### 5. 선택적 분석

MCP 도구는 에이전트가 명시적으로 호출할 때만 실행:

- TypeScript AST 파싱은 `/review` 또는 `/scan` 시에만 수행
- 일반 개발 중에는 Hook만 실행 (경량)
- 불필요한 분석을 자동 트리거하지 않음

---

## 성능 영향 요약

| 시나리오          | 추가 지연         | 추가 토큰 | 영향도             |
| ----------------- | ----------------- | --------- | ------------------ |
| 일반 프롬프트     | ~20ms (injector)  | ~110 토큰 | 무시 가능          |
| 일반 파일 Write   | ~35ms (2 hooks)   | 0 토큰    | 무시 가능          |
| CLAUDE.md Write   | ~80ms (검증 포함) | 0-25 토큰 | 낮음               |
| 서브에이전트 생성 | ~30ms (enforcer)  | ~35 토큰  | 무시 가능          |
| /review 실행      | ~1-5초 (AST 분석) | ~500 토큰 | 중간 (1회성)       |
| /sync 실행        | ~0.5-2초          | ~200 토큰 | 중간 (PR 시점 1회) |

---

## 관련 문서

- [01-ARCHITECTURE.md](./01-ARCHITECTURE.md) — esbuild 번들링 ADR
- [06-HOW-IT-WORKS.md](./06-HOW-IT-WORKS.md) — Hook/MCP 내부 동작
- [04-USAGE.md](./04-USAGE.md) — 빌드 및 설치 방법
