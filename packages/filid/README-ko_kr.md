# @lumy-pack/filid

Claude Code 프로젝트의 구조와 문서를 자동으로 관리하는 플러그인입니다.

코드베이스가 커지면 AI 에이전트가 맥락을 잃고, 문서는 코드와 어긋나고, 디렉토리 구조는 일관성을 잃습니다. filid는 이 문제를 **프랙탈 아키텍처(FCA-AI)** 기반의 자동화된 규칙 시행으로 해결합니다.

---

## 설치

### Marketplace를 통한 설치 (권장)

```bash
# 1. Marketplace에 저장소 등록
claude plugin marketplace add https://github.com/vincent-kk/lumy-pack

# 2. 플러그인 설치
claude plugin install filid
```

설치 후 별도 설정 없이 모든 컴포넌트(Skills, MCP, Agents, Hooks)가 자동 등록됩니다.

### 개발자용 로컬 설치

```bash
# 모노레포 루트에서
yarn install

# 플러그인 빌드
cd packages/filid
yarn build          # TypeScript 컴파일 + 번들링

# Claude Code에서 플러그인 로드
claude --plugin-dir ./packages/filid
```

빌드하면 두 가지 산출물이 생성됩니다:

- `libs/server.cjs` — MCP 서버 (분석 도구 11개)
- `scripts/*.mjs` — Hook 스크립트 5개 (자동 규칙 시행)

---

## 사용법

filid 스킬은 **LLM 프롬프트**이지, CLI 명령어가 아닙니다. Claude Code 안에서 자연어로 대화하듯 호출합니다. `--fix` 같은 플래그도 LLM이 해석하는 힌트이므로, 자연어로 써도 동일하게 동작합니다.

### 프로젝트 초기화

```
/filid:init
/filid:init ./packages/my-app
```

프로젝트 디렉토리를 스캔하여 각 모듈에 `CLAUDE.md` 경계 문서를 생성합니다. `components/`, `utils/` 같은 유틸리티 디렉토리(organ)는 자동으로 건너뜁니다.

### 규칙 위반 찾고 수정하기

```
/filid:scan
/filid:scan src/core 쪽만 봐줘
/filid:scan 고칠 수 있는 건 고쳐줘
```

CLAUDE.md 100줄 초과, 3-tier 경계 섹션 누락, organ 디렉토리 내 CLAUDE.md 존재 등을 검출합니다.

### 코드 변경 후 문서 동기화

```
/filid:sync
/filid:sync 바뀌는 것만 미리 보여줘
/filid:sync critical 이상만 처리해줘
```

코드 변경으로 인한 구조적 drift를 감지하고, 해당 모듈의 CLAUDE.md/SPEC.md를 갱신합니다. 내부적으로 `drift-detect` MCP 도구를 사용합니다.

### PR 올리기 전 구조 검증

```
/filid:structure-review
/filid:structure-review 3단계만 실행해줘
```

경계 검사 → 문서 검증 → 의존성 분석 → 테스트 메트릭 → 복잡도 평가 → 최종 판정 순서로 진행됩니다.

### AI 코드 리뷰

가장 강력한 기능입니다. 다중 페르소나 합의체가 3단계로 코드를 리뷰합니다.

```
# 현재 브랜치 리뷰
/filid:code-review

# 특정 PR 리뷰
/filid:code-review https://github.com/owner/repo/pull/123

# 처음부터 다시 시작
/filid:code-review 처음부터 다시 해줘

# 리뷰 후 — 수정 요청 처리
/filid:resolve-review

# 수정 후 — 최종 판정
/filid:re-validate
```

**흐름:**

1. **`/filid:code-review`** — 위원회 선출 → 기술 검증 → 합의 → 리뷰 보고서 생성
2. **`/filid:resolve-review`** — 각 수정 요청에 대해 수용 또는 거부(사유 입력) 선택
3. **`/filid:re-validate`** — 수정 사항 반영 후 PASS/FAIL 최종 판정

산출물은 `.filid/review/<branch>/`에, 기술 부채는 `.filid/debt/`에 저장됩니다.

### FCA-AI가 뭔지 잘 모르겠을 때

```
/filid:guide
/filid:guide fractal 구조에 대해 알려줘
/filid:context-query organ 디렉토리에서 뭘 할 수 있어?
```

### 모듈 구조 개선이 필요할 때

```
/filid:restructure ./src/core
/filid:promote
```

---

## 자동으로 동작하는 것들

플러그인이 활성화되면 아래 Hook들이 **사용자 개입 없이** 자동 실행됩니다:

