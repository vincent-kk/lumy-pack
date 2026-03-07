# @lumy-pack/ink-veil — 개발 계획

Bidirectional fidelity-tiered document de-identification/re-identification engine.

> **설계 문서**: [.metadata/INDEX.md](.metadata/INDEX.md)
> **이론적 기반**: [.metadata/theoretical-foundations.md](.metadata/theoretical-foundations.md)

---

## RALPLAN-DR (Decision Record)

### 원칙 (Principles)

1. **Dependency Boundary Integrity** — `transform/`은 경량(~tens of KB)으로 유지. NER/ONNX/parser 의존성 금지.
2. **Offline-First Security** — 설계상 네트워크 호출 제로. Dictionary가 민감 자산. 모든 처리는 로컬 CPU 전용.
3. **Incremental Dictionary Growth** — Dictionary는 단조 증가. 기존 토큰은 절대 재할당 불가.
4. **Fidelity-Tier-Aware Verification** — 파일 포맷별 명시적 검증 계약. 포맷이 허용하는 이상의 보장 금지.
5. **LLM-Agent Compatibility** — CLI는 stdout에 JSON, stderr에 진행상황, 의미적 exit code, non-TTY에서 대화형 프롬프트 금지.

### 핵심 결정 (Decision Drivers)

1. **GLiNER 모델 배포**: Lazy download 방식 (`~/.ink-veil/models/`). 첫 사용 시 다운로드 + SHA-256 checksum 검증. Regex-only fallback.
2. **Subpath Export 경계**: `@lumy-pack/ink-veil/transform` 독립 import. Dictionary는 pure in-memory (I/O 분리).
3. **Korean PII 정확도**: 조사 스트리핑, NFC 정규화, EUC-KR 인코딩 감지가 전 Phase에 걸친 횡단 관심사.

### 대안 비교

| 방식 | 장점 | 단점 | 선택 |
|------|------|------|------|
| **A. Lazy Download** | 작은 npm 크기(~50KB), 설치 후 오프라인 | 첫 실행 네트워크 필요(~30s) | **채택** |
| B. Optional Peer Dep | 명확한 분리, npm 표준 | 설치 마찰, 버전 커플링 | 보류 (Phase 3+ 고려) |
| C. 번들 포함 | 설치 즉시 동작 | npm 크기 비실용적 (~150MB) | 배제 |
| D. 서버 사이드 NER | 모델 관리 불필요 | offline-first 원칙 위반 | 배제 |

### ADR (Architecture Decision Record)

- **Decision**: Lazy download + Result pattern + Subpath export dual entry + Dictionary I/O 분리
- **Consequences**: `~/.ink-veil/models/` 캐시 관리, download 실패 시 graceful degradation, 디스크 ~150MB 고지
- **Follow-ups**: 모델 버전 업데이트 전략, 다중 모델 지원 (Phase 3+)

---

## Phase 0: Foundation & Spec 보강

> 목표: 구현 전에 모든 spec gap을 해소하고 프로젝트 기반을 구축한다.

### 0.1 프로젝트 초기화

- [ ] `package.json` 생성 — `@lumy-pack/ink-veil`, ESM+CJS dual output, bin entry
- [ ] `package.json` `exports` 필드 구성:
  ```json
  {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.mjs", "require": "./dist/index.cjs" },
    "./transform": { "types": "./dist/transform/index.d.ts", "import": "./dist/transform/index.mjs", "require": "./dist/transform/index.cjs" }
  }
  ```
- [ ] `tsconfig.json` — monorepo 루트 상속, `strict: true`, target `ES2022`
- [ ] `tsup.config.ts` — 두 entry point, `transform/` config에 `external: ['onnxruntime-node', '@xenova/transformers']` 명시
- [ ] `vitest.config.ts` + `vitest.e2e.config.ts`
- [ ] `.gitignore`에 `.samples/` 출력 결과 추가
- [ ] 루트 `package.json`에 `inkVeil` workspace script
- [ ] **AC**: `yarn inkVeil build` 성공. `transform/` 빌드 결과물에 onnxruntime 관련 코드 미포함 확인.

