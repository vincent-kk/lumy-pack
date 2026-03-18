# @lumy-pack/ink-veil

다중 문서 형식 지원과 왕복 검증을 갖춘 한국어 개인정보(PII) 탐지 및 마스킹 도구.

## 주요 기능

- **3단계 탐지 파이프라인**: 수동 규칙 → 정규식 패턴 → NER(Kiwi NLP)로 포괄적 PII 탐지
- **15+ 문서 형식**: TXT, CSV, JSON, YAML, XML, HTML, TOML, INI, PDF, DOCX, XLSX, PPTX, EPUB 등
- **왕복 충실도**: 4단계 충실도 계층에 걸친 무결성 검증으로 마스킹 및 복원
- **토큰 모드**: Tag(`<iv-per>`), bracket(`{{PER_001}}`), plain(`PER_001`) 출력 형식
- **이중 배포**: CLI 도구로 사용하거나 라이브러리로 import
- **사전 관리**: SHA-256 서명된 항목으로 영속적 토큰-PII 매핑

## 설치

```bash
npm install @lumy-pack/ink-veil
# 또는
yarn add @lumy-pack/ink-veil
```

## 빠른 시작

### CLI 사용법

```bash
# 텍스트 파일의 PII 마스킹
npx @lumy-pack/ink-veil veil input.txt -o output.txt

# bracket 토큰 모드로 마스킹
npx @lumy-pack/ink-veil veil input.txt -o output.txt --mode bracket

# 마스킹된 파일 복원
npx @lumy-pack/ink-veil unveil veiled.txt -d dictionary.json -o restored.txt

# 마스킹 없이 PII 탐지만 수행
npx @lumy-pack/ink-veil detect input.txt

# 왕복 충실도 검증
npx @lumy-pack/ink-veil verify original.txt restored.txt

# 사전 관리
npx @lumy-pack/ink-veil dict show dictionary.json
npx @lumy-pack/ink-veil dict merge dict1.json dict2.json -o merged.json

# NER 모델 관리
npx @lumy-pack/ink-veil model download
npx @lumy-pack/ink-veil model status
```

### 프로그래밍 API

```typescript
import { InkVeil } from '@lumy-pack/ink-veil';

// InkVeil 인스턴스 생성
const iv = await InkVeil.create({ tokenMode: 'tag' });

// 텍스트 마스킹
const veiled = await iv.veilText('홍길동의 전화번호는 010-1234-5678입니다.');
console.log(veiled.text);       // 마스킹된 출력
console.log(veiled.dictionary); // 토큰-PII 매핑

// 텍스트 복원
const restored = iv.unveilText(veiled.text);
console.log(restored.text);          // 원본 텍스트 복원
console.log(restored.tokenIntegrity); // 1.0 = 완벽한 왕복

// 사전을 파일로 저장
await iv.saveDictionary('dictionary.json');

// NER 엔진 리소스 해제
await iv.dispose();
```

## 작동 원리

@lumy-pack/ink-veil은 3단계 탐지 파이프라인을 실행합니다:

1. **MANUAL**: 사용자 정의 리터럴 문자열 및 정규식 패턴을 최우선 순위로 적용
2. **REGEX**: 한국어 PII(전화번호, 이메일, 주민등록번호, 주소 등)를 위한 내장 정규식 패턴
3. **NER**: Kiwi NLP 기반 개체명 인식으로 이름, 조직, 지역 등 탐지

탐지된 범위는 병합, 중복 제거 후 사전을 통해 토큰에 매핑됩니다. 각 토큰은 무결성 검증을 위해 SHA-256으로 서명됩니다.

## 토큰 모드

| 모드 | 형식 | 예시 | 적합한 용도 |
|------|------|------|-------------|
| `tag` | XML 태그 | `<iv-per id="001">PER_001</iv-per>` | LLM 보존 (기본값) |
| `bracket` | 이중 중괄호 | `{{PER_001}}` | 템플릿 시스템 |
| `plain` | 일반 토큰 | `PER_001` | 최소 마크업 |

## 지원 형식

