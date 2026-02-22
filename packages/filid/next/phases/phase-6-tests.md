# Phase 6 — 테스트 확장

## 1. 테스트 전략 개요

기존 filid 테스트 스위트에 프랙탈 구조 관리 기능 테스트를 추가한다.
새 테스트 스위트를 별도 생성하지 않고, 기존 `packages/filid/src/__tests__/` 하위에 추가한다.

### 1.1 테스트 프레임워크

기존 filid의 **Vitest 3.2** 설정을 그대로 사용한다. `vitest.config.ts`는 변경 없음 또는 최소 수정.

```typescript
// vitest.config.ts (기존 filid 설정 유지)
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/__tests__/**', 'src/**/index.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
    testTimeout: 10000,
  },
});
```

테스트 파일 위치 (기존 filid `src/__tests__/` 하위에 추가):
- 단위 테스트: `src/__tests__/unit/`
- 통합 테스트: `src/__tests__/integration/`
- E2E 테스트: `src/__tests__/e2e/`
- 픽스처: `src/__tests__/fixtures/`
- 헬퍼: `src/__tests__/helpers/`

### 1.2 테스트 피라미드

```
        /\
       /E2E\          ~10%  — 5–10개
      /------\
     /통합 테스트\     ~25%  — 30–40개
    /------------\
   /  단위 테스트  \   ~65%  — 80–120개
  /----------------\
```

| 레이어 | 비율 | 대상 | 특징 |
|--------|------|------|------|
| 단위 | 65% | Core 모듈 10개 각각 | 빠름, 격리, Mock 사용 |
| 통합 | 25% | MCP 서버 + Hook 파이프라인 | 실제 I/O 일부 허용 |
| E2E | 10% | CLI 명령 전체 흐름 | 실제 파일 시스템 사용 |

### 1.3 커버리지 목표

기존 filid 커버리지 기준을 유지하며, 신규 모듈은 80%+ 목표를 추가한다.

| 레이어 | 라인 커버리지 | 브랜치 커버리지 | 비고 |
|--------|-------------|----------------|------|
| Core 모듈 (`src/core/`) | 90%+ | 85%+ | 비즈니스 로직 핵심 |
| MCP 서버 (`src/mcp/`) | 80%+ | 75%+ | 도구 핸들러 포함 |
| Hook 핸들러 (`src/hooks/`) | 80%+ | 75%+ | 컨텍스트 주입/가드 |
| 유틸리티 (`src/utils/`) | 85%+ | 80%+ | 순수 함수 우선 |
| 신규 프랙탈 모듈 | 80%+ | 75%+ | Phase 6 추가분 |
| 전체 | 80%+ | 75%+ | Vitest v8 provider |

### 1.4 회귀 테스트

기존 filid 테스트가 모두 통과해야 신규 테스트가 유효하다. 신규 테스트 추가 전후로
기존 테스트 스위트 전체 통과를 확인한다.

```bash
# 기존 filid 테스트 전체 통과 확인 (신규 추가 전)
yarn workspace @lumy-pack/filid test

# 신규 테스트 추가 후 전체 재확인
yarn workspace @lumy-pack/filid test
```

---

## 2. 테스트 헬퍼/픽스처 설계

### 2.1 Mock 디렉토리 구조

기존 filid 테스트 픽스처와 공존한다. 신규 픽스처는 기존 픽스처와 충돌하지 않도록
별도 서브디렉토리 또는 명확한 이름으로 추가한다.