### 0.2 에러 시스템 설계 → [.metadata/error-system.md](.metadata/error-system.md)

- [ ] `src/errors/types.ts` — `InkVeilError` base class, `ErrorCode` enum (0-8)
- [ ] `src/errors/result.ts` — `Result<T, E>` discriminated union: `{ ok: true, value: T } | { ok: false, error: E }`
- [ ] `src/errors/index.ts` — barrel export
- [ ] `src/__tests__/errors/` — Result 패턴 unit test
- [ ] **AC**: `ok(value).ok === true`, `err(error).ok === false` 테스트 통과. ErrorCode 0-8 모두 정의.

### 0.3 Spec 보강 문서

- [ ] `.metadata/error-system.md` 작성 — Error code enum, Result pattern, error hierarchy
- [ ] `.metadata/model-deployment.md` 작성 — GLiNER lazy download 전략, 캐시 경로, fallback chain, SHA-256 checksum
- [ ] `.metadata/config-schema.md` 작성 — Phase 2 config 파일 형식/경로/기본값 사전 정의
- [ ] `.metadata/token-design.md` 업데이트:
  - Token counter overflow → 동적 width (3자리 → 999 초과 시 4자리+)
  - Stage 3 fuzzy regex → dictionary 카테고리에서 동적 생성
  - `veilText` 이중 모드 명세 (`veilTextFromSpans` / `veilTextFromDictionary`)
- [ ] `.metadata/detection-pipeline.md` 업데이트:
  - 조사 목록 통일 (은/는/이/가/을/를/에/에서/의/로/와/과/도/만/까지/부터/에서부터)
  - Merger O(n^2) scaling limitation 명시 (interval tree 전환 threshold ~10K spans)
- [ ] `.metadata/cli-interface.md` 업데이트:
  - `--encoding <enc>` 플래그 추가 (default: `utf-8`)
  - `model download` / `model status` 명령 추가
- [ ] **AC**: 12개 spec gap 각각에 대한 resolution이 `.metadata/` 문서에 기록됨 (체크리스트로 검증).

---

## Phase 1: MVP (Core Engine)

> 목표: Dictionary + Detection + Transform + Verification + CLI + Tier 1a/1b 파서로 동작하는 핵심 엔진.
> 참조: [dictionary-architecture.md](.metadata/dictionary-architecture.md), [detection-pipeline.md](.metadata/detection-pipeline.md), [token-design.md](.metadata/token-design.md)

### 1.1 Dictionary 모듈

- [ ] `src/dictionary/dictionary.ts` — `Dictionary` class (pure in-memory, `node:fs`/`node:crypto` import 금지):
  - `create()`, `fromJSON()`, `addEntity()`, `lookup()`, `reverseLookup()`, `stats()`, `snapshot()`, `restore()`, `entries()`
  - `fromJSON()` 시 TokenGenerator counters를 기존 entries의 max ID에서 초기화
- [ ] `src/dictionary/io.ts` — I/O 분리: `saveDictionary()`, `loadDictionary()` (full package 전용, `transform/`에서 미사용)
- [ ] `src/dictionary/entry.ts` — `DictionaryEntry` interface, composite key `${original}::${category}`
- [ ] `src/dictionary/token-generator.ts` — `TokenGenerator`: sequential ID, 동적 width (3자리 기본, 999 초과 시 4자리+)
- [ ] `src/dictionary/types.ts` — `TokenMode`, `DocumentManifest`, `DictionaryStats`
- [ ] `src/dictionary/index.ts` — barrel export
- [ ] `src/__tests__/dictionary/` — forward/reverse lookup, composite key 충돌, snapshot/restore, incremental update, **counter init from existing dictionary** 테스트
- [ ] **AC**:
  - 10,000 entries에서 forward/reverse O(1) lookup
  - `fromJSON()` 후 TokenGenerator가 기존 max counter에서 재개 (ID 충돌 없음)
  - `Dictionary` class에 `node:fs`/`node:crypto` import 없음 확인
  - snapshot/restore 후 전체 상태 일치

### 1.2 Detection — Regex Engine