| 계층 | 보장 | 형식 |
|------|------|------|
| **1a** | 바이트 동일 | TXT, MD, CSV, TSV |
| **1b** | 의미적 동일 | JSON, XML, YAML, TOML, INI |
| **2** | 구조 보존 | DOCX, XLSX, HTML |
| **3** | 텍스트 레이어 추출 | PDF, PPTX, EPUB |
| **4** | 실험적 / 최선 노력 | HWP, LaTeX |

## API 참조

### `InkVeil.create(options?: InkVeilOptions): Promise<InkVeil>`

선택적 구성으로 InkVeil 인스턴스를 생성합니다.

**옵션:**
- `tokenMode?` (`'tag' | 'bracket' | 'plain'`): 토큰 출력 모드 (기본값: `'tag'`)
- `manualRules?` (`ManualRule[]`): 사용자 정의 탐지 규칙
- `noNer?` (boolean): NER 엔진 비활성화 (기본값: `false`)
- `dictionaryPath?` (string): 기존 사전 파일 경로에서 로드

### `veilText(text: string, sourceDocument?: string): Promise<VeilResult>`

3단계 파이프라인을 사용하여 텍스트의 PII를 탐지하고 마스킹합니다.

### `unveilText(text: string): UnveilResult`

사전을 사용하여 마스킹된 텍스트를 원본으로 복원합니다.

### `detect(text: string): Promise<DetectionSpan[]>`

마스킹 없이 PII 범위를 탐지합니다. 범위 위치, 카테고리, 탐지 방법을 반환합니다.

### `verify(original: Buffer, restored: Buffer, tier: FidelityTier, format?: string): VerificationResult`

원본과 복원된 문서 간의 왕복 충실도를 검증합니다.

### `saveDictionary(path: string): Promise<void>`

현재 사전을 JSON 파일로 저장합니다.

### `dispose(): Promise<void>`

NER 엔진 리소스를 해제합니다. 처리 완료 후 호출하세요.

## CLI 참조

| 명령어 | 용도 |
|--------|------|
| `ink-veil veil <files...>` | 파일의 PII 마스킹 |
| `--mode <tag\|bracket\|plain>` | 토큰 출력 모드 |
| `--no-ner` | NER 엔진 비활성화 |
| `--manual-rules <path>` | JSON에서 수동 규칙 로드 |
| `-o, --output <path>` | 출력 파일 경로 |
| `-d, --dictionary <path>` | 사전 파일 경로 |
| `ink-veil unveil <files...>` | 마스킹된 파일 복원 |
| `--strict` | 토큰 무결성 < 1.0이면 실패 |
| `ink-veil detect <files...>` | 마스킹 없이 PII 탐지 |
| `ink-veil verify <original> <restored>` | 왕복 충실도 검증 |
| `ink-veil dict show <path>` | 사전 내용 표시 |
| `ink-veil dict merge <files...>` | 여러 사전 병합 |
| `ink-veil model download` | NER 모델 다운로드 |
| `ink-veil model status` | NER 모델 상태 확인 |

## 에러 처리

에러는 특정 에러 코드와 함께 `InkVeilError`를 통해 타입 지정됩니다:

```typescript
import { InkVeil, InkVeilError, ErrorCode } from '@lumy-pack/ink-veil';

try {
  const iv = await InkVeil.create();
  await iv.veilText('...');
} catch (error) {
  if (error instanceof InkVeilError) {
    console.error(error.code);    // ErrorCode 열거형 값
    console.error(error.message);
    console.error(error.context); // 추가 메타데이터
  }
}
```

에러 코드:
- `GENERAL_ERROR` (1) — 미분류 에러
- `INVALID_ARGUMENTS` (2) — 잘못된 CLI 인자 또는 옵션
- `FILE_NOT_FOUND` (3) — 입력 파일이 존재하지 않음
- `UNSUPPORTED_FORMAT` (4) — 지원하지 않는 문서 형식
- `DICTIONARY_ERROR` (5) — 사전 로드/저장 실패
- `NER_MODEL_FAILED` (6) — NER 모델 초기화 또는 추론 에러
- `VERIFICATION_FAILED` (7) — 왕복 검증 실패
- `TOKEN_INTEGRITY_BELOW_THRESHOLD` (8) — 토큰 무결성이 설정된 임계값 미만

## 요구사항

- Node.js >= 20

## 라이선스

MIT