```
src/__tests__/fixtures/
├── (기존 filid 픽스처 유지)
│
├── simple-project/          # 단순 프로젝트 (3개 fractal 모듈, 위반 없음)
│   ├── src/
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   │   ├── index.ts
│   │   │   │   └── main.ts
│   │   │   └── user/
│   │   │       ├── index.ts
│   │   │       └── main.ts
│   │   └── utils/           # organ 디렉토리
│   │       └── format.ts
│   └── package.json
├── complex-project/         # 복잡 프로젝트 (10+ 모듈, 중첩 구조, 위반 없음)
│   ├── src/
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   │   ├── components/  # organ
│   │   │   │   ├── hooks/       # organ
│   │   │   │   ├── types/       # organ
│   │   │   │   ├── index.ts
│   │   │   │   └── main.ts
│   │   │   ├── user/
│   │   │   ├── payment/
│   │   │   └── dashboard/
│   │   ├── shared/
│   │   │   ├── config/
│   │   │   └── constants/   # organ
│   │   └── utils/           # organ
│   └── package.json
├── invalid-project/         # 규칙 위반 프로젝트 (의도적 위반 포함)
│   ├── src/
│   │   ├── components/      # organ — fractal 자식 포함 (위반: HOL-S001)
│   │   │   └── auth/        # fractal이 organ 아래 배치됨
│   │   │       └── index.ts
│   │   ├── features/
│   │   │   └── user/        # index.ts 누락 (위반: HOL-I001)
│   │   └── utils/
│   │       └── UserHelper.ts  # PascalCase (위반: HOL-N001)
│   └── package.json
└── drift-project/           # 이격 상태 프로젝트 (drift-detect 테스트용)
    ├── src/
    │   ├── shared/
    │   │   └── state/       # organ으로 분류되었으나 상태 보유 (critical drift)
    │   ├── features/
    │   │   └── auth/        # main.ts 누락 (high drift)
    │   └── utils/
    │       └── DateHelper.ts  # PascalCase (medium drift)
    └── package.json
```

픽스처 생성 헬퍼:

```typescript
// src/__tests__/helpers/fixture-loader.ts
import { join } from 'path';

export const FIXTURES_DIR = join(__dirname, '../fixtures');

export function getFixturePath(name: 'simple-project' | 'complex-project' | 'invalid-project' | 'drift-project'): string {
  return join(FIXTURES_DIR, name);
}
```

### 2.2 공통 헬퍼 함수

임시 디렉토리 접두사는 `filid-test-`를 사용한다 (기존 filid 패키지와 일관성 유지).

```typescript
// src/__tests__/helpers/mock-factories.ts

import type { FractalNode, ScanOptions, DriftItem, ValidationResult } from '../../types';

/**
 * Mock FractalNode 생성
 */
export function createMockNode(overrides: Partial<FractalNode> = {}): FractalNode {
  return {
    path: 'src/features/auth',
    name: 'auth',
    category: 'fractal',
    hasIndex: true,
    hasMain: true,
    children: [],
    depth: 2,
    ...overrides,
  };
}

/**
 * Mock 디렉토리 트리 생성 (노드 배열)
 */
export function createMockTree(nodes: Partial<FractalNode>[]): FractalNode[] {
  return nodes.map((n, i) =>
    createMockNode({ path: `src/module-${i}`, name: `module-${i}`, ...n })
  );
}

/**
 * Mock ScanOptions 생성 (제로 설정 아키텍처 기반)
 */
export function createMockConfig(overrides: Partial<ScanOptions> = {}): ScanOptions {
  return {
    projectRoot: '/mock/project',
    maxDepth: 10,
    excludePatterns: ['node_modules', '.git'],
    ...overrides,
  };
}

/**
 * Mock DriftItem 생성
 */
export function createMockDrift(overrides: Partial<DriftItem> = {}): DriftItem {
  return {
    id: 'D001',
    path: 'src/shared/state',
    driftType: 'category-mismatch',
    severity: 'critical',
    expected: 'fractal',
    actual: 'organ',
    suggestedAction: 'reclassify',
    ...overrides,
  };
}

/**
 * Mock ValidationResult 생성 (성공)
 */
export function createMockValidationResult(passed = true): ValidationResult {
  return {
    passed,
    checks: [
      { name: 'imports-resolved', passed, message: passed ? 'All imports resolved' : 'Broken import found' },
      { name: 'index-files-present', passed: true, message: 'All fractal nodes have index.ts' },
      { name: 'organ-rules', passed: true, message: 'No organ violations' },
    ],
    violations: passed ? [] : [
      { severity: 'error', path: 'src/broken', rule: 'HOL-S001', message: 'Broken import' },
    ],
  };
}

/**
 * 임시 디렉토리 기반 프로젝트 생성 (파일 시스템 테스트용)
 */
export async function createTempProject(structure: Record<string, string>): Promise<string> {
  const { mkdtemp, mkdir, writeFile } = await import('fs/promises');
  const { join, dirname } = await import('path');
  const { tmpdir } = await import('os');

  const root = await mkdtemp(join(tmpdir(), 'filid-test-'));
  for (const [relPath, content] of Object.entries(structure)) {
    const fullPath = join(root, relPath);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content, 'utf-8');
  }
  return root;
}
```

