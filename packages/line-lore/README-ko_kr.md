# @lumy-pack/line-lore

코드 라인을 git blame 분석과 플랫폼 API를 통해 원본 Pull Request로 역추적합니다.

## 주요 기능

- **라인-to-PR 역추적**: 모든 코드 라인을 몇 초 만에 출발지 PR로 역추적
- **4단계 파이프라인**: Blame → 외관상 변경 감지 → 계보 순회 → PR 검색
- **PR/Issue 그래프 순회**: PR과 Issue 간 관계를 edge 정보와 함께 탐색
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
npx @lumy-pack/line-lore graph pr 42 --depth 2

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
import { trace, graph, health, clearCache } from '@lumy-pack/line-lore';

// 라인을 PR로 역추적
const result = await trace({
  file: 'src/auth.ts',
  line: 42,
});

// PR 노드 찾기
const prNode = result.nodes.find(n => n.type === 'pull_request');
if (prNode) {
  console.log(`PR #${prNode.prNumber}: ${prNode.prTitle}`);
}

// PR → Issue 그래프 순회
const graphResult = await graph({ type: 'pr', number: 42, depth: 1 });
for (const node of graphResult.nodes) {
  if (node.type === 'issue') {
    console.log(`Issue #${node.issueNumber}: ${node.issueTitle}`);
  }
}

// 시스템 준비 상태 확인
const report = await health();
console.log(`운영 레벨: ${report.operatingLevel}`);
console.log(`Git 버전: ${report.gitVersion}`);
```

## 작동 원리

@lumy-pack/line-lore는 결정론적 4단계 파이프라인을 실행합니다:

1. **라인 → 커밋 (Blame)**: `-C -C -M` 플래그로 파일 이름 변경과 복사본 감지
2. **외관상 변경 감지**: AST 구조 비교로 포맷 전용 변경 건너뛰기
3. **커밋 → 병합 커밋**: ancestry-path 순회 + patch-id 매칭으로 병합 커밋 해결
4. **병합 커밋 → PR**: 커밋 메시지 파싱 + 플랫폼 API 검색 (미병합 PR 필터링)

ML이나 휴리스틱을 사용하지 않으므로 결과는 항상 재현 가능합니다.

## 출력 이해하기

### TraceNode — 출력의 핵심 단위

`trace()` 호출은 `nodes` 배열을 반환합니다. 각 노드는 코드 라인에서 PR까지의 계보 체인에서 하나의 단계를 나타냅니다. 노드는 가장 최근(해당 라인의 직접 커밋)부터 가장 먼 것(PR 또는 issue)까지 순서대로 나열됩니다.

```typescript
interface TraceNode {
  type: TraceNodeType;         // 이 노드가 나타내는 것
  sha?: string;                // Git 커밋 해시 (40자)
  trackingMethod: TrackingMethod;  // 이 노드가 발견된 방법
  confidence: Confidence;      // 이 결과의 신뢰도
  prNumber?: number;           // PR/MR 번호 (pull_request 노드에서만)
  prUrl?: string;              // PR 전체 URL (Level 2 API 접근 시에만)
  prTitle?: string;            // PR 제목 (Level 2 API 접근 시에만)
  mergedAt?: string;           // PR 병합 시각 (ISO 8601)
  patchId?: string;            // Git patch-id (rebased_commit 노드에서만)
  note?: string;               // 추가 컨텍스트 (예: "Cosmetic change: whitespace")
  issueNumber?: number;        // Issue 번호 (issue 노드에서만)
  issueUrl?: string;           // Issue URL
  issueTitle?: string;         // Issue 제목
  issueState?: 'open' | 'closed';
  issueLabels?: string[];
}
```

### 노드 유형

| 유형 | 기호 | 의미 | 나타나는 조건 |
|------|------|------|-------------|
| `original_commit` | `●` | 이 라인을 도입하거나 마지막으로 수정한 커밋 | 항상 (최소 1개) |
| `cosmetic_commit` | `○` | 포맷만 변경한 커밋 (공백, import 정렬) | AST가 로직 변경 없음을 감지할 때 |
| `merge_commit` | `◆` | 베이스 브랜치의 병합 커밋 | 병합 기반 워크플로 |
| `rebased_commit` | `◇` | 원본 커밋의 리베이스된 버전 | 리베이스 워크플로에서 patch-id 매칭 시 |
| `pull_request` | `▸` | 이 변경을 도입한 PR/MR | PR이 발견될 때 (Level 1 또는 2) |
| `issue` | `▹` | PR에 연결된 issue | `--graph-depth >= 1` + Level 2일 때 |

### 추적 방법

| 방법 | 단계 | 의미 |
|------|------|------|
| `blame-CMw` | 1 | `git blame -C -C -M -w`로 발견 |
| `ast-signature` | 1-B | AST 구조 비교로 발견 |
| `message-parse` | 3 | 병합 커밋 메시지에서 PR 번호 추출 (예: `Merge pull request #42`) |
| `ancestry-path` | 3 | `git log --ancestry-path --merges`로 발견 |
| `patch-id` | 3 | `git patch-id`로 매칭 (리베이스 감지) |
| `api` | 4 | GitHub/GitLab REST API로 발견 |
| `issue-link` | 4+ | API의 PR-to-issue 링크로 발견 |

