# Justifications — feature/issue-21

**Generated**: 2026-03-21T00:30:00.000Z
**Mode**: auto-accept

---

## FIX-001: core.test.ts 3+12 규칙 위반 — 테스트 파일 분리

- **Status**: ACCEPTED & APPLIED
- **Action**: `core.test.ts` (19 tests, 5 describe blocks) 를 4개 파일로 분리
  - `core-trace.test.ts` — trace() 파이프라인 통합 테스트 (8 tests)
  - `core-health.test.ts` — health() 테스트 (3 tests)
  - `core-graph.test.ts` — graph() 테스트 (3 tests)
  - `core-cache-options.test.ts` — noCache, deep, clearCache 테스트 (5 tests)
- **Justification**: 3+12 규칙(파일당 최대 15개 테스트)을 준수하기 위해 기능 단위로 분리. 각 파일이 독립적인 관심사를 담당하며 최대 8개 테스트로 규칙 내 유지.
- **Verification**: 전체 204 tests 통과, typecheck 통과

---

## FIX-002: graph() 공개 API 추가에 대한 DETAIL.md 업데이트 누락

- **Status**: ACCEPTED & APPLIED
- **Action**: 2개 DETAIL.md 파일 업데이트
  - `packages/line-lore/src/DETAIL.md` — `graph()` 함수 시그니처, `GraphOptions`, `GraphResult` 타입 계약 추가
  - `packages/line-lore/src/core/DETAIL.md` — `graph()` 오케스트레이션 흐름 및 `traverseIssueGraph` 위임 구조 문서화
- **Justification**: FCA-AI 규칙에 따라 공개 API가 추가될 때 DETAIL.md에 반드시 반영해야 함. `graph()`는 `index.ts`에서 export되는 공개 API이므로 문서 동기화가 필수.
- **Verification**: DETAIL.md 내용이 실제 코드의 `GraphOptions`, `GraphResult` 타입 및 `graph()` 함수 시그니처와 일치 확인