---

## 3. Core 모듈 단위 테스트

기존 filid `src/__tests__/unit/core/` 하위에 다음 테스트 파일을 추가한다.

### 3.1 (제거됨 — config-loader.test.ts)

제로 설정 아키텍처 전환으로 config-loader 모듈이 제거되었다.
해당 테스트도 제거한다.

---

### 3.2 category-classifier.test.ts

**대상**: `src/core/category-classifier.ts`

| # | 테스트 케이스 | 검증 내용 |
|---|--------------|----------|
| 1 | CLAUDE.md 있는 디렉토리 → `fractal` 분류 | CLAUDE.md가 있는 디렉토리는 `fractal`로 분류된다 |
| 2 | SPEC.md 있는 디렉토리 → `fractal` 분류 | SPEC.md가 있는 디렉토리는 `fractal`로 분류된다 |
| 3 | 리프 디렉토리 → `organ` 분류 | 프랙탈 자식이 없는 리프 디렉토리는 `organ`으로 분류된다 |
| 4 | 기본 fractal 분류 | CLAUDE.md/SPEC.md 없고 리프가 아닌 디렉토리는 `fractal`로 분류된다 |
| 5 | 순수 함수 파일만 포함 → `pure-function` | 부작용 없는 파일만 포함된 디렉토리는 `pure-function`으로 분류된다 |
| 6 | fractal + organ 혼재 → `hybrid` | fractal 자식과 organ 파일이 공존하면 `hybrid`로 분류된다 |
| 7 | 중첩 리프 디렉토리 정확 분류 | `features/auth/components`는 `organ`, `features/auth`는 `fractal` |
| 8 | 빈 디렉토리 분류 | 자식이 없는 디렉토리는 `organ`으로 분류된다 |

```typescript
// src/__tests__/unit/core/category-classifier.test.ts
import { describe, it, expect } from 'vitest';
import { classifyCategory } from '../../../core/category-classifier';
import { createMockNode } from '../../helpers/mock-factories';

describe('category-classifier', () => {
  it('CLAUDE.md가 있는 디렉토리는 fractal로 분류', () => {
    const result = classifyCategory({ name: 'auth', children: [], hasClaudeMd: true });
    expect(result).toBe('fractal');
  });

  it('SPEC.md가 있는 디렉토리는 fractal로 분류', () => {
    const result = classifyCategory({ name: 'auth', children: [], hasSpecMd: true });
    expect(result).toBe('fractal');
  });

  it('프랙탈 자식이 없는 리프 디렉토리는 organ으로 분류', () => {
    const result = classifyCategory({ name: 'components', children: [] });
    expect(result).toBe('organ');
  });

  it('패턴 미해당 비리프 디렉토리는 fractal로 분류', () => {
    const child = createMockNode({ category: 'fractal' });
    const result = classifyCategory({ name: 'features', children: [child] });
    expect(result).toBe('fractal');
  });

  it('순수 함수 파일만 있으면 pure-function 분류', () => {
    const result = classifyCategory({
      name: 'math',
      children: [],
      isPureFunction: true,
    });
    expect(result).toBe('pure-function');
  });

  it('fractal 자식 + organ 파일 혼재 시 hybrid', () => {
    const fractalChild = createMockNode({ category: 'fractal' });
    const result = classifyCategory({
      name: 'mixed',
      children: [fractalChild],
      hasOrganFiles: true,
    });
    expect(result).toBe('hybrid');
  });
});
```

---

### 3.3 rule-engine.test.ts

**대상**: `src/core/rule-engine.ts`

