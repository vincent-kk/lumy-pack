# @lumy-pack/scene-sieve

[![npm version](https://img.shields.io/npm/v/@lumy-pack/scene-sieve)](https://www.npmjs.com/package/@lumy-pack/scene-sieve)
[![license](https://img.shields.io/npm/l/@lumy-pack/scene-sieve)](./LICENSE)
[![node](https://img.shields.io/node/v/@lumy-pack/scene-sieve)](https://nodejs.org)

컴퓨터 비전을 사용하여 비디오 및 GIF 파일에서 가장 의미 있는 프레임을 자동으로 추출합니다.

```
Video/GIF ──▶ Extract (FFmpeg) ──▶ Analyze (OpenCV) ──▶ Prune ──▶ Output
               I-frames / FPS       AKAZE + DBSCAN        MinHeap    JPG / Buffer
```

## 기능

- **애니메이션 추적** — 로딩 스피너나 기타 반복되는 애니메이션을 감지하고 기록합니다
- **풍부한 메타데이터** — 장면 타임스탬프 및 애니메이션 상세 정보를 포함한 `.metadata.json`을 생성합니다
- **스마트 프레임 선택** — 균등하게 분산된 샘플이 아닌 시각적으로 의미 있는 장면 변화를 식별합니다
- **컴퓨터 비전 파이프라인** — AKAZE 특징 감지, DBSCAN 클러스터링, IoU 추적 및 정보 이득 스코어링
- **세 가지 입력 모드** — 파일 경로, 비디오 Buffer, 또는 사전 추출된 프레임 Buffers
- **유연한 정제(Pruning)** — 고정 개수 유지, 임계값으로 필터링, 또는 두 가지 조합
- **번들된 FFmpeg** — 시스템 레벨 FFmpeg 설치가 필요하지 않습니다
- **듀얼 출력** — ESM 및 CommonJS 호환
- **진행 상황 콜백** — 실시간으로 추출 진행 상황을 추적합니다
- **JPEG 품질 제어** — mozjpeg 최적화를 포함한 구성 가능한 출력 품질

## 설치

```bash
npm install @lumy-pack/scene-sieve
# or
yarn add @lumy-pack/scene-sieve
```

## 빠른 시작

### CLI

```bash
# 기본값인 20개의 주요 장면 추출
npx scene-sieve input.mp4

# 정확히 8개의 장면 유지
npx scene-sieve input.mp4 -n 8

# 임계값 기반 선택 사용
npx scene-sieve input.mp4 -t 0.3

# 추출할 최대 프레임 수 및 출력 디렉토리 지정
npx scene-sieve input.mp4 -mf 500 -o ./scenes -q 90
```

### 모듈

```typescript
import { extractScenes } from '@lumy-pack/scene-sieve';

const result = await extractScenes({
  mode: 'file',
  inputPath: './input.mp4',
  count: 8,
  outputPath: './scenes',
});

console.log(
  `${result.prunedFramesCount} scenes extracted in ${result.executionTimeMs}ms`,
);
// 출력:
//   scenes/frame_0001.jpg
//   scenes/frame_0002.jpg
//   ...
//   scenes/.metadata.json
```

## CLI 레퍼런스

```
scene-sieve <input> [options]
```

| 옵션                         | 설명                                           | 기본값                      |
| ---------------------------- | ---------------------------------------------- | --------------------------- |
| `<input>`                    | 입력 비디오 또는 GIF 파일 경로                 | (필수)                      |
| `-n, --count <number>`       | 유지할 최대 프레임 개수                        | `20`                        |
| `-t, --threshold <number>`   | 정규화된 스코어 임계값 (0, 1]                  | `0.5`                       |
| `-o, --output <path>`        | 출력 디렉토리                                  | 입력과 동일한 디렉토리      |
| `--fps <number>`             | 프레임 추출용 최대 FPS                         | `5`                         |
| `-mf, --max-frames <number>` | 추출할 최대 프레임 수 (자동 FPS 조절)          | `300`                       |
| `-s, --scale <number>`       | 비전 분석용 스케일 크기 (px)                   | `720`                       |
| `-q, --quality <number>`     | JPEG 출력 품질 (1–100)                         | `80`                        |
| `-it, --iou-threshold <number>`| 애니메이션 추적용 IoU 임계값 (0–1)           | `0.9`                       |
| `-at, --anim-threshold <number>`| 애니메이션 판정 최소 연속 프레임 수         | `5`                         |
| `--debug`                    | 검사용 임시 작업 공간 유지                     | `false`                     |

### 지원 형식

| 유형   | 확장자                              |
| ------ | ----------------------------------- |
| 비디오 | `.mp4`, `.mov`, `.avi`, `.mkv`, `.webm` |
| 애니메이션 | `.gif`                              |

### 파라미터 튜닝 가이드

어디서부터 시작해야 할지 모르겠다면? 각 파라미터가 출력에 미치는 영향을 ~19초 화면 녹화(MOV)와 GIF 애니메이션 실측 벤치마크로 정리했습니다.

#### `--count` — 유지할 프레임 수

| 설정 | 추출 프레임 | 선택 프레임 | 비고 |
|------|-----------|-----------|------|
| `-n 3` | 90 | 3 | 첫/마지막 프레임은 항상 보존됨 (boundary protection) |
| `-n 10` | 90 | 10 | 짧은 요약에 적합 |
| `-n 20` (기본값) | 90 | 20 | 대부분의 영상에서 균형 잡힌 설정 |
| `-n 50` | 90 | 22 | 점수 임계값을 통과한 프레임이 22개뿐 — 실제 장면 수 이상의 count는 효과 없음 |

#### `--threshold` — 프레임 유지 최소 점수

값이 높을수록 = 엄격한 필터 = 적은 프레임.

| 설정 | 선택 프레임 | 비고 |
|------|-----------|------|
| `-t 0.1` | 20 | 매우 관대 — 대부분의 장면 변화가 통과 |
| `-t 0.3` | 20 | 화면 녹화에선 여전히 관대 |
| `-t 0.5` (기본값) | 20 | 기본 count 20에 의해 캡됨 |
| `-t 0.7` | 19 | 미세한 변화가 필터링되기 시작 |
| `-t 0.9` | 12 | 주요 장면 전환만 남음 |

> **팁**: `-t`만 단독 사용하면 "중요한 것 전부 보여줘" 모드. `-n`과 조합하면 상한선 설정 (예: `-t 0.3 -n 10`).

#### `--fps`와 `--max-frames` — 추출 밀도

분석 전에 영상에서 몇 프레임을 뽑을지 제어합니다. 프레임이 많을수록 = 정밀하지만 처리 시간 증가.

| 설정 | 추출 프레임 | 선택 프레임 | 시간 |
|------|-----------|-----------|------|
| `--fps 1` | 18 | 6 | ~5초 |
| `--fps 5` (기본값) | 90 | 20 | ~25초 |
| `--fps 10` | 180 | 20 | ~47초 |
| `-mf 50` | 47 | 13 | ~13초 |

> **팁**: 빠른 미리보기엔 `--fps 1`이 5배 빠릅니다. 프레임 단위 정밀 분석엔 `--fps 10`이 세밀한 전환을 포착합니다.

#### `--scale` — 분석 해상도

비전 분석에 사용되는 해상도를 제어합니다 (출력 해상도가 아님). 낮을수록 = 빠르지만 감지 민감도 저하.

| 설정 | 선택 프레임 | 시간 | 출력 크기 |
|------|-----------|------|----------|
| `-s 360` | 7 | ~6초 | 72 KB |
| `-s 720` (기본값) | 20 | ~25초 | 634 KB |
| `-s 1080` | 20 | ~54초 | 1,172 KB |

> **팁**: `360`은 빠른 스캔에 적합. `720`이 속도/품질 최적 균형점. `1080`은 미세한 UI 변화를 감지해야 할 때만 필요.

#### `--iou-threshold`와 `--anim-threshold` — 애니메이션 감지 민감도

반복되는 애니메이션(스피너, 깜빡이는 커서)을 얼마나 적극적으로 감지하고 억제할지 제어합니다.

| 설정 | 감지된 애니메이션 | 비고 |
|------|----------------|------|
| `-it 0.5 -at 3` | 7개 (MOV), 4개 (GIF) | 민감 — 대부분의 반복 움직임 포착 |
| `-it 0.9 -at 5` (기본값) | 0개 | 보수적 — 명확한 반복만 감지 |
| `-it 0.95 -at 10` | 0개 | 매우 보수적 |

> **팁**: 영상에 로딩 스피너나 반복 UI 애니메이션이 있다면 `-it 0.5 -at 3`으로 억제해보세요.

#### `--quality` — 출력 JPEG 품질

파일 크기에만 영향을 미치며, **장면 감지 결과에는 무관**합니다. quality 값과 관계없이 동일한 프레임이 선택됩니다.

| 설정 | 파일 크기 (5 프레임 기준) |
|------|------------------------|
| `-q 30` | 62 KB |
| `-q 80` (기본값) | 151 KB |
| `-q 100` | 407 KB |

### 추천 프리셋

```bash
# 빠른 미리보기 — 빠르고 대략적인 선택
scene-sieve input.mp4 --fps 1 -s 360 -n 10

# 균형 (기본값) — 대부분의 상황에 적합
scene-sieve input.mp4

# 고정밀 — 미세한 전환까지 포착
scene-sieve input.mp4 --fps 10 -s 1080 -t 0.3

# UI 녹화 — 애니메이션 억제, 핵심 상태만 보존
scene-sieve recording.mov -it 0.5 -at 3 -t 0.3 -n 15

# 최소 요약 — 주요 장면만
scene-sieve input.mp4 -t 0.9 -n 5
```

### 예제

```bash
# GIF에서 추출
scene-sieve animation.gif -n 4 -o ./keyframes

# 임계값 필터링을 포함한 고품질 출력
scene-sieve demo.mov -t 0.2 -q 95

# 임계값 + 개수 상한 결합
scene-sieve long-video.mp4 -t 0.15 -n 20

# 디버그 모드: 검사용 임시 파일 유지
scene-sieve input.mp4 --debug
```

## API 레퍼런스

### `extractScenes(options)`

비디오, GIF 또는 사전 추출된 프레임 버퍼에서 주요 프레임을 추출합니다.

```typescript
function extractScenes(options: SieveOptions): Promise<SieveResult>;
```

### 입력 모드

`mode` 필드는 입력이 제공되는 방식과 반환되는 출력을 결정합니다.

#### 파일 모드

디스크에서 비디오/GIF를 읽고 출력 디렉토리에 JPEG 파일을 씁니다.

```typescript
const result = await extractScenes({
  mode: 'file',
  inputPath: './video.mp4',
  count: 5,
  outputPath: './output',
  quality: 90,
});

console.log(result.outputFiles);
// ['./output/frame_0001.jpg', './output/frame_0002.jpg', ..., './output/.metadata.json']
```

#### Buffer 모드

비디오를 Node.js Buffer로 받아들이고 프레임 Buffers를 반환합니다. 스트림 처리 또는 서버리스 환경에서 유용합니다.

```typescript
import { readFile } from 'node:fs/promises';

const videoBuffer = await readFile('./video.mp4');

const result = await extractScenes({
  mode: 'buffer',
  inputBuffer: videoBuffer,
  count: 5,
});

console.log(result.outputBuffers?.length); // 5
// 각 버퍼는 JPEG 이미지입니다
```

#### Frames 모드

사전 추출된 프레임 이미지를 Buffers로 받아들입니다. **FFmpeg이 필요하지 않습니다.** 프레임이 이미 다른 소스에서 사용 가능한 경우에 유용합니다.

```typescript
const frames: Buffer[] = [
  /* JPEG/PNG buffers */
];

const result = await extractScenes({
  mode: 'frames',
  inputFrames: frames,
  count: 5,
});

console.log(result.outputBuffers?.length); // 5
```

### 옵션

```typescript
interface SieveOptionsBase {
  count?: number; // 유지할 최대 프레임 개수 (기본값: 20)
  threshold?: number; // 범위 (0, 1]에서의 스코어 임계값 (기본값: 0.5)
  outputPath?: string; // 출력 디렉토리 (파일 모드만 해당)
  fps?: number; // 추출 FPS (기본값: 5)
  maxFrames?: number; // 추출할 최대 프레임 수 (기본값: 300)
  scale?: number; // 분석용 스케일 (px) (기본값: 720)
  quality?: number; // JPEG 품질 1-100 (기본값: 80)
  iouThreshold?: number; // 애니메이션 추적용 IoU (기본값: 0.9)
  animationThreshold?: number; // 애니메이션 판정 최소 프레임 (기본값: 5)
  debug?: boolean; // 임시 작업 공간 유지 (기본값: false)
  onProgress?: (phase: ProgressPhase, percent: number) => void;
}

type SieveOptions = SieveOptionsBase & SieveInput;
```

### 결과

```typescript
interface SieveResult {
  success: boolean;
  originalFramesCount: number; // 추출/제공된 총 프레임 수
  prunedFramesCount: number; // 주요 장면으로 선택된 프레임 수
  outputFiles: string[]; // 파일 경로 (파일 모드)
  outputBuffers?: Buffer[]; // JPEG 버퍼 (buffer/frames 모드)
  animations?: AnimationMetadata[]; // 감지된 애니메이션 정보
  video?: VideoMetadata; // 비디오 소스 메타데이터
  executionTimeMs: number;
}
```

### 정제 전략

정제 전략은 제공된 옵션을 기반으로 자동으로 선택됩니다:

| 옵션                       | 전략                    | 동작                                                   |
| -------------------------- | ----------------------- | ------------------------------------------------------ |
| `count`만                  | **count**               | 탐욕적 병합 — `count`개가 남을 때까지 최저 스코어 프레임 제거 |
| `threshold`만              | **threshold**           | 정규화된 스코어 >= `threshold`인 프레임 유지           |
| `count` + `threshold` 모두 | **threshold-with-cap**  | 먼저 임계값 필터 적용, 그 다음 `count`로 상한 설정      |

### 진행 상황 추적

```typescript
type ProgressPhase = 'EXTRACTING' | 'ANALYZING' | 'PRUNING' | 'FINALIZING';

const result = await extractScenes({
  mode: 'file',
  inputPath: './video.mp4',
  onProgress: (phase, percent) => {
    console.log(`${phase}: ${Math.round(percent)}%`);
  },
});
```

## 출력 메타데이터

`file` 모드로 실행할 때, `scene-sieve`는 출력 디렉토리에 `.metadata.json` 파일을 생성합니다.

```json
{
  "video": {
    "originalDurationMs": 15000,
    "fps": 5,
    "resolution": { "width": 720, "height": 405 }
  },
  "frames": [
    {
      "step": 1,
      "fileName": "frame_0001.jpg",
      "frameId": 1,
      "timestampMs": 0
    }
  ],
  "animations": [
    {
      "type": "loading_spinner",
      "boundingBox": { "x": 100, "y": 200, "width": 50, "height": 50 },
      "startFrameId": 12,
      "endFrameId": 25,
      "durationMs": 2600
    }
  ]
}
```

## 동작 원리

### 파이프라인

scene-sieve는 입력을 5단계 파이프라인을 통해 처리합니다:

1. **Init** — 임시 작업 공간을 생성하고 입력 모드를 해결합니다
2. **Extract** — FFmpeg을 통해 프레임을 가져옵니다 (I-frame 우선, FPS fallback; `frames` 모드에서 건너뜀)
3. **Analyze** — 각 인접 프레임 쌍에 대해 정보 이득 스코어 G(t)를 계산합니다
4. **Prune** — 선택된 정제 전략을 사용하여 G(t) 스코어를 기반으로 프레임을 선택합니다
5. **Finalize** — 출력 파일을 씁니다 (원자적 이름 바꾸기) 또는 Buffers를 반환합니다; 작업 공간을 정리합니다

### 비전 분석

분석기는 4단계를 통해 인접한 프레임 쌍 각각에 스코어를 매깁니다:

1. **AKAZE 특징 차이** — 프레임 간 키포인트를 감지 및 매칭합니다; 새로 나타나고 사라진 특징을 식별합니다
2. **DBSCAN 클러스터링** — 새 특징 포인트를 공간 클러스터로 그룹화합니다
3. **IoU 추적** — 클러스터 경계 상자를 시간에 따라 추적합니다; 반복된 애니메이션 영역(예: 로딩 스피너)을 식별하고 기록합니다
4. **G(t) 스코어링** — 클러스터 면적 비율 및 특징 밀도로부터 정보 이득을 계산하며, 애니메이션 영역을 제외하여 고유한 장면에 집중합니다

G(t) 스코어가 높은 프레임은 더 큰 시각적 변화를 나타내므로 정제 중에 보존됩니다.

## 요구 사항

- **Node.js** >= 20
- **FFmpeg**: `ffmpeg-static`를 통해 번들됨 — 시스템 설치가 필요하지 않습니다
- **OpenCV**: `@techstark/opencv-js`를 통해 WASM으로 번들됨 — 네이티브 빌드가 필요하지 않습니다
- **sharp**: 네이티브 바이너리가 필요합니다. 대부분의 플랫폼에 대해 사전 빌드된 바이너리가 자동으로 다운로드됩니다. 빌드 문제가 발생하면 [sharp 설치 가이드](https://sharp.pixelplumbing.com/install)를 참고하세요.

## 라이선스

[MIT](./LICENSE)