### 신뢰도 수준

| 수준 | 의미 |
|------|------|
| `exact` | 결정론적 매칭 (blame, API 조회) |
| `structural` | AST 구조 일치하지만 바이트 단위로는 다름 |
| `heuristic` | 최선의 추정 (메시지 파싱, patch-id) |

### 출력 예시

**일반적인 merge 워크플로 (Level 2):**
```
● Commit a1b2c3d [exact] via blame-CMw
▸ PR #42 feat: add authentication
  └─ https://github.com/org/repo/pull/42
```

**Squash merge (Level 2):**
```
● Commit e4f5a6b [exact] via blame-CMw
▸ PR #55 refactor: user service
  └─ https://github.com/org/repo/pull/55
```

**외관상 변경 감지 (AST 활성화):**
```
○ Cosmetic d7e8f9a [exact] Cosmetic change: whitespace-only
● Commit b2c3d4e [structural] via ast-signature
▸ PR #31 feat: original logic
  └─ https://github.com/org/repo/pull/31
```

**Level 0 (오프라인 — 플랫폼 CLI 없음):**
```
● Commit a1b2c3d [exact] via blame-CMw

⚠ Could not detect platform. Running in Level 0 (git only).
```

**Level 1 (CLI 설치됨, 미인증):**
```
● Commit a1b2c3d [exact] via blame-CMw
▸ PR #42 [heuristic] via message-parse

⚠ Platform CLI not authenticated. Running in Level 1 (local only).
```

**JSON 출력 (`--output json`):**
```json
{
  "nodes": [
    {
      "type": "original_commit",
      "sha": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
      "trackingMethod": "blame-CMw",
      "confidence": "exact"
    },
    {
      "type": "pull_request",
      "sha": "f0e1d2c3b4a5f6e7d8c9b0a1f2e3d4c5b6a7f8e9",
      "trackingMethod": "api",
      "confidence": "exact",
      "prNumber": 42,
      "prUrl": "https://github.com/org/repo/pull/42",
      "prTitle": "feat: add authentication",
      "mergedAt": "2025-03-15T10:30:00Z"
    }
  ],
  "operatingLevel": 2,
  "featureFlags": {
    "astDiff": true,
    "deepTrace": false,
    "commitGraph": false,
    "graphql": true
  },
  "warnings": []
}
```

**Quiet 모드 (`--quiet`):**
```
42
```
PR 번호만 반환합니다. PR을 찾지 못하면 짧은 커밋 SHA를 반환합니다 (예: `a1b2c3d`).

### 결과 해석 가이드

