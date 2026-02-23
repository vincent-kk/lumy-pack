# ast Specification

## Requirements

- `@ast-grep/napi` (tree-sitter 백엔드)로 소스 코드를 파싱하여 AST를 얻을 수 있어야 한다
- import/export 구문에서 모듈 의존성을 추출해야 한다
- 클래스의 LCOM4(응집도 결여 측정값)를 계산해야 한다
- 함수/메서드의 순환 복잡도(CC)를 계산해야 한다
- 두 소스 파일 간의 의미론적 AST diff를 계산해야 한다
- `@ast-grep/napi` 지연 로딩 + graceful degradation 지원

## API Contracts

- `parseSource(source: string, language?: string): SgRoot` — ast-grep로 파싱; 언어 자동 감지
- `parseFile(filePath: string): Promise<SgRoot>` — 파일 읽기 + 파싱
- `extractDependencies(root: SgRoot): DependencyInfo[]` — import 경로 목록 반환; dynamic import 포함
- `calculateLCOM4(root: SgRoot): LCOM4Result` — 클래스별 응집도; 클래스 없으면 components=0
- `extractClassInfo(root: SgRoot): ClassInfo[]` — 메서드·필드 목록 포함
- `calculateCC(root: SgRoot): CyclomaticComplexityResult` — 함수별 CC; 분기 수 + 1
- `computeTreeDiff(oldSource: string, newSource: string, language?: string): TreeDiffResult` — 추가/삭제/변경 노드 목록
- `getSgModule(): Promise<SgModule | null>` — ast-grep 지연 로딩 (null = 미설치)
- `toLangEnum(sg: SgModule, language: string): Lang` — 언어 문자열 → ast-grep Lang enum
- `getFilesForLanguage(dirPath: string, language: string, maxFiles?: number): string[]` — 파일 탐색
- `formatMatch(filePath, matchText, startLine, endLine, context, fileContent): string` — 매치 포맷팅

## Last Updated

2026-02-24
