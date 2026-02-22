# MCP Tool 재사용 및 신규 도구

> 원본: BLUE-PRINT.md §5 | 관련: [01-COMPONENTS.md](./01-COMPONENTS.md), [04-SKILL-INTERFACES.md](./04-SKILL-INTERFACES.md)

## 5. 기존 MCP Tool 재사용 지점

### 5.1 Phase별 MCP Tool 사용 맵

의장-위임 패턴에 따라, Phase A/B의 MCP tool 호출은 **검증 Agent(Phase B subagent)**가 수행한다. 의장(Phase C)은 MCP tool을 직접 호출하지 않으며, verification.md에 정리된 결과만 Read한다.

| Phase          | 실행 주체       | MCP Tool                             | 호출 시점                 | 목적                                                          |
| -------------- | --------------- | ------------------------------------ | ------------------------- | ------------------------------------------------------------- |
| Phase A (분석) | 분석 Agent      | `fractal-navigate(classify)`         | 변경된 디렉토리에 대해    | fractal/organ 분류 확인                                       |
| Phase A        | 분석 Agent      | `fractal-scan`                       | 프로젝트 루트에 대해      | 전체 프랙탈 트리 구축                                         |
| Phase B (검증) | 검증 Agent      | `ast-analyze(lcom4)`                 | 변경된 클래스/모듈에 대해 | 응집도 검증 (split 필요 여부)                                 |
| Phase B        | 검증 Agent      | `ast-analyze(cyclomatic-complexity)` | 변경된 함수에 대해        | 복잡도 검증 (compress 필요 여부)                              |
| Phase B        | 검증 Agent      | `ast-analyze(dependency-graph)`      | 변경된 모듈에 대해        | 순환 의존성 검증                                              |
| Phase B        | 검증 Agent      | `ast-analyze(tree-diff)`             | 변경 전후 코드에 대해     | 의미론적 변경 분석                                            |
| Phase B        | 검증 Agent      | `test-metrics(check-312)`            | 변경된 spec.ts에 대해     | 3+12 규칙 위반 검증                                           |
| Phase B        | 검증 Agent      | `test-metrics(count)`                | 변경된 test/spec에 대해   | 테스트 케이스 수 확인                                         |
| Phase B        | 검증 Agent      | `test-metrics(decide)`               | 임계값 초과 모듈에 대해   | split/compress/parameterize 결정                              |
| Phase B        | 검증 Agent      | `structure-validate`                 | 변경된 모듈에 대해        | FCA-AI 구조 규칙 검증                                         |
| Phase B        | 검증 Agent      | `drift-detect`                       | 변경된 경로에 대해        | 구조 드리프트 감지                                            |
| Phase B        | 검증 Agent      | `doc-compress(auto)`                 | CLAUDE.md 검증 시         | 문서 압축 상태 검증                                           |
| Phase B        | 검증 Agent      | `rule-query(list)`                   | 리뷰 시작 시              | 활성 규칙 목록 로딩                                           |
| Phase C (합의) | 의장            | —                                    | —                         | MCP tool 직접 호출 없음. verification.md를 Read하여 결과 참조 |
| Phase A (분석) | 분석 Agent      | `review-manage(elect-committee)`     | 복잡도 판정 시            | 결정론적 위원회 선출                                          |
| Phase A        | 분석 Agent      | `review-manage(ensure-dir)`          | 리뷰 시작 시              | 리뷰 디렉토리 생성                                            |
| Phase B (검증) | 검증 Agent      | `debt-manage(calculate-bias)`        | 부채 현황 수집 시         | 결정론적 바이어스 수준 판정                                   |
| re-validate    | 스킬 직접       | `ast-analyze(tree-diff)`             | resolve 후 변경분에 대해  | Delta 기반 의미론적 변경 분석                                 |
| re-validate    | 스킬 직접       | `debt-manage(resolve)`               | 부채 해소 판정 시         | 해소된 부채 파일 삭제                                         |
| code-review    | 의장 (SKILL.md) | `review-manage(checkpoint)`          | 스킬 시작 시              | 체크포인트 상태 감지                                          |
| code-review    | 의장 (SKILL.md) | `review-manage(normalize-branch)`    | 브랜치 정규화 시          | 브랜치명 → 디렉토리 안전 문자열                               |

### 5.2 신규 MCP Tool: 2개 추가

기존 9개 MCP tool은 FCA-AI 결정론적 검증을 커버한다. 거버넌스 워크플로우 고유의 **결정론적 연산**(브랜치 정규화, 위원회 선출, 부채 가중치 계산)은 LLM 추론에 맡기면 일관성이 보장되지 않으므로, 2개 신규 MCP tool을 추가한다.

| MCP Tool        | 설명                                                                        | 설계 근거                                                   |
| --------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `review-manage` | 리뷰 세션 관리 — 브랜치 정규화, 디렉토리 CRUD, 체크포인트 감지, 위원회 선출 | 조건부 규칙이 복잡하여 LLM 추론에 일관성이 보장되지 않음    |
| `debt-manage`   | 부채 관리 — CRUD, 가중치 계산, 바이어스 수준 판정, touch_count 업데이트     | 가중치 공식과 멱등성 보호는 결정론적 연산이므로 코드로 보장 |