| 보이는 것 | 의미 |
|-----------|------|
| `original_commit`만 있음 | 커밋은 찾았지만 PR을 연결할 수 없음 (직접 push이거나 Level 0) |
| `original_commit` + `pull_request` | 라인 → 커밋 → PR 역추적 성공 |
| `cosmetic_commit` + `original_commit` + `pull_request` | 라인이 포맷 변경됨; AST가 실제 로직 변경까지 추적 |
| `prUrl`이 비어 있음 | 메시지 파싱으로 PR을 찾음 (Level 1) — API 세부 정보 없음 |
| `warnings` 배열에 항목 있음 | 일부 기능 축소 — `operatingLevel` 확인 필요 |
| `operatingLevel: 0` | 플랫폼 CLI 없음 — git blame 결과만 사용 가능 |
| `operatingLevel: 1` | CLI 발견했으나 미인증 — 병합 메시지 기반 PR 검색만 가능 |
| `operatingLevel: 2` | 전체 API 접근 — 가장 정확한 결과 |

## 운영 레벨

| 레벨 | 요구사항 | 가능한 기능 | 불가능한 기능 |
|------|---------|------------|-------------|
| **0** | Git만 있으면 됨 | Blame, AST diff | PR 검색, issue 그래프 |
| **1** | `gh`/`glab` CLI 설치됨 | Blame, AST diff, 병합 메시지 기반 PR 검색 | API 기반 PR 검색, issue 그래프, deep trace |
| **2** | `gh`/`glab` CLI 인증됨 | 모든 기능 | — |

`line-lore health`로 현재 레벨을 확인할 수 있습니다:
```bash
npx @lumy-pack/line-lore health
```

### 레벨 업그레이드 방법

```bash
# Level 0 → 1: CLI 설치
brew install gh        # GitHub
brew install glab      # GitLab

# Level 1 → 2: 인증
gh auth login          # GitHub
glab auth login        # GitLab

# GitHub Enterprise: 호스트네임을 지정하여 인증
gh auth login --hostname git.corp.com
```

## 플랫폼 지원

- GitHub.com
- GitHub Enterprise Server
- GitLab.com
- GitLab Self-Hosted

플랫폼은 git remote URL에서 자동 감지됩니다. 알 수 없는 호스트의 경우, 기본 브랜치 감지는 로컬 `origin/HEAD` symbolic ref를 사용합니다.

## 프로그래밍 API 참조

모든 함수는 패키지 루트에서 export됩니다:

```typescript
import { trace, graph, health, clearCache, LineLoreError } from '@lumy-pack/line-lore';
```

### `trace(options): Promise<TraceFullResult>`

코드 라인을 원본 PR로 역추적합니다.

**옵션 (`TraceOptions`):**

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|---------|------|------|--------|------|
| `file` | `string` | 예 | — | 파일 경로 |
| `line` | `number` | 예 | — | 시작 라인 번호 (1-indexed) |
| `endLine` | `number` | 아니오 | — | 범위 쿼리의 종료 라인 |
| `remote` | `string` | 아니오 | `'origin'` | Git 원격 이름 |
| `deep` | `boolean` | 아니오 | `false` | patch-id 스캔 범위 확대(500→2000), merge commit 매칭 후에도 추가 탐색 |
| `noAst` | `boolean` | 아니오 | `false` | AST 분석 비활성화 |
| `noCache` | `boolean` | 아니오 | `false` | 캐시 읽기/쓰기 비활성화 |

**반환값 (`TraceFullResult`):**

```typescript
{
  nodes: TraceNode[];           // 계보 체인 (커밋 → PR → issue)
  operatingLevel: 0 | 1 | 2;   // 현재 기능 레벨
  featureFlags: FeatureFlags;   // 활성화된 기능
  warnings: string[];           // 기능 축소 알림
}
```

**예시 — PR 정보 추출:**

```typescript
const result = await trace({ file: 'src/auth.ts', line: 42 });

// PR 찾기
const prNode = result.nodes.find(n => n.type === 'pull_request');
if (prNode) {
  console.log(`PR #${prNode.prNumber}: ${prNode.prTitle}`);
  console.log(`URL: ${prNode.prUrl}`);       // Level 2에서만
  console.log(`병합 시각: ${prNode.mergedAt}`);  // Level 2에서만
} else {
  const commit = result.nodes.find(n => n.type === 'original_commit');
  console.log(`직접 커밋: ${commit?.sha}`);
}

