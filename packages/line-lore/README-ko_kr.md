# @lumy-pack/line-lore

코드 라인을 git blame 분석과 플랫폼 API를 통해 원본 Pull Request로 역추적합니다.

## 주요 기능

- **라인-to-PR 역추적**: 모든 코드 라인을 몇 초 만에 출발지 PR로 역추적
- **4단계 파이프라인**: Blame → 외관상 변경 감지 → 계보 순회 → PR 검색
- **다중 플랫폼 지원**: GitHub, GitHub Enterprise, GitLab, GitLab self-hosted
- **운영 레벨**: 오프라인(Level 0)부터 전체 API 접근(Level 2)까지 우아한 기능 축소
- **이중 배포**: CLI 도구로 사용하거나 라이브러리로 import
- **스마트 캐싱**: git 작업 및 API 응답에 대한 내장 캐싱

## 설치

```bash
npm install @lumy-pack/line-lore
# 또는
yarn add @lumy-pack/line-lore
```

## 빠른 시작

### CLI 사용법

```bash
# 단일 라인을 PR로 역추적
npx @lumy-pack/line-lore trace src/auth.ts -L 42

# 라인 범위 역추적
npx @lumy-pack/line-lore trace src/config.ts -L 10,50

# squash merge 탐색을 포함한 깊은 역추적
npx @lumy-pack/line-lore trace src/auth.ts -L 42 --deep

# PR-to-issues 그래프 순회
npx @lumy-pack/line-lore graph --pr 42 --depth 2

# 시스템 상태 확인
npx @lumy-pack/line-lore health

# 캐시 삭제
npx @lumy-pack/line-lore cache clear

# JSON으로 출력
npx @lumy-pack/line-lore trace src/auth.ts -L 42 --output json

# LLM 소비 형식으로 출력
npx @lumy-pack/line-lore trace src/auth.ts -L 42 --output llm

# 포맷 억제, 데이터만 반환
npx @lumy-pack/line-lore trace src/auth.ts -L 42 --quiet
```

### 프로그래밍 API

```typescript
import { trace, health, clearCache } from '@lumy-pack/line-lore';

// 라인을 PR로 역추적
const result = await trace({
  file: 'src/auth.ts',
  line: 42,
});

console.log(result.nodes);           // TraceNode[]
console.log(result.operatingLevel);  // 0 | 1 | 2
console.log(result.warnings);         // 기능 축소 메시지
```

## 작동 원리

@lumy-pack/line-lore는 결정론적 4단계 파이프라인을 실행합니다:

1. **라인 → 커밋 (Blame)**: `-C -C -M` 플래그로 파일 이름 변경과 복사본 감지
2. **외관상 변경 감지**: AST 구조 비교로 포맷 전용 변경 건너뛰기
3. **커밋 → 병합 커밋**: ancestry-path 순회 + patch-id 매칭으로 병합 커밋 해결
4. **병합 커밋 → PR**: 커밋 메시지 파싱 + 플랫폼 API 검색

ML이나 휴리스틱을 사용하지 않으므로 결과는 항상 재현 가능합니다.

## 운영 레벨

- **Level 0**: Git만 사용 (오프라인, 최고 속도)
- **Level 1**: 플랫폼 CLI 감지됨 (인증되지 않음)
- **Level 2**: 전체 API 접근 (GitHub/GitLab 인증됨)

상위 레벨은 깊은 역추적, issue 그래프 순회, 더 정확한 PR 매칭을 지원합니다.

## 플랫폼 지원

- GitHub.com
- GitHub Enterprise Server
- GitLab.com
- GitLab Self-Hosted

## API 참조

### `trace(options: TraceOptions): Promise<TraceFullResult>`

코드 라인을 원본 PR로 역추적합니다.

**옵션:**
- `file` (string): 파일 경로
- `line` (number): 시작 라인 번호 (1-indexed)
- `endLine?` (number): 범위 쿼리의 종료 라인
- `remote?` (string): Git 원격 이름 (기본값: 'origin')
- `deep?` (boolean): squash merge 깊은 역추적 활성화
- `graphDepth?` (number): issue 그래프 순회 깊이
- `output?` ('human' | 'json' | 'llm'): 출력 형식
- `quiet?` (boolean): 포맷 억제
- `noAst?` (boolean): AST 분석 비활성화
- `noCache?` (boolean): 캐싱 비활성화

**반환값:**
```typescript
{
  nodes: TraceNode[];           // 계보 노드 배열 (커밋, PR 등)
  operatingLevel: 0 | 1 | 2;    // 기능 레벨
  featureFlags: FeatureFlags;   // 활성화된 기능
  warnings: string[];           // 기능 축소 알림
}
```

### `health(options?: { cwd?: string }): Promise<HealthReport>`

시스템 상태 확인: git 버전, 플랫폼 CLI 상태, 인증 여부.

### `clearCache(): Promise<void>`

PR 검색 및 patch-id 캐시 삭제.

### `traverseIssueGraph(adapter, startType, startNumber, options?): Promise<GraphResult>`

PR-to-issues 그래프 순회 (Level 2 접근 필요).

## CLI 참조

| 명령어 | 용도 |
|--------|------|
| `npx @lumy-pack/line-lore trace <file>` | 라인을 PR로 역추적 |
| `-L, --line <num>` | 시작 라인 (필수) |
| `--end-line <num>` | 범위의 종료 라인 |
| `--deep` | 깊은 역추적 (squash merge) |
| `--output <format>` | json, llm 또는 human으로 출력 |
| `--quiet` | 포맷 억제 |
| `npx @lumy-pack/line-lore health` | 시스템 상태 확인 |
| `npx @lumy-pack/line-lore graph --pr <num>` | PR 그래프 순회 |
| `--depth <num>` | 그래프 순회 깊이 |
| `npx @lumy-pack/line-lore cache clear` | 캐시 삭제 |

## 에러 처리

에러는 특정 에러 코드와 함께 `LineLoreError`를 통해 타입 지정됩니다:

```typescript
import { trace, LineLoreError } from '@lumy-pack/line-lore';

try {
  await trace({ file: 'src/auth.ts', line: 42 });
} catch (error) {
  if (error instanceof LineLoreError) {
    console.error(error.code);  // 예: 'FILE_NOT_FOUND'
    console.error(error.message);
    console.error(error.context); // 추가 메타데이터
  }
}
```

주요 에러 코드:
- `NOT_GIT_REPO` — git 저장소가 아님
- `FILE_NOT_FOUND` — 파일이 존재하지 않음
- `INVALID_LINE` — 라인 번호가 범위를 벗어남
- `GIT_BLAME_FAILED` — git blame 실행 실패
- `PR_NOT_FOUND` — 커밋에 해당하는 PR을 찾을 수 없음
- `CLI_NOT_AUTHENTICATED` — 플랫폼 CLI 인증되지 않음
- `API_RATE_LIMITED` — 플랫폼 API 속도 제한 도달

## 요구사항

- Node.js >= 20
- Git >= 2.27
- 선택사항: `gh` CLI >= 2.0 (GitHub API용)
- 선택사항: `glab` CLI >= 1.30 (GitLab API용)

## 라이선스

MIT