| # | 테스트 케이스 | 검증 내용 |
|---|--------------|----------|
| 1 | 규칙 목록 로드 | 빌트인 규칙 전체가 로드되며 각 규칙에 `id`, `name`, `category`, `severity`가 있다 |
| 2 | naming 규칙 위반 감지 | PascalCase 디렉토리명이 `HOL-N001` 위반으로 감지된다 |
| 3 | structure 규칙 — organ에 fractal 자식 금지 | organ 디렉토리 아래 fractal 노드가 있으면 `HOL-S001` 오류가 반환된다 |
| 4 | index 규칙 — fractal 노드 index.ts 필수 | index.ts 없는 fractal 노드에서 `HOL-I001` 경고가 반환된다 |
| 5 | module 규칙 — main.ts 진입점 | main.ts 없는 fractal 노드에서 `HOL-M001` 경고가 반환된다 |
| 6 | 규칙 비활성화 (`rules.enabled: false`) | 규칙 비활성화 시 위반이 0건 반환된다 |
| 7 | severityOverrides 적용 | 설정으로 `HOL-N001`을 `info`로 재정의하면 해당 위반이 `info` 심각도로 반환된다 |
| 8 | 규칙 필터 — severity 이상만 반환 | `filterSeverity: 'error'` 옵션 시 warning, info 항목이 제외된다 |
| 9 | 정상 구조에서 위반 없음 | `simple-project` 픽스처에서 위반 0건이 반환된다 |
| 10 | 복수 위반 동시 감지 | `invalid-project` 픽스처에서 3종 이상의 위반이 감지된다 |

---

### 3.4 fractal-scanner.test.ts

**대상**: `src/core/fractal-scanner.ts`

| # | 테스트 케이스 | 검증 내용 |
|---|--------------|----------|
| 1 | 단순 프로젝트 트리 스캔 | `simple-project` 픽스처에서 올바른 노드 수와 경로가 반환된다 |
| 2 | 복잡 프로젝트 중첩 스캔 | `complex-project` 픽스처에서 깊이 3 이상의 노드가 올바르게 포함된다 |
| 3 | hasIndex 필드 정확성 | index.ts가 있는 노드는 `hasIndex: true`, 없는 노드는 `false` |
| 4 | hasMain 필드 정확성 | main.ts가 있는 노드는 `hasMain: true`, 없는 노드는 `false` |
| 5 | organ 디렉토리 올바른 분류 | `utils`, `components` 등이 `category: 'organ'`으로 반환된다 |
| 6 | 존재하지 않는 경로 에러 | 없는 경로에서 `ScanError`를 throw한다 |
| 7 | 빈 디렉토리 처리 | 비어있는 디렉토리도 노드로 포함되며 `children: []` |
| 8 | excludePatterns 옵션 | `node_modules`, `.git` 등이 결과에서 제외된다 |
| 9 | summary 카운트 정확성 | 반환된 `summary.fractalCount`가 실제 fractal 노드 수와 일치한다 |
| 10 | maxDepth 옵션 | `maxDepth: 2` 설정 시 depth 3 이상의 노드는 반환되지 않는다 |

---

### 3.5 index-analyzer.test.ts

**대상**: `src/core/index-analyzer.ts`

| # | 테스트 케이스 | 검증 내용 |
|---|--------------|----------|
| 1 | index.ts 존재 여부 확인 | 파일이 있으면 `true`, 없으면 `false` 반환 |
| 2 | 모든 공개 심볼이 re-export되었는지 확인 | 누락된 export가 있으면 해당 심볼 목록을 반환한다 |
| 3 | re-export 완전한 index.ts 검증 통과 | 모든 심볼이 export된 경우 위반 없음 |
| 4 | 부분 export index.ts 위반 감지 | 일부 심볼 누락 시 `HOL-I002` 위반으로 감지된다 |
| 5 | 빈 index.ts 처리 | 내용이 없는 index.ts는 불완전 export로 처리된다 |
| 6 | barrel export 생성 제안 | 누락된 심볼 목록으로 정확한 export 구문이 생성된다 |
| 7 | re-export 경로 상대 경로 정확성 | 생성된 export 구문의 import 경로가 올바른 상대 경로를 사용한다 |

---

### 3.6 module-main-analyzer.test.ts

**대상**: `src/core/module-main-analyzer.ts`

