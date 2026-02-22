# core Specification

## Requirements

- 프랙탈 트리를 파일시스템에서 스캔하여 구축할 수 있어야 한다
- 노드를 fractal/organ/pure-function으로 구조 기반 분류해야 한다
- 7개 내장 규칙(naming, structure, dependency, documentation, index, module)을 평가할 수 있어야 한다
- 현재 구조와 기대 구조 사이의 드리프트를 감지하고 SyncPlan을 생성해야 한다
- CLAUDE.md/SPEC.md의 100줄 제한과 3-tier 경계 섹션을 검증해야 한다
- 두 모듈의 Lowest Common Ancestor(LCA)를 계산해야 한다
- 프로젝트 건강도 점수와 리포트를 생성해야 한다

## API Contracts

- `buildFractalTree(entries: NodeEntry[]): FractalTree` — 노드 배열로 트리 구축; 빈 배열이면 빈 트리 반환
- `scanProject(rootPath: string, options?: ScanOptions): Promise<FractalTree>` — 디렉토리 스캔 + 트리 구축
- `classifyNode(input: ClassifyInput): CategoryType` — 구조 기반 분류; 우선순위: hasClaudeMd > hasSpecMd > isLeafDirectory > hasSideEffects > default
- `detectDrift(current: FractalTree, expected: FractalTree): DriftResult` — 이격 항목 목록 반환
- `evaluateRules(tree: FractalTree, rules: Rule[]): RuleViolation[]` — 규칙 위반 목록 반환
- `validateClaudeMd(content: string): ValidationResult` — 100줄 초과 또는 3-tier 누락 시 오류
- `findLCA(tree: FractalTree, pathA: string, pathB: string): FractalNode | null` — LCA 없으면 null
- `buildDAG(tree: FractalTree): DAG` — 의존성 DAG; 사이클 존재 시 `detectCycles`로 확인

## Last Updated

2026-02-23
