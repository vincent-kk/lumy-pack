# 04. 이슈 그래프, 이중 배포, CLI, LLM 출력

> 원본: [architecture.md](./architecture.md) 6~9장

## 이슈 그래프 탐색

PR은 이슈, 다른 PR, 마일스톤과 연결된다.
"이 코드 라인이 어떤 요구사항/버그에서 비롯되었는가"까지 추적.

```
코드 라인 → 커밋 → PR #102 → Issue #55 "로그인 실패 버그"
                            → Issue #60 "보안 감사 결과"
```

**탐색 경로:**
- GitHub: GraphQL `closingIssuesReferences` + body 내 `#NNN` 파싱
- GitLab: REST `closes_issues` + description 파싱

**깊이 제어:** `--graph-depth 0` (PR까지) / `1` (이슈까지) / `2` (2홉)
**순환 방지:** 방문한 노드 Set 유지.

```bash
line-lore graph pr 102 --depth 2 --json
line-lore graph issue 55 --depth 1
```

## 이중 배포: CLI + 라이브러리

```
"exports": { ".": { "import": "./dist/index.mjs", "require": "./dist/index.cjs" } }
"bin": "dist/cli.mjs"
```

```typescript
// 프로그래밍 API
export function trace(options: TraceOptions): Promise<TraceResult>;
export function graph(options: GraphOptions): Promise<GraphResult>;
export function health(): Promise<HealthReport>;
export function clearCache(): Promise<void>;
```

## CLI 인터페이스

### 대화형 vs 비대화형 자동 감지

비대화형 조건: `!isTTY` / `--json` / `--quiet` / `--output llm` / `CI=true`

### 명령어 전체 목록

```bash
# trace
line-lore trace <file> -L <line>                  # 기본
line-lore trace <file> -L <start>,<end>           # 범위
line-lore trace <file> -L <line> --deep           # 심층
line-lore trace <file> -L <line> --graph-depth 1  # 이슈까지

# 출력 제어 (공통)
--json / --quiet / --output human|json|llm / --no-color / --no-cache

# graph / health / cache
line-lore graph pr <number> [--depth N] [--json]
line-lore health [--json]
line-lore cache clear | stats
line-lore help [--json]
```

### 단일 라인 스크립팅

```bash
PR_NUM=$(line-lore trace src/auth.ts -L 42 --quiet)
line-lore trace src/auth.ts -L 42 --json | jq '.nodes[-1].prUrl'
```

## LLM용 JSON 도움말 및 응답 정규화

### `help --json` — 도구 스키마 제공

LLM 에이전트가 도구의 기능/파라미터를 기계적으로 이해할 수 있는 JSON 스키마.

### `--output llm` — 정규화 응답 봉투

```typescript
interface NormalizedResponse<T> {
  tool: 'line-lore';
  command: string;
  version: string;
  timestamp: string;              // ISO 8601
  status: 'success' | 'partial' | 'error';
  operatingLevel: 0 | 1 | 2;
  data?: T;
  error?: {
    code: string;                 // LineLoreErrorCode
    message: string;
    stage?: number;               // 실패한 단계 (1-4)
    recoverable: boolean;
    suggestion?: string;          // LLM 후속 액션 힌트
  };
  partialData?: Partial<T>;
  warnings?: string[];
  hints?: {
    canRetryWithFlags?: string[];
    relatedCommands?: string[];
    cacheHit?: boolean;
  };
}
```

**설계 의도**: LLM이 `status`로 성공/부분/에러를 판별하고,
`hints.relatedCommands`로 후속 액션을 자율 결정.