| # | 테스트 케이스 | 검증 내용 |
|---|--------------|----------|
| 1 | main.ts 존재 여부 확인 | 파일이 있으면 `true`, 없으면 `false` 반환 |
| 2 | main.ts export 유효성 검사 | 아무것도 export하지 않으면 `HOL-M002` 경고 |
| 3 | 주 export 식별 | default export 또는 primary named export가 올바르게 식별된다 |
| 4 | main.ts 스텁 생성 | 모듈 이름과 설명이 포함된 올바른 스텁이 생성된다 |
| 5 | fractal 노드 main.ts 필수 규칙 | main.ts 없는 fractal 노드가 `HOL-M001` 경고로 감지된다 |
| 6 | organ 노드 main.ts 불필요 | organ 노드에 main.ts가 없어도 위반이 아니다 |

---

### 3.7 fractal-validator.test.ts

**대상**: `src/core/fractal-validator.ts`

| # | 테스트 케이스 | 검증 내용 |
|---|--------------|----------|
| 1 | 유효한 트리 전체 검증 통과 | `simple-project` 픽스처에서 `passed: true` 반환 |
| 2 | organ-under-fractal 규칙 검증 | fractal 아래 organ이 있는 경우를 위반으로 감지 (반대는 허용) |
| 3 | fractal-under-organ 금지 | organ 아래 fractal 자식이 있으면 `HOL-S001` 오류 |
| 4 | 순환 의존성 없음 검증 | 순환 참조가 없는 트리에서 검증 통과 |
| 5 | 모든 import 해석 가능 검증 | 깨진 import가 있는 프로젝트에서 검증 실패 |
| 6 | ValidationCheck 목록 반환 | 각 검사 항목이 `name`, `passed`, `message` 포함하여 반환된다 |
| 7 | 복수 위반 동시 감지 | `invalid-project` 픽스처에서 복수의 `violations` 반환 |
| 8 | violations 심각도별 정렬 | 반환된 violations가 `error` > `warning` > `info` 순으로 정렬된다 |

---

### 3.8 lca-calculator.test.ts

**대상**: `src/core/lca-calculator.ts`

| # | 테스트 케이스 | 검증 내용 |
|---|--------------|----------|
| 1 | 공통 조상 계산 — 같은 부모 | `src/features/auth`와 `src/features/user`의 LCA는 `src/features` |
| 2 | 공통 조상 계산 — 루트 | `src/features/auth`와 `src/utils/format`의 LCA는 `src` |
| 3 | 동일 경로 LCA | 같은 경로 두 개의 LCA는 해당 경로 자신 |
| 4 | 단일 경로 LCA | 경로 하나만 전달 시 해당 경로가 LCA |
| 5 | recommendedParent 결정 | 미배치 노드의 LCA 기반 권장 부모 경로가 반환된다 |
| 6 | confidence 점수 | context 경로가 많을수록 confidence 값이 높아진다 |
| 7 | 빈 contextPaths 처리 | contextPaths 없을 때 confidence 0으로 반환, 예외 없음 |
| 8 | 깊은 중첩 트리 LCA | depth 5 이상의 트리에서 LCA가 정확히 계산된다 |

---

### 3.9 drift-detector.test.ts

**대상**: `src/core/drift-detector.ts`

| # | 테스트 케이스 | 검증 내용 |
|---|--------------|----------|
| 1 | 이격 없는 프로젝트 — 빈 목록 반환 | `simple-project` 픽스처에서 `drifts: []` 반환 |
| 2 | category-mismatch 감지 | organ으로 분류되었으나 상태 보유 노드가 `category-mismatch` 타입으로 감지된다 |
| 3 | missing-index 감지 | index.ts 없는 fractal 노드가 `missing-index` 타입으로 감지된다 |
| 4 | missing-main 감지 | main.ts 없는 fractal 노드가 `missing-main` 타입으로 감지된다 |
| 5 | naming-violation 감지 | PascalCase 디렉토리가 `naming-violation` 타입으로 감지된다 |
| 6 | orphaned-node 감지 | 어떤 모듈에서도 참조되지 않는 노드가 `orphaned-node`로 감지된다 |
| 7 | 심각도 분류 정확성 | `drift-project` 픽스처에서 critical/high/medium/low가 올바르게 분류된다 |
| 8 | severityFilter 옵션 | `severityFilter: 'high'` 시 medium/low 항목이 제외된다 |
| 9 | suggestedAction 매핑 | 각 driftType에 대해 올바른 SyncAction이 제안된다 |
| 10 | total 카운트 정확성 | `drifts.length`와 `total` 값이 일치한다 |