- [ ] `src/detection/regex/patterns.ts` — 15+ 한국 PII regex 패턴 (RRN, ARN, DL, PASSPORT, BRN, CRN, PHONE, TEL, EMAIL, CARD, ACCOUNT, IP, SERIAL)
- [ ] `src/detection/regex/engine.ts` — `RegexEngine.detect(text): DetectionSpan[]`
- [ ] `src/detection/types.ts` — `DetectionSpan`, `DetectionConfig`, `DetectionMethod`
- [ ] `src/__tests__/detection/regex/` — 각 PII 카테고리별 positive/negative 매칭 테스트
- [ ] **AC**: 15+ 패턴 각각 최소 2개 positive + 2개 negative 케이스 통과

### 1.3 Detection — Manual Engine

- [ ] `src/detection/manual/engine.ts` — `ManualEngine.detect(text, rules): DetectionSpan[]`
- [ ] 문자열 리터럴 + regex 룰 지원
- [ ] `src/__tests__/detection/manual/` — 커스텀 룰 테스트
- [ ] **AC**: 문자열 패턴 `"Project-Alpha"` + regex 패턴 `/INV-\d{8}/g` 모두 정확히 감지

### 1.4 Detection — NER Engine (GLiNER) + 모델 관리

- [ ] `src/detection/ner/engine.ts` — `NEREngine`: Worker Thread 기반 GLiNER ONNX 추론
- [ ] `src/detection/ner/worker.ts` — Worker Thread: Transformers.js v3 / ONNX Runtime 모델 로드 + 추론
- [ ] `src/detection/ner/model-manager.ts` — 모델 lazy download (`~/.ink-veil/models/`):
  - SHA-256 checksum 검증 (hardcoded checksums)
  - Fallback chain: gliner_multi-v2.1 → gliner_ko → regex-only
  - checksum 불일치 시 다운로드 거부 + exit code 6
- [ ] `src/commands/model.ts` — `model download` (사전 다운로드), `model status` (캐시 상태 표시)
- [ ] `src/__tests__/detection/ner/` — mock ONNX 기반 unit test
- [ ] **AC**:
  - mock 모델로 `"홍길동은 삼성전자에 다닌다"` 입력 시 PER(`홍길동`)/ORG(`삼성전자`) span 반환
  - 모델 미설치 시 regex-only fallback + 경고 메시지 + exit code 6
  - `ink-veil model download` 로 모델 사전 다운로드 가능
  - SHA-256 checksum 불일치 시 다운로드 거부

### 1.5 Detection — Merger

- [ ] `src/detection/merger.ts` — 3-engine merge: sort(start ASC, length DESC, priority ASC), greedy accept + overlap resolution
- [ ] `src/detection/particles.ts` — 한국어 조사 후처리 스트리핑 (은/는/이/가/을/를/에/에서/의/로/와/과/도/만/까지/부터/에서부터)
- [ ] `src/detection/normalize.ts` — NFC Unicode 정규화 전처리
- [ ] `src/detection/index.ts` — `DetectionPipeline` facade: MANUAL → REGEX → NER → Merger
- [ ] `src/__tests__/detection/merger/` — overlap resolution, priority, 조사 스트리핑 테스트
- [ ] **AC**:
  - 겹치는 span에서 priority 규칙에 따라 정확히 하나만 선택
  - `"홍길동은"` → entity `"홍길동"` + particle `"은"` 분리
  - `"삼성전자에서"` → entity `"삼성전자"` + particle `"에서"` 분리
  - Merger는 sorted array + O(n^2) worst case (문서화됨, ~10K spans에서 interval tree 고려)

### 1.6 Transform 모듈 (Subpath Export) → [token-design.md](.metadata/token-design.md)

- [ ] `src/transform/veil-from-spans.ts` — `veilTextFromSpans(text, spans, dictionary): VeilResult` — reverse offset 치환 (detection pipeline 결과 사용)
- [ ] `src/transform/veil-from-dictionary.ts` — `veilTextFromDictionary(text, dictionary): VeilResult` — longest-match-first dictionary scan (Chrome Extension용)
- [ ] `src/transform/unveil.ts` — `unveilText(text, dictionary): UnveilResult` — 3-stage fuzzy matching:
  - Stage 1 (strict): 정확한 XML 매칭
  - Stage 2 (loose): 속성 재배치/인용부호 변경 허용
  - Stage 3 (plain): bare token ID 스캔 (dictionary 카테고리에서 동적 regex 생성)
