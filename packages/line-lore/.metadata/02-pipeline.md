# 02. 파이프라인 단계별 상세 설계

> 원본: [architecture.md](./architecture.md) 3장

## 1단계: 라인 → 커밋

### 1단계-A: 강화된 Git Blame

```
명령어:  git blame -w -C -C -M --porcelain -L <start>,<end> <file>

  -w          공백 변경 무시
  -M          동일 파일 내 라인 이동 감지
  -C -C       전체 프로젝트에서 복사/이동 추적
  --porcelain 기계 판독용 출력
```

> **학술적 근거** (발췌: raw/line-to-pr-trace-design-review.md 6.2절):
> 단순 git blame은 공백 추가나 라인 이동 같은 외관상 변경으로 원본 해시를
> 놓치는 치명적 단점이 있다. `-w -C -C -M` 조합으로 동일 파일/타 파일 내
> 복사 및 이동을 추적하여 이를 결정론적으로 극복한다.

**외관상 커밋 판별 휴리스틱:**
- 공백만 변경된 diff (정규화 후 동일)
- import 순서만 변경
- 괄호/포맷팅만 변경 (AST 구조 동일)

→ 외관상 판정 시 1단계-B로 전달

### 1단계-B: AST 구조 시그니처 비교

```
알고리즘:
1. 현재 파일 파싱 → 심볼 맵 추출 (함수, 클래스, 메서드)
2. 대상 라인 포함 심볼 식별
3. 심볼 본문의 콘텐츠 해시 계산 (공백 정규화)
4. 부모 커밋 역방향 순회:
   a. 부모 파싱 → 심볼 맵 + 콘텐츠 해시 추출
   b. 다른 심볼 이름에서 일치 → "이름 변경"
   c. 다른 파일에서 일치 → "이동/추출"
   d. 일치 없음 → 진짜 기원
5. 콘텐츠 해시 최초 등장 커밋 반환
```

> **학술적 근거** (발췌: raw/line-to-pr-trace-design-review.md 6.2절):
> 메서드 추출(Extract Method)이나 변수명 일괄 변경 같은 구조적 리팩토링은
> 텍스트 diff로 추적 불가능. RA-SZZ(Refactoring-Aware SZZ)가 해결하고자 한
> 문제와 동일. AST 파서를 통해 코드가 어느 구조에서 분리/병합되었는지
> 결정론적으로 찾아낸다.

**콘텐츠 해시 알고리즘:**
```
1. AST 노드 텍스트 추출
2. 공백, 주석, 문자열 리터럴 제거
3. 식별자 → 위치 기반 토큰 정규화 ($1, $2, ...)
4. SHA-256 해시
```

두 비교 모드:
- **정확 해시**: 동일 로직 + 이름만 변경 → `confidence: 'exact'`
- **구조적 해시**: 동일 구조 + 변수명 변경 → `confidence: 'structural'`

## 2단계: 커밋 → 병합 커밋

```
git log --merges --ancestry-path <sha>..HEAD --topo-order --reverse --format="%H %P %s"
```

> **학술적 근거** (발췌: raw/line-to-pr-trace-design-review.md 3장):
> commit-graph의 생성 번호(Generation Number)는 위상 정렬 연산을 극적으로
> 가속한다. 탐색 중인 브랜치의 생성 번호가 목표 커밋보다 작아지면 즉시
> 가지치기(Pruning). 대형 저장소에서 최대 88% 속도 향상.

**commit-graph 가속**: 미설정 시 `git commit-graph write` 안내 힌트 출력.

병합 커밋 없으면(squash/rebase) → 3단계로 전달.

## 3단계: 단절 해소 (Patch-ID)

```
1. git diff <sha>^..<sha> | git patch-id --stable → 콘텐츠 기반 해시
2. 메인 브랜치 최근 500개 커밋 순회하며 patch-id 비교
3. 일치 발견 → 4단계 진행 / 일치 없음 → API 폴백
```

> **학술적 근거** (발췌: raw/line-to-pr-trace-design-review.md 6.4절):
> `git patch-id --stable`은 커밋 메타데이터를 모두 배제하고 코드 변경 사항
> 자체만으로 SHA-1 해시를 생성. 리베이스되어 해시가 바뀌었더라도 변경
> 내용물이 동일한 커밋을 100% 결정론적으로 매핑.

**최적화**: patch-id 캐시 저장 (불변). `--scan-depth`로 스캔 범위 조절.

## 4단계: PR 매핑

Level 2 (API) → Level 1 (메시지 파싱) → Level 0 (Git 전용 + 설치 안내)

**심층 추적 (`--deep`)**: squash PR 내부를 API로 재귀 탐색 → 중첩 PR 트리 구축.

## 최종 출력: TraceNode 배열

```typescript
type TraceNodeType =
  | 'original_commit' | 'cosmetic_commit' | 'merge_commit'
  | 'rebased_commit' | 'pull_request' | 'issue';

interface TraceNode {
  type: TraceNodeType;
  sha?: string;
  trackingMethod: 'blame' | 'blame-CMw' | 'ast-signature'
    | 'ancestry-path' | 'patch-id' | 'api' | 'message-parse' | 'issue-link';
  confidence: 'exact' | 'structural' | 'heuristic';
  prNumber?: number; prUrl?: string; prTitle?: string;
  patchId?: string; note?: string; mergedAt?: string;
  issueNumber?: number; issueUrl?: string; issueTitle?: string;
  issueState?: 'open' | 'closed'; issueLabels?: string[];
}
```