---

### 3.10 project-analyzer.test.ts

**대상**: `src/core/project-analyzer.ts`

| # | 테스트 케이스 | 검증 내용 |
|---|--------------|----------|
| 1 | 전체 프로젝트 분석 파이프라인 | 스캔 → 분류 → 규칙 검사 → 건강도 점수 순으로 실행된다 |
| 2 | 건강도 점수 계산 — 완벽한 구조 | 위반 없는 프로젝트에서 `healthScore: 100` |
| 3 | 건강도 점수 감소 — error 가중치 | error 1건당 20점 감소한다 |
| 4 | 건강도 점수 감소 — warning 가중치 | warning 1건당 5점 감소한다 |
| 5 | 건강도 점수 최솟값 0 | 위반이 많아도 점수가 음수가 되지 않는다 |
| 6 | AnalysisResult 전체 구조 반환 | `nodes`, `violations`, `drifts`, `healthScore`, `summary` 모두 포함된다 |
| 7 | 복잡 프로젝트 분석 성능 | `complex-project` 픽스처가 2초 이내에 분석 완료된다 |
| 8 | 분석 옵션 전달 | `excludePatterns`, `maxDepth` 옵션이 스캔에 올바르게 전달된다 |

---

## 4. MCP 도구 통합 테스트

### 4.1 server.test.ts

**대상**: `src/mcp/server.ts` + 각 도구 핸들러

기존 filid MCP 서버에 프랙탈 도구가 추가된 형태를 테스트한다.

```typescript
// src/__tests__/integration/mcp/server.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createFilidMcpServer } from '../../../mcp/server';
import { getFixturePath } from '../../helpers/fixture-loader';

describe('filid MCP Server — 프랙탈 도구', () => {
  let server: Awaited<ReturnType<typeof createFilidMcpServer>>;

  beforeAll(async () => {
    server = await createFilidMcpServer({ projectRoot: getFixturePath('simple-project') });
  });

  afterAll(async () => {
    await server.close();
  });

  // ...
});
```

| # | 테스트 케이스 | 검증 내용 |
|---|--------------|----------|
| 1 | 서버 생성 및 연결 | `createFilidMcpServer()`가 예외 없이 서버 인스턴스를 반환한다 |
| 2 | 도구 목록 조회 — 5개 등록 확인 | `server.listTools()` 응답에 `fractal-scan`, `drift-detect`, `lca-resolve`, `rule-query`, `structure-validate` 5개가 포함된다 |
| 3 | fractal-scan 호출 — 성공 | `simple-project` 경로로 호출 시 `nodes` 배열과 `summary`가 포함된 응답을 반환한다 |
| 4 | fractal-scan 호출 — 잘못된 경로 | 존재하지 않는 경로로 호출 시 MCP error response를 반환한다 (예외 throw 아님) |
| 5 | drift-detect 호출 — 이격 없음 | `simple-project`에서 `total: 0`을 반환한다 |
| 6 | drift-detect 호출 — 이격 감지 | `drift-project`에서 `total > 0`을 반환하며 각 항목에 `severity`가 있다 |
| 7 | lca-resolve 호출 — 정확한 LCA | 두 경로의 LCA가 올바르게 반환된다 |
| 8 | rule-query 호출 — action: "list" | 규칙 배열이 반환되며 각 항목에 `id`, `name`, `category`, `severity`가 있다 |
| 9 | rule-query 호출 — action: "get" | 특정 규칙 ID로 조회 시 해당 규칙 단일 객체가 반환된다 |
| 10 | structure-validate 호출 — 유효 구조 | `simple-project`에서 `passed: true` 반환 |
| 11 | structure-validate 호출 — 위반 구조 | `invalid-project`에서 `passed: false`와 위반 목록이 반환된다 |
| 12 | 알 수 없는 도구 이름 호출 | `unknown-tool`을 호출하면 MCP unknown tool error response를 반환한다 |
| 13 | 필수 파라미터 누락 | `fractal-scan`에 `path` 없이 호출 시 validation error response를 반환한다 |
| 14 | 동시 다중 도구 호출 | 두 도구를 동시에 호출해도 응답이 각각 올바르게 반환된다 |

