# NER 추론 파이프라인 개선 제안서

## 1. 문제 상황

### 1.1 현상

NER 워커(`worker.ts`)가 모델 로딩 시 다음 에러로 실패:

```
Error: Unsupported model type: gliner
```

### 1.2 원인 분석

| 구분 | 상태 |
|------|------|
| 모델 다운로드 (8개 파일) | 정상 — SHA-256 검증 통과 |
| 모델 디렉토리 구조 | 정상 — `config.json`, `tokenizer.json`, `onnx/model_int8.onnx` 등 |
| `@xenova/transformers` pipeline() 호출 | **실패** |

**근본 원인**: `@xenova/transformers` v2.17.2의 `pipeline('token-classification', ...)` API는
`config.json`의 `model_type` 필드를 읽어 모델 아키텍처를 결정한다.
GLiNER의 `config.json`에는 `"model_type": "gliner"`로 되어 있으나,
`@xenova/transformers`는 `gliner` 타입을 지원하지 않는다 (BERT, GPT2, T5 등 표준 HuggingFace 아키텍처만 지원).

GLiNER는 커스텀 아키텍처(span-based NER with bidirectional transformer)로,
표준 `token-classification` 파이프라인과 호환되지 않는다.
이는 `transformers.js` GitHub issue [#826](https://github.com/huggingface/transformers.js/issues/826)에서도 공식 확인된 제한사항이다.

### 1.3 영향 범위

- NER 기능 전체 (`--no-ner` 없이 실행하면 regex fallback으로 동작)
- regex 기반 detection은 정상 작동 (42/42 E2E 테스트 통과)
- 모델 다운로드/관리 기능은 정상 작동

---

## 2. 해결 방안

### 방안 A: `gliner` npm 패키지 활용 (권장)

**개요**: GLiNER 공식 JavaScript 포팅인 [`gliner`](https://www.npmjs.com/package/gliner) (v0.0.19) 패키지를 사용.

**패키지 정보**:
- npm: `gliner` (v0.0.19)
- GitHub: [Ingvarstep/GLiNER.js](https://github.com/Ingvarstep/GLiNER.js)
- 라이센스: Apache-2.0 (GitHub) / MIT (npm)
- 의존성: `@xenova/transformers` 2.17.2, `onnxruntime-common` 1.19.2, `onnxruntime-web` 1.19.2
- Node.js 전용 엔트리포인트 (`src/node/`) 존재

**동작 방식**:
- 자체 전처리/후처리 로직 보유 (`src/lib/processor.ts`, `src/lib/decoder.ts`)
- `@xenova/transformers`는 토크나이저 로딩에만 사용
- ONNX 추론은 `onnxruntime` 직접 사용 (`src/node/ONNXNodeWrapper.ts`)
- GLiNER 고유의 span-based NER 파이프라인 구현

**변경 범위**:

| 파일 | 변경 내용 |
|------|-----------|
| `package.json` | `gliner` 의존성 추가 |
| `src/detection/ner/worker.ts` | `pipeline()` 대신 `Gliner` 클래스 사용 |
| `src/detection/ner/engine.ts` | IPC 메시지 포맷 조정 (labels → entities) |

**worker.ts 변경 예시**:
```typescript
import { Gliner } from 'gliner/node';  // Node.js 전용 엔트리포인트

let gliner: Gliner;

async function loadModel(): Promise<void> {
  gliner = new Gliner({
    tokenizerPath: modelDir,           // 로컬 토크나이저
    onnxSettings: {
      modelPath: join(modelDir, 'onnx/model_int8.onnx'),
      executionProvider: 'cpu',
    },
    maxWidth: 12,
    modelType: 'gliner',
  });
  await gliner.initialize();
}

async function runInference(text: string, labels: string[], threshold: number) {
  const results = await gliner.inference({
    texts: [text],
    entities: labels,
    threshold,
    flatNer: true,
  });
  return results[0]; // [{ spanText, start, end, label, score }]
}
```

**장점**:
- GLiNER 공식 포팅, 검증된 전처리/후처리 로직
- 최소 변경 (worker.ts만 수정)
- 기존 모델 파일 그대로 사용 가능
- Node.js 전용 코드 경로 존재

**단점**:
- 패키지 성숙도 낮음 (v0.0.19, star 22개)
- `onnxruntime-web` 의존성 — Node.js에서는 `onnxruntime-node`가 더 적합
- 마지막 업데이트 2026-02 (1개월 전)

**리스크 완화**:
- `onnxruntime-web`이 Node.js WASM backend를 지원하므로 동작은 가능
- 필요시 `ONNXNodeWrapper`를 `onnxruntime-node`로 교체 가능 (의존성이 이미 있음)

---

### 방안 B: `onnxruntime-node` 직접 사용 + 커스텀 파이프라인

**개요**: `onnxruntime-node`로 ONNX 모델을 직접 로드하고, GLiNER 전처리/후처리를 자체 구현.

**변경 범위**:

| 파일 | 변경 내용 |
|------|-----------|
| `src/detection/ner/worker.ts` | 전면 재작성 — `InferenceSession` 직접 사용 |
| `src/detection/ner/tokenizer.ts` | 신규 — SentencePiece 토크나이저 래퍼 |
| `src/detection/ner/gliner-pipeline.ts` | 신규 — GLiNER 전처리 (토큰 → 텐서) + 후처리 (스팬 디코딩) |

**핵심 구현 요소**:

```
1. 토크나이저 로딩 (tokenizer.json → input_ids, attention_mask)
2. GLiNER 입력 구성:
   - 텍스트 토큰 + [SEP] + 엔티티 라벨 토큰
   - words_mask, text_lengths 등 메타데이터
3. ONNX 추론 (InferenceSession.run)
4. 스팬 디코딩:
   - 출력 텐서에서 (start, end, label, score) 추출
   - 토큰 위치 → 문자 위치 매핑
   - threshold 필터링 + NMS (Non-Maximum Suppression)
```

**장점**:
- 외부 의존성 없음 (`onnxruntime-node`은 이미 의존성에 있음)
- 완전한 제어권 — 성능 최적화 가능
- `onnxruntime-node` native binding으로 WASM 대비 빠른 추론

**단점**:
- 구현 공수 큼 (GLiNER Python 코드를 JS로 포팅)
- 스팬 디코딩 로직이 복잡함 (max_width, span_mode 등)
- 테스트 커버리지 확보에 시간 필요
- GLiNER 모델 버전 변경 시 호환성 유지 비용

---

### 방안 C: `gliner` npm 패키지 포크 + `onnxruntime-node` 교체 (하이브리드)

**개요**: `gliner` 패키지의 검증된 전처리/후처리 로직을 가져오되,
ONNX 런타임을 `onnxruntime-node`로 교체하여 Node.js 네이티브 성능을 확보.

**변경 범위**:

| 파일 | 변경 내용 |
|------|-----------|
| `src/detection/ner/worker.ts` | GLiNER 파이프라인 사용 |
| `src/detection/ner/gliner/` | 신규 디렉토리 — `gliner` 패키지에서 핵심 로직 추출 |

**장점**:
- 검증된 전처리/후처리 로직 활용 (방안 B의 위험 제거)
- `onnxruntime-node` 네이티브 성능 (방안 A의 WASM 오버헤드 제거)
- 외부 패키지 의존성 제거 (vendor)

**단점**:
- GLiNER.js 업스트림 변경 추적 비용
- 코드 복사에 따른 라이센스 관리 필요 (Apache-2.0)
- 초기 통합 공수

---

## 3. 비교 요약

| 기준 | 방안 A (npm gliner) | 방안 B (직접 구현) | 방안 C (포크+교체) |
|------|:---:|:---:|:---:|
| 구현 공수 | **낮음** | 높음 | 중간 |
| 추론 성능 | 중간 (WASM) | **높음** (native) | **높음** (native) |
| 유지보수 | **낮음** | 높음 | 중간 |
| 외부 의존성 | 1개 추가 | 없음 | 없음 |
| 정확도 위험 | **낮음** | 중간 | **낮음** |

---

## 4. 권장 실행 계획

### Phase 1: 방안 A로 빠른 검증 (1일)

1. `gliner` npm 패키지 설치
2. `worker.ts`를 `Gliner` 클래스 기반으로 수정
3. E2E 테스트: 실제 모델 로딩 → 추론 → 결과 확인
4. 성능 측정: 추론 시간, 메모리 사용량

### Phase 2: 성능 평가 후 결정

- **충분하다면**: 방안 A 유지, 프로덕션 적용
- **WASM 오버헤드가 문제라면**: 방안 C로 전환 (gliner에서 로직 추출 + onnxruntime-node)
- **패키지 안정성 문제 시**: 방안 B (직접 구현)

---

## 5. 참고 자료

- [GLiNER.js GitHub](https://github.com/Ingvarstep/GLiNER.js)
- [gliner npm package](https://www.npmjs.com/package/gliner)
- [transformers.js GLiNER issue #826](https://github.com/huggingface/transformers.js/issues/826)
- [GLiNER Paper (arXiv)](https://arxiv.org/abs/2311.08526)
- [onnxruntime-node docs](https://onnxruntime.ai/docs/get-started/with-javascript/node.html)