| 언제                          | 무엇을                                | 왜                                         |
| ----------------------------- | ------------------------------------- | ------------------------------------------ |
| 파일을 Write/Edit할 때        | CLAUDE.md 100줄 초과 검사             | 문서가 비대해지는 것을 방지                |
| 파일을 Write/Edit할 때        | organ 디렉토리 내 CLAUDE.md 생성 차단 | 유틸리티 폴더의 불필요한 문서화 방지       |
| 서브에이전트가 시작할 때      | 에이전트 역할 제한 주입               | architect가 코드를 수정하는 등의 월권 방지 |
| 사용자가 프롬프트를 입력할 때 | FCA-AI 규칙 컨텍스트 주입             | 에이전트가 규칙을 인지하고 작업하도록 보장 |

차단이 발생하면 이유와 함께 메시지가 표시되므로 별도 대응은 필요 없습니다.

---

## 전체 스킬 목록

| 스킬                      | 설명                                     |
| ------------------------- | ---------------------------------------- |
| `/filid:init`             | 프로젝트 FCA-AI 초기화                   |
| `/filid:scan`             | 규칙 위반 검출 (자동 수정 가능)          |
| `/filid:sync`             | 코드-문서 동기화                         |
| `/filid:structure-review` | PR 구조 검증 (6단계)                     |
| `/filid:promote`          | 안정된 테스트를 spec으로 승격            |
| `/filid:context-query`    | 구조 관련 질의응답                       |
| `/filid:guide`            | FCA-AI 가이드                            |
| `/filid:restructure`      | 모듈 리팩토링 가이드 + 마이그레이션 단계 |
| `/filid:code-review`      | 다중 페르소나 거버넌스 코드 리뷰         |
| `/filid:resolve-review`   | 수정 요청 해결                           |
| `/filid:re-validate`      | 수정 후 재검증 (PASS/FAIL)               |

---

## 핵심 규칙 요약

filid가 시행하는 주요 규칙입니다:

| 규칙                 | 기준                                               | 시행 방식                |
| -------------------- | -------------------------------------------------- | ------------------------ |
| CLAUDE.md 줄 수 제한 | 100줄 이하                                         | Hook 자동 차단           |
| 3-tier 경계 섹션     | "Always do" / "Ask first" / "Never do" 필수        | Hook 경고                |
| Organ 디렉토리 보호  | `components`, `utils`, `types` 등에 CLAUDE.md 금지 | Hook 자동 차단           |
| 테스트 밀도          | spec.ts당 최대 15개 (3 core + 12 edge)             | MCP 분석                 |
| 모듈 응집도          | LCOM4 >= 2이면 분할 권고                           | MCP 분석 + 의사결정 트리 |
| 순환 의존성          | 비순환 그래프(DAG) 유지                            | Core 검증                |

---

## 개발

```bash
yarn dev            # TypeScript watch 모드
yarn test           # Vitest watch
yarn test:run       # 1회 실행
yarn typecheck      # 타입 체크
yarn build          # tsc + node build-plugin.mjs
```

### 기술 스택

TypeScript 5.7 (+ Compiler API), @modelcontextprotocol/sdk, fast-glob, esbuild, Vitest, Zod

---

## 상세 문서

기술적 세부사항은 [`.metadata/`](./.metadata/) 디렉토리를 참조하세요:

| 문서                                                 | 내용                                           |
| ---------------------------------------------------- | ---------------------------------------------- |
| [ARCHITECTURE](./.metadata/01-ARCHITECTURE.md)       | 설계 철학, 4계층 아키텍처, ADR                 |
| [BLUEPRINT](./.metadata/02-BLUEPRINT.md)             | 30+ 모듈별 기술 청사진                         |
| [LIFECYCLE](./.metadata/03-LIFECYCLE.md)             | 스킬 워크플로우, 에이전트 협업, Hook 타임라인  |
| [USAGE](./.metadata/04-USAGE.md)                     | 설정 파일 구조, MCP/Hook JSON 예시, 트러블슈팅 |
| [COST-ANALYSIS](./.metadata/05-COST-ANALYSIS.md)     | Hook 오버헤드, 번들 크기, 컨텍스트 토큰 비용   |
| [HOW-IT-WORKS](./.metadata/06-HOW-IT-WORKS.md)       | AST 엔진, 의사결정 트리, MCP 라우팅            |
| [RULES-REFERENCE](./.metadata/07-RULES-REFERENCE.md) | 전체 규칙 카탈로그, 상수, 임계값               |
| [API-SURFACE](./.metadata/08-API-SURFACE.md)         | 공개 API 레퍼런스 (33 함수 + 30 타입)          |

[English documentation (README.md)](./README.md) is also available.

---

## License

MIT