- [ ] `src/transform/signature.ts` — invisible signature 삽입/감지
- [ ] `src/transform/types.ts` — `VeilResult`, `UnveilResult`, `TokenIntegrity`
- [ ] `src/transform/index.ts` — subpath export entry (`Dictionary` pure class + `veilTextFromDictionary` + `unveilText` re-export)
- [ ] `src/__tests__/transform/` — veil/unveil round-trip, fuzzy 3-stage 각각 테스트
- [ ] **AC**:
  - `unveilText(veilTextFromSpans(text, spans, dict), dict).text === text` round-trip 성공
  - `unveilText(veilTextFromDictionary(text, dict), dict).text === text` round-trip 성공
  - Stage 2: `<iv-per id='001'>PER_001</iv-per>` (quote 변경) → 복원 성공
  - Stage 3: `PER_001` (XML 제거) → 복원 성공
  - 사용자 정의 카테고리 `PROJECT_001` → Stage 3에서 동적 regex로 매칭
  - `transform/` 빌드에 `node:fs`, `node:crypto`, `onnxruntime` 미포함

### 1.7 Verification 모듈

- [ ] `src/verification/verify.ts` — `verify(original, restored, tier): VerificationResult`
- [ ] Tier 1a: SHA-256 byte comparison
- [ ] Tier 1b: parsed content deep-equal
- [ ] `src/verification/hash.ts` — SHA-256 해시 유틸
- [ ] `src/__tests__/verification/` — 각 tier별 pass/fail 테스트
- [ ] **AC**: 동일 파일 SHA-256 일치, 1바이트 차이 시 불일치 감지, Tier 1b semantic 비교 통과

### 1.8 Document — Tier 1a 파서 → [fidelity-tiers.md](.metadata/fidelity-tiers.md)

- [ ] `src/document/parser.ts` — `FormatParser` interface, `getParser(format)` router
- [ ] `src/document/types.ts` — `ParsedDocument`, `TextSegment`, `SegmentPosition`, `FidelityTier`
- [ ] `src/document/parsers/text.ts` — TXT/MD 파서 (`chardet` + `iconv-lite`, BOM 보존)
- [ ] `src/document/parsers/csv.ts` — CSV/TSV 파서 (`papaparse`, quoting style 보존)
- [ ] `src/__tests__/document/parsers/` — parse → reconstruct SHA-256 일치
- [ ] **AC**: TXT/CSV 파일의 parse → veil → unveil → reconstruct 후 `SHA-256(original) === SHA-256(restored)`

### 1.9 Document — Tier 1b 파서 (JSON/XML/YAML)

- [ ] `src/document/parsers/json.ts` — JSON 파서
- [ ] `src/document/parsers/xml.ts` — XML 파서 (`fast-xml-parser`)
- [ ] `src/document/parsers/yaml.ts` — YAML 파서 (`js-yaml`, **comment 손실 경고** 출력)
- [ ] `src/__tests__/document/parsers/` — semantic equality 테스트
- [ ] **AC**: JSON/XML/YAML parse → reconstruct 후 `deepEqual(parse(original), parse(restored)) === true`

### 1.10 CLI → [cli-interface.md](.metadata/cli-interface.md)

- [ ] `src/cli.ts` — Commander.js entry point
- [ ] `src/commands/veil.ts` — `veil`: 단일/다중 파일, `--stdin`, `--json`, `--token-mode`, `--no-ner`, `--encoding`
- [ ] `src/commands/unveil.ts` — `unveil`: `--stdin`, `--json`, `--strict`, `--decrypt`
- [ ] `src/commands/detect.ts` — `detect`: dry-run, `--json`
- [ ] `src/commands/verify.ts` — `verify`: original vs restored 비교
- [ ] `src/commands/dict.ts` — `dict`: inspect, add, list
- [ ] Exit codes 0-8 구현
- [ ] `src/__tests__/cli/` — integration test
- [ ] **AC**:
  - `ink-veil veil input.txt -d dict.json --json` → 정상 JSON 출력, exit 0
  - `ink-veil veil --no-such-flag` → exit 2 (invalid arguments)
  - `ink-veil veil nonexistent.txt` → exit 3 (file not found)
  - `ink-veil veil input.xyz` → exit 4 (unsupported format)
  - NER 모델 미설치 시 `--no-ner` 없이 실행 → exit 6 + JSON `"degraded": true`
  - `ink-veil verify orig.txt bad.txt --tier 1a` → exit 7 (verification failed)

