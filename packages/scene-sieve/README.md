# @lumy-pack/scene-sieve

[![npm version](https://img.shields.io/npm/v/@lumy-pack/scene-sieve)](https://www.npmjs.com/package/@lumy-pack/scene-sieve)
[![license](https://img.shields.io/npm/l/@lumy-pack/scene-sieve)](./LICENSE)
[![node](https://img.shields.io/node/v/@lumy-pack/scene-sieve)](https://nodejs.org)

Automatically extract the most meaningful frames from video and GIF files using computer vision.

```
Video/GIF ──▶ Extract (FFmpeg) ──▶ Analyze (OpenCV) ──▶ Prune ──▶ Output
               I-frames / FPS       AKAZE + DBSCAN        MinHeap    JPG / Buffer
```

## Features

- **Smart frame selection** — Identifies visually significant scene changes, not just evenly-spaced samples
- **Computer vision pipeline** — AKAZE feature detection, DBSCAN clustering, IoU tracking, and information gain scoring
- **Three input modes** — File path, video Buffer, or pre-extracted frame Buffers
- **Flexible pruning** — Keep a fixed count, filter by threshold, or combine both
- **Bundled FFmpeg** — No system-level FFmpeg installation required
- **Dual output** — ESM and CommonJS compatible
- **Progress callbacks** — Track extraction progress in real time
- **JPEG quality control** — Configurable output quality with mozjpeg optimization

## Installation

```bash
npm install @lumy-pack/scene-sieve
# or
yarn add @lumy-pack/scene-sieve
```

## Quick Start

### CLI

```bash
# Extract 5 key scenes (default)
npx scene-sieve input.mp4

# Keep exactly 8 scenes
npx scene-sieve input.mp4 -n 8

# Use threshold-based selection
npx scene-sieve input.mp4 -t 0.3

# Specify output directory and JPEG quality
npx scene-sieve input.mp4 -n 10 -o ./scenes -q 90
```

### Module

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

## CLI Reference

```
scene-sieve <input> [options]
```

| Option                     | Description                            | Default                     |
| -------------------------- | -------------------------------------- | --------------------------- |
| `<input>`                  | Input video or GIF file path           | (required)                  |
| `-n, --count <number>`     | Number of frames to keep               | `5` (when no `--threshold`) |
| `-t, --threshold <number>` | Normalized score threshold (0, 1]      | —                           |
| `-o, --output <path>`      | Output directory                       | Same directory as input     |
| `--fps <number>`           | Fallback FPS for frame extraction      | `5`                         |
| `-s, --scale <number>`     | Scale size for vision analysis (px)    | `720`                       |
| `-q, --quality <number>`   | JPEG output quality (1–100)            | `80`                        |
| `--debug`                  | Preserve temp workspace for inspection | `false`                     |

### Supported Formats

| Type      | Extensions                              |
| --------- | --------------------------------------- |
| Video     | `.mp4`, `.mov`, `.avi`, `.mkv`, `.webm` |
| Animation | `.gif`                                  |

### Examples

```bash
# Extract from a GIF
scene-sieve animation.gif -n 4 -o ./keyframes

# High-quality output with threshold filtering
scene-sieve demo.mov -t 0.2 -q 95

# Combine threshold + count cap
scene-sieve long-video.mp4 -t 0.15 -n 20

# Debug mode: keep temp files for inspection
scene-sieve input.mp4 --debug
```

## API Reference

### `extractScenes(options)`

Extracts key frames from a video, GIF, or pre-extracted frame buffers.

```typescript
function extractScenes(options: SieveOptions): Promise<SieveResult>;
```

### Input Modes

The `mode` field determines how input is provided and what output is returned.

#### File Mode

Reads a video/GIF from disk, writes JPEG files to the output directory.

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

#### Buffer Mode

Accepts a video as a Node.js Buffer, returns frame Buffers. Useful for stream processing or serverless environments.

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

#### Frames Mode

Accepts pre-extracted frame images as Buffers. **Does not require FFmpeg.** Useful when frames are already available from another source.

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

### Options

```typescript
interface SieveOptionsBase {
  count?: number; // Frames to keep (default: 5 when no threshold)
  threshold?: number; // Score threshold in range (0, 1]
  outputPath?: string; // Output directory (file mode only)
  fps?: number; // Extraction FPS (default: 5)
  scale?: number; // Analysis scale in px (default: 720)
  quality?: number; // JPEG quality 1-100 (default: 80)
  debug?: boolean; // Preserve temp workspace (default: false)
  onProgress?: (phase: ProgressPhase, percent: number) => void;
}

type SieveOptions = SieveOptionsBase & SieveInput;
```

### Result

```typescript
interface SieveResult {
  success: boolean;
  originalFramesCount: number; // Total frames extracted/provided
  prunedFramesCount: number; // Frames selected as key scenes
  outputFiles: string[]; // File paths (file mode)
  outputBuffers?: Buffer[]; // JPEG buffers (buffer/frames mode)
  executionTimeMs: number;
}
```

### Pruning Strategies

The pruning strategy is automatically selected based on which options are provided:

| Options                    | Strategy               | Behavior                                                         |
| -------------------------- | ---------------------- | ---------------------------------------------------------------- |
| `count` only               | **count**              | Greedy merge — removes lowest-scored frames until `count` remain |
| `threshold` only           | **threshold**          | Keeps frames with normalized score >= `threshold`                |
| Both `count` + `threshold` | **threshold-with-cap** | Applies threshold filter first, then caps at `count`             |

### Progress Tracking

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

## How It Works

### Pipeline

scene-sieve processes input through a 5-stage pipeline:

1. **Init** — Creates a temporary workspace and resolves input mode
2. **Extract** — Pulls frames via FFmpeg (I-frame priority, FPS fallback; skipped in `frames` mode)
3. **Analyze** — Computes an information gain score G(t) for each adjacent frame pair
4. **Prune** — Selects frames based on G(t) scores using the chosen pruning strategy
5. **Finalize** — Writes output files (atomic rename) or returns Buffers; cleans up workspace

### Vision Analysis

The analyzer scores each pair of adjacent frames through 4 stages:

1. **AKAZE Feature Diff** — Detects and matches keypoints between frames; identifies newly appeared and disappeared features
2. **DBSCAN Clustering** — Groups new feature points into spatial clusters
3. **IoU Tracking** — Tracks cluster bounding boxes across time; applies decay to repeated animation regions
4. **G(t) Scoring** — Calculates information gain from cluster area ratio and feature density, discounting animated areas

Frames with higher G(t) scores represent greater visual change and are preserved during pruning.

## Requirements

- **Node.js** >= 20
- **FFmpeg**: Bundled via `ffmpeg-static` — no system installation needed
- **OpenCV**: Bundled as WASM via `@techstark/opencv-js` — no native build needed
- **sharp**: Requires native binaries. Pre-built binaries are automatically downloaded for most platforms. See the [sharp installation guide](https://sharp.pixelplumbing.com/install) if you encounter build issues.

## License

[MIT](./LICENSE)
