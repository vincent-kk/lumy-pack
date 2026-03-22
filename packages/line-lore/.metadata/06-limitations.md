# 06. 알고리즘 제한사항 및 알려진 한계

> 원본: [architecture.md](./architecture.md) — CCG 평가 기반 보완

line-lore의 PR 탐색 알고리즘은 대부분의 실전 시나리오를 커버하지만,
특정 환경이나 워크플로에서 구조적으로 탐지가 불가능하거나 성능이 저하되는 케이스가 존재한다.

## 1. Conflict-Resolved Rebase Gap

**설명:** rebase 과정에서 충돌 해결(conflict resolution)이 발생하면,
rebased 커밋의 diff가 원본 커밋과 달라지면서 `git patch-id --stable` 해시가 불일치한다.

**영향:**
- Strategy 4(Patch-ID 매칭)가 일치 커밋을 찾지 못함
- Level 2(API): `adapter.getPRForCommit()`로 해결 가능 (플랫폼이 원본 SHA를 인덱싱한 경우)
- Level 1(메시지 파싱 전용): 탐지 불가능 — 구조적 한계

**완화:** Level 2 운영을 권장. `gh auth login`으로 API 접근을 활성화하면 대부분의 경우 해결된다.

## 2. Partial Clone 환경 (--filter=tree:0)

**설명:** treeless partial clone에서 `git log -500 -p` (Strategy 4)를 실행하면,
각 커밋의 tree/blob 오브젝트를 동기적으로 다운로드하여 수백 MB의 네트워크 I/O가 발생한다.

**영향:**
- CLI가 수 분간 응답 없이 멈추는 것처럼 보일 수 있음
- CI/CD 환경(`actions/checkout --filter`)에서 특히 문제

**완화:** `checkCloneStatus()`가 partial clone을 감지하면 Strategy 4를 자동으로 스킵한다.
`git config --get extensions.partialclone` 값이 존재하면 partial clone으로 판정.
이 경우 Strategy 1~3만으로 PR을 탐색하며, Patch-ID 매칭은 건너뛴다.

## 3. Shallow Repository (--depth N)

**설명:** shallow clone에서는 DAG가 불완전하여
`git log --ancestry-path` 결과가 실제 병합 커밋까지 도달하지 못할 수 있다.

**영향:**
- Strategy 2(Ancestry-path)가 빈 결과를 반환
- Strategy 4(Patch-ID)도 스캔 범위 내에 대상 커밋이 없을 수 있음
- Level 2(API)만 확실한 대안

**완화:** `checkCloneStatus()`가 shallow 상태를 감지하면 health 리포트에 힌트를 추가한다.
`git fetch --unshallow`로 전체 히스토리를 복원하면 해결된다.

## 4. Bitbucket 플랫폼 미지원

**설명:** 현재 `extractPRFromMergeMessage()`는 GitHub, GitLab, Azure DevOps의 병합 메시지 패턴만 지원한다.
Bitbucket의 기본 병합 메시지(`Pull request #N: title`)에 대한 정규식은 false positive 위험으로 연기되었다.

**false positive 예시:**
- `"Fixed Pull request #42 comments"` — 병합이 아닌 일반 커밋에서 매칭
- `"Reverted Pull request #99"` — 되돌리기 커밋에서 매칭

**영향:**
- Bitbucket 저장소에서 Strategy 2(메시지 파싱)가 PR 번호를 추출하지 못함
- Strategy 3(API)로 해결 가능하나, Bitbucket 어댑터도 현재 미구현

**계획:** Bitbucket 플랫폼 어댑터 구현 시 regex를 함께 추가한다.
어댑터가 있으면 regex 매칭 결과를 API로 검증할 수 있어 false positive를 제거할 수 있다.

## 5. SZZ/RA-SZZ 알고리즘과의 비교

**SZZ (Sliwerski-Zimmermann-Zeller):**
- 목적: 버그를 도입한 커밋(bug-introducing commit) 식별
- 방향: backward — 수정 커밋에서 역방향으로 blame 추적
- 한계: 공백/포맷 변경에 민감

**RA-SZZ (Refactoring-Aware SZZ):**
- SZZ의 개선: 리팩토링(Extract Method, 이름 변경)을 감지하여 건너뛰는 메커니즘 추가
- AST diff를 활용하여 구조적 동등성 판단

**line-lore:**
- 목적: PR을 도입한 커밋(PR-introducing commit) 식별 — SZZ와 다른 목표
- 방향: forward — blame 커밋에서 HEAD 방향으로 ancestry-path 탐색
- AST 비교: RA-SZZ와 유사하게 `@ast-grep/napi`로 코스메틱 변경 건너뛰기
- Patch-ID: SZZ에는 없는 rebase/squash 해소 메커니즘 (`git patch-id --stable`)
- 운영 레벨: API 없이도 동작하는 graceful degradation (SZZ는 버전 관리 시스템 전용)

**핵심 차이:** SZZ 계열은 "어떤 커밋이 버그를 만들었는가"를, line-lore는 "어떤 PR이 이 코드를 도입했는가"를 묻는다.
기법(blame + AST)은 유사하지만 탐색 방향과 목적이 다르다.

## 6. 재귀 호출 깊이 제한

**설명:** Strategy 4에서 patch-id 매칭 후 `lookupPR()` 재귀 호출 시,
내부 `_recursionDepth`가 최대 2로 제한된다.

**영향:**
- 3-hop 이상의 patch-id 체인(A→B→C→D)은 추적 불가
- 실전에서 3-hop 체인은 극히 드묾 (99%+ 케이스가 1-hop)

**완화:** 제한에 도달하면 `null`을 반환하고, Strategy 3(API)이 이미 시도된 상태이므로
실질적으로 놓치는 PR은 거의 없다.