### 1.11 Programmatic API

- [ ] `src/index.ts` — `InkVeil.create()` factory, full API export
- [ ] `src/transform/index.ts` — subpath export 검증
- [ ] **AC**:
  - `import { InkVeil } from '@lumy-pack/ink-veil'` 동작
  - `import { veilTextFromDictionary, unveilText, Dictionary } from '@lumy-pack/ink-veil/transform'` 동작
  - `transform/` import 시 `onnxruntime-node` 미로드 확인

### 1.12 E2E 테스트 & Samples

- [ ] `.samples/run-tests.mjs` — CLI E2E 테스트 러너 (scene-sieve 패턴 참조):
  - veil → 토큰 변형 시뮬레이션 → unveil 파이프라인
  - 카테고리별 결과 집계
  - 결과를 `.samples/test-results/`에 저장
- [ ] `.samples/fixtures/` — 한국어 샘플 파일 (가짜 PII 포함, TXT/CSV/JSON/XML/YAML/MD/TSV)
- [ ] `src/__tests__/e2e/pipeline.e2e.test.ts` — Vitest E2E: 전체 파이프라인
- [ ] **AC**: E2E 테스트가 다음 LLM 변형 시나리오를 커버:
  - Quote style 변경: `id="001"` → `id='001'`
  - Whitespace 삽입: `<iv-per  id="001">` (extra space)
  - XML 구조 제거: `<iv-per id="001">PER_001</iv-per>` → `PER_001`
  - Token 누락: 일부 토큰 LLM이 생략
  - Token 할루시네이션: 존재하지 않는 `PER_099` 삽입

---

## Phase 2: Polish & Office Formats

> 목표: Dictionary 암호화/병합, TOML/INI, Tier 2(DOCX/XLSX/HTML) 파서.
> 참조: [dictionary-architecture.md](.metadata/dictionary-architecture.md), [fidelity-tiers.md](.metadata/fidelity-tiers.md)

### 2.1 Dictionary 암호화 → [dictionary-architecture.md](.metadata/dictionary-architecture.md) §7

- [ ] `src/dictionary/encryption.ts` — PBKDF2(100K, SHA-512) + AES-256-GCM
- [ ] Binary format: `[IVDK (4B)][salt (16B)][IV (12B)][encrypted data][auth tag (16B)]`
- [ ] `saveDictionaryEncrypted()` / `loadDictionaryEncrypted()` in `io.ts`
- [ ] CLI `--encrypt` / `--decrypt` 플래그 연동
- [ ] `src/__tests__/dictionary/encryption/` — round-trip, 잘못된 비밀번호 에러 (exit 5)
- [ ] **AC**: magic bytes `IVDK` 확인. 올바른 비밀번호로만 복호화. 틀린 비밀번호 → exit 5.

### 2.2 Dictionary 병합

- [ ] `src/dictionary/merge.ts` — 4가지 전략: `keep-mine`, `keep-theirs`, `prompt`, `rename`
- [ ] CLI `dict merge dict-a.json dict-b.json -o merged.json --strategy <strategy>`
- [ ] `src/__tests__/dictionary/merge/` — 충돌/비충돌/rename 시나리오
- [ ] **AC**: 충돌 있는 두 dictionary 병합 시 전략에 따라 정확히 해소. `rename` 전략 시 ID 재할당 후 충돌 없음.

### 2.3 Tier 1b 추가 (TOML/INI)

- [ ] `src/document/parsers/toml.ts` — TOML (`@ltd/j-toml`)
- [ ] `src/document/parsers/ini.ts` — INI (`ini` npm, **comment 손실 경고**)
- [ ] `src/__tests__/document/parsers/` — semantic equality
- [ ] **AC**: TOML/INI parse → reconstruct → `deepEqual(parsed, restored)` 통과

