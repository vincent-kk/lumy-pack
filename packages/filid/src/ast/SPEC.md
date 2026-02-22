# ast Specification

## Requirements

- TypeScript 소스 코드를 Compiler API로 파싱하여 AST를 얻을 수 있어야 한다
- import/export 구문에서 모듈 의존성을 추출해야 한다
- 클래스의 LCOM4(응집도 결여 측정값)를 계산해야 한다
- 함수/메서드의 순환 복잡도(CC)를 계산해야 한다
- 두 소스 파일 간의 의미론적 AST diff를 계산해야 한다

## API Contracts

- `parseSource(source: string, filePath?: string): SourceFile` — TS Compiler API로 파싱; 구문 오류가 있어도 best-effort 파싱
- `parseFile(filePath: string): Promise<SourceFile>` — 파일 읽기 + 파싱
- `extractDependencies(sourceFile: SourceFile): Dependency[]` — import 경로 목록 반환; dynamic import 포함
- `calculateLCOM4(sourceFile: SourceFile, className: string): number` — 0~N 정수; 클래스 없으면 0 반환
- `extractClassInfo(sourceFile: SourceFile): ClassInfo[]` — 메서드·필드 목록 포함
- `calculateCC(sourceFile: SourceFile): number` — 파일 전체 CC; 분기(if/for/while/catch/&&/||) 수 + 1
- `computeTreeDiff(oldSource: string, newSource: string): TreeDiff` — 추가/삭제/변경 노드 목록

## Last Updated

2026-02-23