// 결과 축소 여부 확인
if (result.operatingLevel < 2) {
  console.warn('제한된 결과:', result.warnings);
}
```

**예시 — 라인 범위 역추적:**

```typescript
const result = await trace({
  file: 'src/config.ts',
  line: 10,
  endLine: 50,
  deep: true,    // squash merge를 더 열심히 탐색
  noCache: true, // 신선한 결과를 위해 캐시 건너뛰기
});
```

### `graph(options): Promise<GraphResult>`

PR/issue 관계 그래프를 순회합니다. Level 2 (인증된 CLI)가 필요합니다.

**옵션 (`GraphOptions`):**

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|---------|------|------|--------|------|
| `type` | `'pr' \| 'issue'` | 예 | — | 시작 노드 타입 |
| `number` | `number` | 예 | — | PR 또는 issue 번호 |
| `depth` | `number` | 아니오 | `2` | 순회 깊이 |
| `remote` | `string` | 아니오 | `'origin'` | Git 원격 이름 |

**반환값 (`GraphResult`):**

```typescript
{
  nodes: TraceNode[];  // 발견된 모든 노드 (PR + issue)
  edges: Array<{       // 노드 간 관계
    from: string;      // 소스 노드 식별자
    to: string;        // 타겟 노드 식별자
    relation: string;  // 관계 유형 (예: "closes", "references")
  }>;
}
```

**예시 — PR에 연결된 issue 찾기:**

```typescript
const result = await graph({ type: 'pr', number: 42, depth: 1 });

const issues = result.nodes.filter(n => n.type === 'issue');
for (const issue of issues) {
  console.log(`#${issue.issueNumber} [${issue.issueState}]: ${issue.issueTitle}`);
  console.log(`  Labels: ${issue.issueLabels?.join(', ')}`);
}

// edge 정보로 관계 세부사항 확인
for (const edge of result.edges) {
  console.log(`${edge.from} -[${edge.relation}]-> ${edge.to}`);
}
```

**예시 — issue에서 의존성 맵 구성:**

```typescript
const result = await graph({ type: 'issue', number: 100, depth: 2 });

const prs = result.nodes.filter(n => n.type === 'pull_request');
console.log(`issue #100에 연결된 PR ${prs.length}개`);
```

### `health(options?): Promise<HealthReport & { operatingLevel }>`

시스템 준비 상태 확인: git 버전, 플랫폼 CLI 상태, 인증 여부.

**옵션:**

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|---------|------|------|--------|------|
| `cwd` | `string` | 아니오 | process cwd | 작업 디렉터리 |

**반환값:**

```typescript
{
  gitVersion: string;          // 예: "2.43.0"
  commitGraph: boolean;        // commit-graph 파일 감지됨
  bloomFilter: boolean;        // bloom filter 지원 가능
  hints: string[];             // 최적화 제안
  operatingLevel: 0 | 1 | 2;  // 현재 기능 레벨
}
```

**예시 — 배치 처리 전 사전 점검:**

```typescript
const report = await health();

if (report.operatingLevel < 2) {
  console.error('전체 API 접근이 필요합니다. 실행: gh auth login');
  process.exit(1);
}

if (!report.bloomFilter) {
  console.warn('다음 명령을 실행하는 것을 권장합니다: git commit-graph write --reachable');
}
```

### `clearCache(): Promise<void>`

PR 검색 및 patch-id 캐시를 삭제합니다.

```typescript
await clearCache();
```

### `traverseIssueGraph(adapter, startType, startNumber, options?)`

`PlatformAdapter` 인스턴스가 필요한 저수준 그래프 순회입니다. 어댑터 생성을 직접 제어해야 하는 경우가 아니라면 `graph()`를 사용하세요.

## 프로그래밍 활용 패턴

### VSCode 확장 연동

```typescript
import { trace } from '@lumy-pack/line-lore';