---

## 5. Hook 통합 테스트

### 5.1 context-injector.test.ts

**대상**: `src/hooks/context-injector.ts`

PreToolUse hook — 컨텍스트를 `<system-reminder>` 태그로 주입한다.

| # | 테스트 케이스 | 검증 내용 |
|---|--------------|----------|
| 1 | 항상 `continue: true` 반환 | hook 응답의 `continue`가 항상 `true`이다 (컨텍스트 주입 실패 시에도) |
| 2 | 프랙탈 노드 컨텍스트 주입 | `tool_input.path`가 fractal 노드이면 해당 노드의 카테고리와 규칙이 주입된다 |
| 3 | organ 노드 컨텍스트 주입 | organ 노드이면 "organ directory — no fractal children" 주의사항이 포함된다 |
| 4 | 컨텍스트 없는 경로 | 분류 불가 경로이면 빈 컨텍스트로 `continue: true` 반환 |
| 5 | system-reminder 형식 | 주입된 컨텍스트가 `<system-reminder>` 태그로 감싸져 있다 |
| 6 | 활성 규칙 포함 여부 | 주입된 컨텍스트에 해당 노드에 적용되는 규칙 목록이 포함된다 |
| 7 | 현재 이격 상태 포함 | 대상 경로에 drift가 있으면 현재 drift 카운트가 컨텍스트에 포함된다 |

```typescript
// src/__tests__/integration/hooks/context-injector.test.ts
import { describe, it, expect } from 'vitest';
import { handleContextInjector } from '../../../hooks/context-injector';
import { createMockConfig } from '../../helpers/mock-factories';
import { getFixturePath } from '../../helpers/fixture-loader';

describe('context-injector hook', () => {
  it('항상 continue: true를 반환한다', async () => {
    const result = await handleContextInjector({
      tool_name: 'Write',
      tool_input: { path: 'src/nonexistent/path' },
      config: createMockConfig({ projectRoot: getFixturePath('simple-project') }),
    });
    expect(result.continue).toBe(true);
  });

  it('system-reminder 형식으로 컨텍스트를 반환한다', async () => {
    const result = await handleContextInjector({
      tool_name: 'Read',
      tool_input: { path: 'src/features/auth' },
      config: createMockConfig({ projectRoot: getFixturePath('simple-project') }),
    });
    expect(result.context).toMatch(/^<system-reminder>/);
    expect(result.context).toMatch(/<\/system-reminder>$/);
  });
});
```

---

### 5.2 structure-guard.test.ts

**대상**: `src/hooks/structure-guard.ts`

PreToolUse hook — 구조 위반 가능성이 있는 쓰기 작업을 경고한다.

| # | 테스트 케이스 | 검증 내용 |
|---|--------------|----------|
| 1 | 항상 `continue: true` 반환 | 경고가 있어도 `continue: true` — 차단이 아닌 경고 전용 |
| 2 | organ 디렉토리에 fractal 자식 생성 시도 경고 | `Write` 도구로 `components/auth/index.ts` 생성 시 경고 메시지가 포함된다 |
| 3 | fractal 노드 정상 쓰기 — 경고 없음 | fractal 노드 내 일반 파일 쓰기는 경고 없이 통과한다 |
| 4 | organ 노드 organ 파일 — 경고 없음 | organ 디렉토리 내 일반 파일(비fractal) 추가는 경고 없음 |
| 5 | 경고 메시지 형식 | 경고에 위반 규칙 ID (HOL-S001)와 권장 대안 경로가 포함된다 |
| 6 | Read 도구는 경고 없음 | 읽기 전용 작업에서는 structure-guard가 비활성화된다 |
| 7 | 설정으로 guard 비활성화 | `hooks.structureGuard: false`이면 모든 경고가 억제된다 |

---

### 5.3 change-tracker.test.ts

