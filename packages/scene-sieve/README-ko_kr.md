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
# 기본값인 5개의 주요 장면 추출
npx scene-sieve input.mp4

# 정확히 8개의 장면 유지
npx scene-sieve input.mp4 -n 8

# 임계값 기반 선택 사용
npx scene-sieve input.mp4 -t 0.3

# 출력 디렉토리 및 JPEG 품질 지정
npx scene-sieve input.mp4 -n 10 -o ./scenes -q 90
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
// Output: scenes/scene_001.jpg, scenes/scene_002.jpg, ...
```

## CLI 레퍼런스

```
scene-sieve <input> [options]
```

| 옵션                       | 설명                               | 기본값                      |
| -------------------------- | ---------------------------------- | --------------------------- |
| `<input>`                  | 입력 비디오 또는 GIF 파일 경로     | (필수)                      |
| `-n, --count <number>`     | 유지할 프레임 개수                 | `5` (임계값 미지정 시)      |
| `-t, --threshold <number>` | 정규화된 스코어 임계값 (0, 1]     | —                           |
| `-o, --output <path>`      | 출력 디렉토리                      | 입력과 동일한 디렉토리      |
| `--fps <number>`           | 프레임 추출 fallback FPS           | `5`                         |
| `-s, --scale <number>`     | 비전 분석용 스케일 크기 (px)       | `720`                       |
| `-q, --quality <number>`   | JPEG 출력 품질 (1–100)             | `80`                        |
| `--debug`                  | 검사용 임시 작업 공간 유지         | `false`                     |

### 지원 형식

| 유형   | 확장자                              |
| ------ | ----------------------------------- |
| 비디오 | `.mp4`, `.mov`, `.avi`, `.mkv`, `.webm` |
| 애니메이션 | `.gif`                              |

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
// ['./output/scene_001.jpg', './output/scene_002.jpg', ...]
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
  count?: number; // 유지할 프레임 개수 (기본값: 임계값 미지정 시 5)
  threshold?: number; // 범위 (0, 1]에서의 스코어 임계값
  outputPath?: string; // 출력 디렉토리 (파일 모드만 해당)
  fps?: number; // 추출 FPS (기본값: 5)
  scale?: number; // 분석용 스케일 (px) (기본값: 720)
  quality?: number; // JPEG 품질 1-100 (기본값: 80)
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
3. **IoU 추적** — 클러스터 경계 상자를 시간에 따라 추적합니다; 반복된 애니메이션 영역에 감쇠를 적용합니다
4. **G(t) 스코어링** — 클러스터 면적 비율 및 특징 밀도로부터 정보 이득을 계산하여 애니메이션 영역을 할인합니다

G(t) 스코어가 높은 프레임은 더 큰 시각적 변화를 나타내므로 정제 중에 보존됩니다.

## 요구 사항

- **Node.js** >= 20
- **FFmpeg**: `ffmpeg-static`를 통해 번들됨 — 시스템 설치가 필요하지 않습니다
- **OpenCV**: `@techstark/opencv-js`를 통해 WASM으로 번들됨 — 네이티브 빌드가 필요하지 않습니다
- **sharp**: 네이티브 바이너리가 필요합니다. 대부분의 플랫폼에 대해 사전 빌드된 바이너리가 자동으로 다운로드됩니다. 빌드 문제가 발생하면 [sharp 설치 가이드](https://sharp.pixelplumbing.com/install)를 참고하세요.

## 라이선스

[MIT](./LICENSE)