async function getPRForActiveLine(filePath: string, lineNumber: number) {
  const result = await trace({ file: filePath, line: lineNumber });

  const pr = result.nodes.find(n => n.type === 'pull_request');
  if (pr?.prUrl) {
    return { number: pr.prNumber, title: pr.prTitle, url: pr.prUrl };
  }

  return null;
}
```

### CI 파이프라인 — PR 영향 분석

```typescript
import { trace, graph } from '@lumy-pack/line-lore';

async function analyzeChangedLines(file: string, lines: number[]) {
  const prs = new Map<number, { title: string; issues: string[] }>();

  for (const line of lines) {
    const result = await trace({ file, line });
    const pr = result.nodes.find(n => n.type === 'pull_request');

    if (pr?.prNumber && !prs.has(pr.prNumber)) {
      const graphResult = await graph({
        type: 'pr',
        number: pr.prNumber,
        depth: 1,
      });

      const issues = graphResult.nodes
        .filter(n => n.type === 'issue')
        .map(n => `#${n.issueNumber}`);

      prs.set(pr.prNumber, { title: pr.prTitle ?? '', issues });
    }
  }

  return prs;
}
```

### 캐시 제어를 통한 배치 처리

```typescript
import { trace, clearCache } from '@lumy-pack/line-lore';

async function batchTrace(entries: Array<{ file: string; line: number }>) {
  // 배치 실행 전 오래된 캐시 정리
  await clearCache();

  const results = [];
  for (const entry of entries) {
    const result = await trace({
      file: entry.file,
      line: entry.line,
      // 캐시는 기본적으로 활성화 — 동일 PR에 대한 후속 조회가 빠름
    });
    results.push({ ...entry, result });
  }

  return results;
}
```

## 내보내는 타입

TypeScript 사용자를 위해 모든 타입이 패키지 루트에서 re-export됩니다:

```typescript
import type {
  // 핵심 결과 타입
  TraceNode,
  TraceFullResult,
  GraphResult,
  GraphOptions,
  TraceOptions,
  HealthReport,
  FeatureFlags,

  // 노드 분류
  TraceNodeType,     // 'original_commit' | 'cosmetic_commit' | ...
  TrackingMethod,    // 'blame-CMw' | 'ast-signature' | ...
  Confidence,        // 'exact' | 'structural' | 'heuristic'
  OperatingLevel,    // 0 | 1 | 2

  // 플랫폼 타입
  PlatformType,      // 'github' | 'github-enterprise' | ...
  PlatformAdapter,
  AuthStatus,
  PRInfo,
  IssueInfo,
  RateLimitInfo,

  // 그래프 순회
  GraphTraversalOptions,
} from '@lumy-pack/line-lore';
```

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
| `npx @lumy-pack/line-lore graph pr <num>` | PR에 연결된 issue 조회 |
| `npx @lumy-pack/line-lore graph issue <num>` | issue에 연결된 PR 조회 |
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
    console.error(error.code);     // 예: 'FILE_NOT_FOUND'
    console.error(error.message);
    console.error(error.context);  // 추가 메타데이터
  }
}
```

주요 에러 코드:

| 코드 | 의미 |
|------|------|
| `NOT_GIT_REPO` | git 저장소가 아님 |
| `FILE_NOT_FOUND` | 파일이 존재하지 않음 |
| `INVALID_LINE` | 라인 번호가 범위를 벗어남 |
| `GIT_BLAME_FAILED` | git blame 실행 실패 |
| `PR_NOT_FOUND` | 커밋에 해당하는 PR을 찾을 수 없음 |
| `CLI_NOT_AUTHENTICATED` | 플랫폼 CLI 인증되지 않음 |
| `API_RATE_LIMITED` | 플랫폼 API 속도 제한 도달 |
| `API_REQUEST_FAILED` | 플랫폼 API 요청 실패 |
| `GIT_COMMAND_FAILED` | Git 명령 실행 실패 |
| `GIT_TIMEOUT` | Git 명령 시간 초과 |

## 요구사항

- Node.js >= 20
- Git >= 2.27
- 선택사항: `gh` CLI >= 2.0 (GitHub API용)
- 선택사항: `glab` CLI >= 1.30 (GitLab API용)

## 라이선스

MIT