**대상**: `src/hooks/change-tracker.ts`

PostToolUse hook — 파일 시스템 변경을 추적하고 태그를 생성한다.

| # | 테스트 케이스 | 검증 내용 |
|---|--------------|----------|
| 1 | Write 도구 후 변경 태그 생성 | `Write` 도구 응답 후 `{ type: 'add', path, timestamp }` 태그가 생성된다 |
| 2 | Edit 도구 후 변경 태그 생성 | `Edit` 도구 응답 후 `{ type: 'modify', path, timestamp }` 태그가 생성된다 |
| 3 | Bash(rm) 후 삭제 태그 생성 | `rm` 명령을 포함한 Bash 응답 후 `{ type: 'delete', path }` 태그가 생성된다 |
| 4 | Read 도구는 추적하지 않음 | `Read` 도구 후 태그가 생성되지 않는다 |
| 5 | 변경 타입 정확성 | `tool_name`에 따라 `add/modify/delete`가 정확히 분류된다 |
| 6 | timestamp ISO 형식 | 생성된 태그의 `timestamp`가 유효한 ISO 8601 문자열이다 |
| 7 | 다중 파일 Bash 변경 추적 | 단일 Bash 명령으로 복수 파일이 변경된 경우 각각 별도 태그가 생성된다 |
| 8 | 태그 누적 저장 | 여러 도구 호출 후 모든 태그가 누적 저장되어 있다 |
| 9 | `continue: true` 반환 | PostToolUse hook이므로 항상 `continue: true` |

---

## 6. 테스트 실행 가이드

### 6.1 테스트 명령어

```bash
# 전체 테스트 실행 (기존 filid 테스트 + 신규 추가분 포함)
yarn workspace @lumy-pack/filid test

# 단위 테스트만 실행
yarn workspace @lumy-pack/filid test src/__tests__/unit

# 통합 테스트만 실행
yarn workspace @lumy-pack/filid test src/__tests__/integration

# 특정 모듈 테스트
yarn workspace @lumy-pack/filid test category-classifier
yarn workspace @lumy-pack/filid test drift-detector

# 감시 모드 (개발 중)
yarn workspace @lumy-pack/filid test --watch

# 커버리지 포함 실행
yarn workspace @lumy-pack/filid test --coverage
```

### 6.2 커버리지 보고서 생성

```bash
# HTML 커버리지 보고서 생성 (packages/filid/coverage/)
yarn workspace @lumy-pack/filid test --coverage --reporter=html

# 커버리지 임계값 강제 적용 (CI용)
yarn workspace @lumy-pack/filid test --coverage --coverage.thresholds.lines=80
```

### 6.3 CI 통합

```yaml
# .github/workflows/test.yml (참고용)
- name: Run filid tests
  run: yarn workspace @lumy-pack/filid test --coverage --reporter=json

- name: Check coverage thresholds
  run: yarn workspace @lumy-pack/filid test --coverage
  # vitest.config.ts의 thresholds 설정으로 미달 시 CI 실패
```

### 6.4 테스트 작성 규칙

1. **테스트 파일 위치**: `src/core/foo.ts` → `src/__tests__/unit/core/foo.test.ts`
2. **픽스처 사용**: 실제 파일 시스템 테스트는 항상 픽스처 디렉토리 또는 `createTempProject()`를 사용한다
3. **정리 (cleanup)**: `createTempProject()`로 생성한 임시 디렉토리는 `afterEach`에서 반드시 삭제한다
4. **Mock 독립성**: 각 테스트는 독립적인 Mock 인스턴스를 사용한다 (`beforeEach`에서 재생성)
5. **테스트 이름**: 한국어 서술형 — 조건과 결과를 명확히 표현 (예: "경로가 없으면 ScanError를 throw한다")
6. **에러 케이스 포함**: 정상 케이스뿐 아니라 경계값과 예외 케이스를 반드시 포함한다
7. **타임아웃**: 파일 시스템 I/O 테스트는 `{ timeout: 10000 }` 옵션을 명시적으로 설정한다
8. **기존 테스트 회귀**: 신규 테스트 추가 후 기존 filid 테스트가 모두 통과하는지 확인한다
