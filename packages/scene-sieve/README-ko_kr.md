# @lumy-pack/scene-sieve

[![npm version](https://img.shields.io/npm/v/@lumy-pack/scene-sieve)](https://www.npmjs.com/package/@lumy-pack/scene-sieve)
[![license](https://img.shields.io/npm/l/@lumy-pack/scene-sieve)](./LICENSE)
[![node](https://img.shields.io/node/v/@lumy-pack/scene-sieve)](https://nodejs.org)

컴퓨터 비전을 사용하여 비디오 및 GIF 파일에서 가장 의미 있는 프레임을 자동으로 추출합니다.

```
Video/GIF ──▶ Extract (FFmpeg) ──▶ Analyze (OpenCV) ──▶ Prune ──▶ Output
               FPS grid             AKAZE + DBSCAN        MinHeap    JPG / Buffer
```

## 기능

- **애니메이션 추적** — 로딩 스피너나 기타 반복되는 애니메이션을 감지하고 기록합니다
- **변화 신호와 컨택트 시트** — 메타데이터 v2의 영역·점수·유지 시간과 선택적 `sheet.jpg`를 제공합니다
- **스마트 프레임 선택** — 균등하게 분산된 샘플이 아닌 시각적으로 의미 있는 장면 변화를 식별합니다
- **컴퓨터 비전 파이프라인** — AKAZE 특징 감지, DBSCAN 클러스터링, IoU 추적 및 정보 이득 스코어링
- **세 가지 입력 모드** — 파일 경로, 비디오 Buffer, 또는 사전 추출된 프레임 Buffers
- **유연한 정제(Pruning)** — 분포 정규화 임계값으로 필터링한 뒤 개수 상한 적용
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

# Keep up to 8 scenes
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
// Output:
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
| `--fps <number>`             | 요청 추출 FPS (양의 실수 허용)                         | `5`                         |
| `-mf, --max-frames <number>` | 엄격한 후보 수 상한 (FPS 자동 감소)          | `300`                       |
| `-s, --scale <number>`       | 추출 높이 / 분석 너비 (px)                   | `720`                       |
| `-q, --quality <number>`     | JPEG 출력 품질 (1–100)                         | `80`                        |
| `-it, --iou-threshold <number>`| 애니메이션 추적용 IoU 임계값 (0–1)           | `0.9`                       |
| `-at, --anim-threshold <number>`| 애니메이션 판정 최소 연속 프레임 수         | `5`                         |
| `--debug`                    | 검사용 임시 작업 공간 유지                     | `false`                     |
| `--sheet` | 선택 프레임 컨택트 시트 생성 | `false` |
| `--include-edges` | 후보 간선 진단을 메타데이터에 포함 | `false` |

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

값이 높을수록 더 엄격하게 필터링하여 적은 프레임을 남깁니다. 점수는 영상 내 양의 점수 분포를 기준으로 정규화됩니다. 양의 점수가 10개 이하면 min-max, 그보다 많으면 중앙값·MAD 기반 로지스틱 점수와 백분위 순위를 결합합니다. `0.5`는 절대 변화량이나 최대 점수의 절반을 뜻하지 않습니다.

| 설정 | 선택 프레임 | 비고 |
|------|-----------|------|
| `-t 0.1` | 20 | 매우 관대 — 대부분의 장면 변화가 통과 |
| `-t 0.3` | 20 | 화면 녹화에선 여전히 관대 |
| `-t 0.5` (기본값) | 20 | 기본 count 20에 의해 캡됨 |
| `-t 0.7` | 19 | 미세한 변화가 필터링되기 시작 |
| `-t 0.9` | 12 | 주요 장면 전환만 남음 |

> **팁**: `-t`만 지정해도 기본 `count=20` 상한이 적용됩니다. `-n`으로 상한을 조정하세요 (예: `-t 0.3 -n 10`).

#### `--fps`와 `--max-frames` — 추출 밀도

분석 전에 영상에서 몇 프레임을 뽑을지 제어합니다. 프레임이 많을수록 = 정밀하지만 처리 시간 증가.

file/buffer 후보 수는 `maxFrames`(정수 ≥ 2)의 엄격한 상한을 따릅니다. 유효 FPS는 `min(fps, maxFrames / duration)`이며 0.5fps 하한이 없습니다. `--fps 0.5` 같은 양의 실수를 허용합니다. 1시간 영상을 300장 예산으로 처리하면 약 0.083fps(12초 간격)로 추출됩니다. frames 입력에는 이 상한을 적용하지 않습니다.

타임스탬프는 소스 프레임의 원래 PTS가 아니라 FFmpeg 출력 격자 `k / effectiveFps`입니다. FPS 필터의 기본 반올림을 유지하며, 예산이 묶이면 마지막 격자점은 `duration - duration / maxFrames`이므로 그 뒤 영상 끝까지의 구간에는 후보가 없습니다.

| 설정 | 추출 프레임 | 선택 프레임 | 시간 |
|------|-----------|-----------|------|
| `--fps 1` | 18 | 6 | ~5초 |
| `--fps 5` (기본값) | 90 | 20 | ~25초 |
| `--fps 10` | 180 | 20 | ~47초 |

> **팁**: 빠른 미리보기엔 `--fps 1`이 5배 빠릅니다. 프레임 단위 정밀 분석엔 `--fps 10`이 세밀한 전환을 포착합니다.

#### `--scale` — 분석 해상도

file/buffer 추출은 높이를 `scale`에 맞추고, 분석 전처리는 너비를 `scale`에 맞춥니다. 최종 JPEG는 추출 크기를 유지하며, frames 입력의 출력 크기는 입력 크기를 유지합니다. 낮을수록 빠르지만 감지 민감도가 낮아집니다.

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
// Each buffer is a JPEG image
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
  count?: number; // Max frames to keep (default: 20)
  threshold?: number; // Score threshold in range (0, 1] (default: 0.5)
  outputPath?: string; // Output directory (file mode only)
  fps?: number; // Requested FPS, positive decimals allowed (default: 5)
  maxFrames?: number; // Strict file/buffer candidate cap (default: 300)
  scale?: number; // Extraction height / analysis width in px (default: 720)
  quality?: number; // JPEG quality 1-100 (default: 80)
  iouThreshold?: number; // IoU for animation tracking (default: 0.9)
  animationThreshold?: number; // Min frames for animation (default: 5)
  maxSegmentDuration?: number; // Segment duration in seconds (default: 300)
  concurrency?: number; // Parallel segment workers (default: 2)
  sheet?: boolean | SheetOptions; // Contact sheet (default: false)
  includeEdges?: boolean; // Candidate edge diagnostics (default: false)
  debug?: boolean; // Preserve temp workspace (default: false)
  onProgress?: (phase: ProgressPhase, percent: number) => void;
}

type SieveOptions = SieveOptionsBase & SieveInput;
```

지정한 숫자 옵션은 기본값 적용 전에 검증하며, 위반 시 `INVALID_INPUT` 오류로 거부합니다. CLI 숫자 문자열 전체를 검사하므로 `5abc` 같은 값은 허용하지 않습니다. 일반·JSON CLI 실패 종료 코드는 1입니다.

| 옵션 | 허용 범위 |
| --- | --- |
| `count`, `animationThreshold`, `concurrency` | 정수 ≥ 1 |
| `maxFrames` | 정수 ≥ 2 |
| `scale` | 정수 ≥ 16 |
| `quality` | 정수 1–100 |
| `fps`, `maxSegmentDuration` | 유한한 양수 (실수 허용) |
| `threshold` | 유한 (0, 1] |
| `iouThreshold` | 유한 [0, 1] |
| `sheet` | boolean 또는 `SheetOptions`: columns 정수 ≥ 1, tileWidth 정수 ≥ 16, maxTiles 정수 ≥ 2, label boolean. 기본 false; 활성 기본값 4·320·40·true |
| `includeEdges` | boolean, 기본 false |

frames 입력은 모든 이미지의 너비·높이가 같아야 합니다. 빈 배열과 한 장 입력은 허용합니다.

### 결과

```typescript
interface SieveResult {
  success: boolean;
  originalFramesCount: number; // Total frames extracted/provided
  prunedFramesCount: number; // Frames selected as key scenes
  outputFiles: string[]; // File paths (file mode)
  outputBuffers?: Buffer[]; // JPEG buffers (buffer/frames mode)
  animations?: AnimationMetadata[]; // Detected animations
  video?: VideoMetadata; // Video source metadata
  frames?: FrameMetadata[]; // Same one-based frames as the metadata document
  sheet?: SheetMetadata; // Present only when a sheet was rendered
  sheetBuffer?: Buffer; // JPEG sheet in buffer/frames modes only
  executionTimeMs: number;
}
```

`frames[i]`는 `outputBuffers[i]`와 짝지어지며 fileName은 메모리 모드에서도 파일 모드와 같은 이름입니다. API frames[].frameId는 1-based이고 API animations[].startFrameId·endFrameId는 기존대로 0-based입니다. 파일 문서의 animation ID는 1-based입니다.

### 정제 전략

항상 **threshold-with-cap** 전략을 사용합니다. 분포 정규화 점수에 임계값 필터를 적용한 뒤 `count` 상한으로 정제합니다. 생략한 `threshold`는 `0.5`, `count`는 `20`입니다. 최종 개수는 후보와 점수에 따라 상한보다 적을 수 있습니다.

첫/마지막 후보는 항상 보호되므로 후보가 2개 이상이면 `count=1`이어도 둘 다 남습니다. `count`와 `threshold` 단독 전략은 내부 함수로 존재하지만 CLI와 `extractScenes`에서 선택되지 않습니다.

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

file 모드는 선택 JPEG 옆에 v2 `.metadata.json`을 씁니다. 기존 필드의 의미는 유지하며 `metadataVersion`이 없으면 v1로 해석합니다. 패키지는 `SieveMetadata`, `FrameMetadata`, `FrameChange`, `EdgeMetadata`, `EdgeChange`, `ToolMetadata`, `ToolParams`, `SheetMetadata`, `SheetOptions`, `VideoMetadata`, `AnimationMetadata` 타입을 공개합니다.

`tool.name`과 `tool.version`은 실행 중인 패키지를 식별합니다. `tool.params`는 아래 순서의 아홉 필드만 담습니다. params의 fps는 요청값, video의 fps는 유효값입니다. 선택 프레임 캐시는 입력 식별값·도구 버전·params를 기준으로 만듭니다. 전체 출력 번들을 캐시한다면 params에서 빠진 sheet 설정과 includeEdges도 키에 포함해야 합니다.

`SieveResult.video`와 문서는 다음 값을 공유합니다.

- `originalDurationMs`: file/buffer는 ffprobe 원본 길이, frames는 마지막 후보 타임스탬프입니다.
- `fps`: 유효 추출 FPS이며 frames 입력과 애니메이션 tracker는 1을 사용합니다.
- `resolution`: 첫 선택 프레임의 실제 출력 JPEG 크기입니다. 선택이 없으면 첫 후보, 후보도 없으면 0×0입니다.
- `candidatesCount`·`selectedCount`: 가지치기 전·후 프레임 수입니다.
- `source`: 입력 모드와 basename만 담습니다. buffer/frames 입력의 fileName은 null입니다.

`frames[]`에는 1-based step·후보 frameId, 결정적인 fileName, 정수 반올림 timestampMs와 holdsMs가 있습니다. holdsMs는 다음 선택 프레임까지, 마지막 프레임은 원본 끝까지의 밀리초 차이를 0 이상으로 제한한 값입니다. frames 입력의 후보 간격은 1초입니다.

첫 프레임은 `change: null`입니다. 나머지는 직전 선택부터 현재 선택까지 존재하는 모든 인접 후보 간선을 집계합니다.

| 필드 | 의미 |
| --- | --- |
| `fromFrameId` | 직전 선택 후보의 1-based ID |
| `skippedCandidates` | 두 선택 사이에서 제거된 후보 수 |
| `peakScore`·`sumScore` | 가지치기 정규화 전 원시 G(t)의 최댓값·합 |
| `areaRatio` | 전체 비애니메이션 클러스터 bbox의 실제 합집합 면적 / 분석 이미지 면적, [0,1] 제한 |
| `regions` | 출력 픽셀 정수 좌표의 중복 없는 상위 5개 bbox. 면적 내림차순, 동률 y·x·width 오름차순 |

면적은 출력 좌표 반올림 전에 분석 좌표에서 계산합니다. 면적 비율은 절대 bbox 면적 비율이며 특징점 밀도인 G(t), 영상 내 분포에 의존하는 정규화 점수와 구별됩니다. 겹치는 면적은 한 번만 셉니다. regions는 animations[].boundingBox와 같은 축별 환산·정수 반올림·출력 범위 제한을 사용합니다.

애니메이션 제외 기준은 `animationIndices`입니다. 해당 쌍에서 tracker가 애니메이션으로 판정해 G(t)를 감쇠한 클러스터만 제외합니다. 반복을 인식하기 전 관측은 change 영역에 남을 수 있으며 최종 animations 목록에 따른 소급 제거는 하지 않습니다. 실패 쌍은 fallback 점수만 기여하고 상자는 없습니다.

`includeEdges: true`(CLI `--include-edges`)이면 후보 그래프 순서의 edges[]를 덧붙입니다. 필드는 sourceFrameId·targetFrameId(1-based), 원시 score, areaRatio, animatedAreaRatio이며 기본값에서는 키 자체가 없습니다.

`sheet: true` 또는 CLI `--sheet`는 sheet.jpg를 만듭니다. API 기본 설정은 `{ columns: 4, tileWidth: 320, maxTiles: 40, label: true }`이고 부분 객체로 각 값을 덮어쓸 수 있습니다. 타일은 출력 종횡비를 유지하며 흰 배경에 간격·여백 4px로 배치합니다. 라벨은 소수 첫째 자리에서 내림한 `#<frameId> mm:ss.s`입니다. maxTiles를 넘으면 첫·끝 선택을 포함해 균등 샘플링합니다. sheet 메타는 유효 열 수, 타일 크기, 1-based frameIds, sampled를 기록합니다. 파일 반환 순서는 선택 JPEG들, 선택적 sheet.jpg, .metadata.json입니다. buffer/frames 모드는 sheetBuffer를 반환합니다. 비활성 또는 빈 선택에서는 sheet·sheetBuffer 키 자체를 생성하지 않습니다.

문서 키 순서는 고정이며 면적 비율은 소수 4자리, 원시 점수는 6자리로 반올림합니다. JSON은 후행 0을 보존하지 않습니다. 입력 바이트·basename·도구 버전·params·출력 옵션이 같으면 concurrency·출력 디렉터리·실행 시간과 무관하게 문서 바이트가 같습니다. 시트 JPEG 바이트 동일성은 같은 기계·sharp 버전·폰트 환경에서만 보장합니다.

다음 전체 예시는 4초 FFmpeg `testsrc=size=320x240:rate=5` MP4를 아래 명령으로 실행한 실제 결과입니다.

```bash
scene-sieve test_input.mp4 --fps 5 -mf 12 -n 2 -t 0.001 -s 320 --sheet
```

minor changeset 릴리스 전 실행 버전인 0.2.0이 기록되어 있습니다.

```json
{
  "metadataVersion": 2,
  "tool": {
    "name": "@lumy-pack/scene-sieve",
    "version": "0.2.0",
    "params": {
      "fps": 5, "count": 2, "threshold": 0.001, "scale": 320, "quality": 80,
      "maxFrames": 12, "iouThreshold": 0.9, "animationThreshold": 5,
      "maxSegmentDuration": 300
    }
  },
  "video": {
    "originalDurationMs": 4000, "fps": 3,
    "resolution": { "width": 427, "height": 320 },
    "candidatesCount": 12, "selectedCount": 2,
    "source": { "fileName": "test_input.mp4", "mode": "file" }
  },
  "frames": [
    {
      "step": 1, "fileName": "frame_0001.jpg", "frameId": 1,
      "timestampMs": 0, "holdsMs": 3667, "change": null
    },
    {
      "step": 2, "fileName": "frame_0012.jpg", "frameId": 12,
      "timestampMs": 3667, "holdsMs": 333,
      "change": {
        "fromFrameId": 1, "skippedCandidates": 10,
        "peakScore": 0.000833, "sumScore": 0.006784, "areaRatio": 0.1186,
        "regions": [
          { "x": 340, "y": 124, "width": 32, "height": 69 },
          { "x": 32, "y": 240, "width": 64, "height": 32 },
          { "x": 64, "y": 240, "width": 64, "height": 32 },
          { "x": 113, "y": 240, "width": 64, "height": 32 },
          { "x": 145, "y": 240, "width": 64, "height": 32 }
        ]
      }
    }
  ],
  "animations": [],
  "sheet": {
    "fileName": "sheet.jpg", "columns": 2, "tileWidth": 320, "tileHeight": 240,
    "frameIds": [1, 12], "sampled": false
  }
}
```

## 동작 원리

### 파이프라인

scene-sieve는 입력을 5단계 파이프라인을 통해 처리합니다:

1. **Init** — 임시 작업 공간을 생성하고 입력 모드를 해결합니다
2. **Extract** — FFmpeg FPS 격자에서 `maxFrames` 상한 내로 후보를 추출합니다 (`frames` 모드에서 건너뜀)
3. **Analyze** — 각 인접 프레임 쌍에 대해 정보 이득 스코어 G(t)를 계산합니다
4. **Prune** — G(t) 스코어에 threshold-with-cap을 적용하여 프레임을 선택합니다
5. **Finalize** — 기존 출력 디렉터리를 삭제한 뒤 staging을 rename하거나 Buffers를 반환하고 작업 공간을 정리합니다

### 비전 분석

분석기는 4단계를 통해 인접한 프레임 쌍 각각에 스코어를 매깁니다:

1. **AKAZE 특징 차이** — 프레임 단위 전처리·특징점 캐시와 검출기를 재사용하여 새로 나타난 특징점(sNew)만 계산합니다
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