### 2.4 Tier 2 파서 (DOCX/XLSX/HTML)

- [ ] `src/document/parsers/docx.ts` — DOCX (JSZip + `w:t` XML text node 치환, **`docx` npm 미사용**)
- [ ] `src/document/parsers/xlsx.ts` — XLSX (SheetJS, formula cell skip)
- [ ] `src/document/parsers/html.ts` — HTML (`jsdom`)
- [ ] `src/verification/verify.ts` — Tier 2 structural verification 추가
- [ ] `src/__tests__/document/parsers/` — text node 비교
- [ ] **AC**: DOCX `w:t` 요소의 PII 치환/복원 성공. text node 배열 비교 통과.

### 2.5 사용자 설정 파일 (Optional) → [.metadata/config-schema.md](.metadata/config-schema.md)

- [ ] `src/config/schema.ts` — `~/.ink-veil/config.json` JSON Schema (AJV)
- [ ] `src/config/loader.ts` — load/save, CLI flag > config file > defaults 우선순위
- [ ] **AC**: 설정 파일 없이 모든 기능 동작. 설정 있으면 CLI flag보다 낮은 우선순위로 적용.

---

## Phase 3: Advanced Formats & MCP

> 목표: Tier 3 파서, MCP 서버 통합.
> 참조: [fidelity-tiers.md](.metadata/fidelity-tiers.md), [cli-interface.md](.metadata/cli-interface.md)

### 3.1 Tier 3 파서 (PDF/PPTX/EPUB)

- [ ] `src/document/parsers/pdf.ts` — PDF (`@libpdf/core`, Korean CID 제한 문서화)
- [ ] `src/document/parsers/pptx.ts` — PPTX (ZIP/XML)
- [ ] `src/document/parsers/epub.ts` — EPUB (HTML chapter 기반)
- [ ] `src/verification/verify.ts` — Tier 3 text-layer verification
- [ ] `src/__tests__/document/parsers/` — text extraction 비교
- [ ] **AC**: PDF text 추출 → veil → text 비교 통과 (binary 불일치 허용)

### 3.2 MCP 서버 통합 → [cli-interface.md](.metadata/cli-interface.md) §6

- [ ] `src/mcp/server.ts` — MCP tool server (`@modelcontextprotocol/sdk`)
- [ ] 3 tools: `ink_veil_veil`, `ink_veil_unveil`, `ink_veil_detect`
- [ ] Subpath export `@lumy-pack/ink-veil/mcp` (`package.json` exports에 추가)
- [ ] `src/__tests__/mcp/` — tool input/output contract
- [ ] **AC**: MCP stdio 프로토콜로 veil/unveil/detect tool 호출 가능

### 3.3 GLiNER 모델 관리 CLI 확장

- [ ] `src/commands/model.ts` 확장 — `model list` (설치된 모델 목록), `model remove` (모델 삭제)
- [ ] 디스크 사용량 표시
- [ ] **AC**: `ink-veil model list` 로 설치된 모델과 크기 표시

---

## Phase 4: Experimental

> 목표: Tier 4 실험적 포맷, Faker replacement 모드.
> 참조: [fidelity-tiers.md](.metadata/fidelity-tiers.md), [theoretical-foundations.md](.metadata/theoretical-foundations.md)

### 4.1 Tier 4 파서 (HWP/RTF/ODT/ODS/LaTeX)

- [ ] 각 포맷별 best-effort 파서 구현
- [ ] Tier 4: 검증 없음 (best-effort text comparison, CLI에 `"tier": "4", "guarantee": "none"` 명시)
- [ ] **AC**: 텍스트 추출 및 치환 동작. Round-trip 보장 없음을 JSON 출력과 stderr에 명시.

### 4.2 Faker Replacement 모드

- [ ] `src/transform/faker.ts` — 가짜 실명 치환 (`@faker-js/faker` 한국어 locale)
- [ ] 토큰 충돌 방지: dictionary에서 사용 중인 faker 이름 제외
- [ ] **AC**: `"홍길동"` → `"김철수"` (가짜 한국 이름) 치환. dictionary에서 역방향 복원 가능.

---

## Spec Gap Resolution Matrix

| # | Gap | Resolution | 반영 문서 | Phase |
|---|-----|------------|----------|-------|
| 1 | Error types/codes | `InkVeilError` + `ErrorCode` enum + `Result<T,E>` | [error-system.md](.metadata/error-system.md) | 0.2 |
| 2 | GLiNER 모델 배포 | Lazy download + SHA-256 checksum + fallback chain | [model-deployment.md](.metadata/model-deployment.md) | 1.4 |
| 3 | Config 스키마 | Phase 1: CLI flags only. Phase 2: `~/.ink-veil/config.json` | [config-schema.md](.metadata/config-schema.md) | 2.5 |
| 4 | Dictionary 암호화 API | PBKDF2 + AES-256-GCM, binary format | [dictionary-architecture.md](.metadata/dictionary-architecture.md) §7 | 2.1 |
| 5 | MCP 서버 통합 | Same package, `@lumy-pack/ink-veil/mcp` subpath | [cli-interface.md](.metadata/cli-interface.md) §6 | 3.2 |
| 6 | Korean particle stripping | Custom regex, 17개 조사 패턴, 외부 형태소 분석기 불필요 | [detection-pipeline.md](.metadata/detection-pipeline.md) §4 | 1.5 |
| 7 | Token counter overflow | 동적 width (3자리 기본 → 999 초과 시 4자리+) | [token-design.md](.metadata/token-design.md) §3 | 1.1 |
| 8 | Batch error handling | Per-file `Result<T,E>`, snapshot/restore for rollback | [error-system.md](.metadata/error-system.md) | 1.1 |
| 9 | Stdin encoding | `--encoding <enc>` 플래그 (default: `utf-8`) | [cli-interface.md](.metadata/cli-interface.md) §3 | 1.10 |
| 10 | DocumentManifest lifecycle | `dictionary.compact()` for pruning (Phase 2+) | [dictionary-architecture.md](.metadata/dictionary-architecture.md) | 2.2 |
| 11 | Category extensibility | Stage 3 regex를 dictionary 카테고리에서 동적 생성 | [token-design.md](.metadata/token-design.md) §4 | 1.6 |
| 12 | tsup subpath export | Dual entry point + explicit external + bundle-size CI | PLAN.md §0.1 | 0.1 |
| 13 | Dictionary I/O 분리 | `Dictionary` pure in-memory, `io.ts`로 save/load 분리 | PLAN.md §1.1 | 1.1 |
| 14 | veilText 이중 모드 | `veilTextFromSpans` + `veilTextFromDictionary` 분리 | [token-design.md](.metadata/token-design.md) §6 | 1.6 |

---

## Guardrails

### Must Have

- Dependency boundary: `transform/`가 `detection/`, `document/`를 절대 import하지 않음
- 모든 public function에 `Result<T, E>` 반환 타입
- Korean NFC normalization이 모든 텍스트 입력의 전처리
- Exit code 0-8이 CLI 문서와 일치
- ONNX 모델 다운로드 시 SHA-256 checksum 검증

### Must NOT Have

- `transform/`에서 `onnxruntime-node`, `node:fs`, `node:crypto` 의존성
- 네트워크 호출 (model download 제외)
- 대화형 프롬프트 (non-TTY 환경)
- `docx` npm 패키지 사용 (JSZip 사용)
- Checksum 미검증 바이너리 실행

---

## Success Criteria

1. Phase 1 완료: TXT/MD/CSV/TSV/JSON/XML/YAML 7개 포맷에서 veil → unveil round-trip
2. CLI가 POSIX 규약 준수, JSON 출력, 8개 exit code
3. `@lumy-pack/ink-veil/transform` subpath가 NER/ONNX/Node.js I/O 없이 동작
4. E2E 테스트가 detect → veil → LLM 변형 시뮬레이션(5개 시나리오) → unveil → verify 커버
5. Dictionary 단일 인스턴스로 다중 문서 처리 시 entity 일관성 보장
6. `model download`로 air-gapped 환경 지원
