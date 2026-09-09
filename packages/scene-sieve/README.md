# @lumy-pack/scene-sieve

[![npm version](https://img.shields.io/npm/v/@lumy-pack/scene-sieve)](https://www.npmjs.com/package/@lumy-pack/scene-sieve)
[![license](https://img.shields.io/npm/l/@lumy-pack/scene-sieve)](./LICENSE)
[![node](https://img.shields.io/node/v/@lumy-pack/scene-sieve)](https://nodejs.org)

Automatically extract the most meaningful frames from video and GIF files using computer vision.

```
Video/GIF ──▶ Extract (FFmpeg) ──▶ Analyze (OpenCV) ──▶ Prune ──▶ Output
               FPS grid             AKAZE + DBSCAN        MinHeap    JPG / Buffer
```

## Features

- **Animation Tracking** — Detects and records loading spinners or other repetitive animations
- **Rich Metadata** — Generates `.metadata.json` with scene timestamps and animation details
- **Smart frame selection** — Identifies visually significant scene changes, not just evenly-spaced samples
- **Computer vision pipeline** — AKAZE feature detection, DBSCAN clustering, IoU tracking, and information gain scoring
- **Three input modes** — File path, video Buffer, or pre-extracted frame Buffers
- **Flexible pruning** — Filter by a distribution-normalized threshold, then apply a count cap
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
# Extract 20 key scenes (default)
npx scene-sieve input.mp4

# Keep up to 8 scenes
npx scene-sieve input.mp4 -n 8

# Use threshold-based selection
npx scene-sieve input.mp4 -t 0.3

# Specify max frames to extract and output directory
npx scene-sieve input.mp4 -mf 500 -o ./scenes -q 90
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
// Output:
//   scenes/frame_0001.jpg
//   scenes/frame_0002.jpg
//   ...
//   scenes/.metadata.json
```

## CLI Reference

```
scene-sieve <input> [options]
```

| Option                         | Description                                     | Default                      |
| ------------------------------ | ----------------------------------------------- | ---------------------------- |
| `<input>`                      | Input video or GIF file path                    | (required)                   |
| `-n, --count <number>`         | Max number of frames to keep                    | `20`                         |
| `-t, --threshold <number>`     | Normalized score threshold (0, 1]               | `0.5`                        |
| `-o, --output <path>`          | Output directory                                | Same directory as input      |
| `--fps <number>`               | Requested extraction FPS (positive decimals allowed)                    | `5`                          |
| `-mf, --max-frames <number>`   | Strict candidate cap (auto-reduces FPS)        | `300`                        |
| `-s, --scale <number>`         | Extraction height / analysis width (px)             | `720`                        |
| `-q, --quality <number>`       | JPEG output quality (1–100)                     | `80`                         |
| `-it, --iou-threshold <number>`| IoU threshold for animation tracking (0–1)      | `0.9`                        |
| `-at, --anim-threshold <number>`| Min consecutive frames for animation            | `5`                          |
| `--debug`                      | Preserve temp workspace for inspection          | `false`                      |

### Supported Formats

| Type      | Extensions                              |
| --------- | --------------------------------------- |
| Video     | `.mp4`, `.mov`, `.avi`, `.mkv`, `.webm` |
| Animation | `.gif`                                  |

### Parameter Tuning Guide

Not sure where to start? Here's how each parameter affects the output, based on real benchmarks with a ~19s screen recording (MOV) and a GIF animation.

#### `--count` — How many frames to keep

| Setting | Extracted | Selected | Notes |
|---------|-----------|----------|-------|
| `-n 3` | 90 | 3 | First and last frames are always preserved (boundary protection) |
| `-n 10` | 90 | 10 | Good for short summaries |
| `-n 20` (default) | 90 | 20 | Balanced for most videos |
| `-n 50` | 90 | 22 | Only 22 frames passed the score threshold — count above actual scenes has no effect |

#### `--threshold` — Minimum score to keep a frame

Higher values mean stricter filtering and fewer frames. Scores are normalized against the positive-score distribution within the video: min-max for up to 10 positive scores, otherwise a blend of median/MAD-based logistic scores and percentile ranks. `0.5` is neither an absolute change level nor half the maximum score.

| Setting | Selected | Notes |
|---------|----------|-------|
| `-t 0.1` | 20 | Very permissive — most scene changes pass |
| `-t 0.3` | 20 | Still permissive for screen recordings |
| `-t 0.5` (default) | 20 | Capped by the default count of 20 |
| `-t 0.7` | 19 | Starts filtering subtle changes |
| `-t 0.9` | 12 | Only major scene transitions survive |

> **Tip**: Using `-t` alone still applies the default `count=20` cap. Adjust it with `-n` (e.g., `-t 0.3 -n 10`).

#### `--fps` and `--max-frames` — Extraction density

These control how many frames are pulled from the video before analysis. More frames = more precision but longer processing.

File/buffer candidates obey the strict `maxFrames` cap (integer ≥ 2). Effective FPS is `min(fps, maxFrames / duration)`, with no 0.5 FPS floor. Positive decimals such as `--fps 0.5` are accepted. A one-hour video with a 300-frame budget is sampled at about 0.083 FPS (every 12 seconds). This cap does not apply to frames input.

Timestamps describe the FFmpeg output grid `k / effectiveFps`, rather than the original source frame PTS. The FPS filter keeps its default rounding. When the budget binds, the last grid point is `duration - duration / maxFrames`, leaving no candidate in the remaining interval to the end.

| Setting | Extracted | Selected | Time |
|---------|-----------|----------|------|
| `--fps 1` | 18 | 6 | ~5s |
| `--fps 5` (default) | 90 | 20 | ~25s |
| `--fps 10` | 180 | 20 | ~47s |

> **Tip**: For quick previews, `--fps 1` is 5x faster. For frame-accurate analysis, `--fps 10` captures finer transitions.

#### `--scale` — Analysis resolution

File/buffer extraction scales height to `scale`, while analysis preprocessing scales width to `scale`. Final JPEGs retain extraction dimensions; frames input retains its input dimensions in the output. Lower values are faster but less sensitive.

| Setting | Selected | Time | Output Size |
|---------|----------|------|-------------|
| `-s 360` | 7 | ~6s | 72 KB |
| `-s 720` (default) | 20 | ~25s | 634 KB |
| `-s 1080` | 20 | ~54s | 1,172 KB |

> **Tip**: `360` is good for quick scans. `720` provides the best speed/quality balance. `1080` is only needed when detecting very subtle UI changes.

#### `--iou-threshold` and `--anim-threshold` — Animation sensitivity

These control how aggressively repeating animations (spinners, blinking cursors) are detected and suppressed.

| Setting | Animations Detected | Notes |
|---------|-------------------|-------|
| `-it 0.5 -at 3` | 7 (MOV), 4 (GIF) | Sensitive — catches most repeating motion |
| `-it 0.9 -at 5` (default) | 0 | Conservative — only obvious loops |
| `-it 0.95 -at 10` | 0 | Very conservative |

> **Tip**: If your video has loading spinners or repeated UI animations, try `-it 0.5 -at 3` to suppress them.

#### `--quality` — Output JPEG quality

Only affects file size, **not** scene detection. The same frames are selected regardless of quality.

| Setting | File Size (5 frames) |
|---------|---------------------|
| `-q 30` | 62 KB |
| `-q 80` (default) | 151 KB |
| `-q 100` | 407 KB |

### Recommended Presets

```bash
# Quick preview — fast, rough selection
scene-sieve input.mp4 --fps 1 -s 360 -n 10

# Balanced (default) — good for most use cases
scene-sieve input.mp4

# High precision — catches subtle transitions
scene-sieve input.mp4 --fps 10 -s 1080 -t 0.3

# UI recording — suppress animations, keep key states
scene-sieve recording.mov -it 0.5 -at 3 -t 0.3 -n 15

# Minimal summary — just the major scenes
scene-sieve input.mp4 -t 0.9 -n 5
```

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
// ['./output/frame_0001.jpg', './output/frame_0002.jpg', ..., './output/.metadata.json']
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
  debug?: boolean; // Preserve temp workspace (default: false)
  onProgress?: (phase: ProgressPhase, percent: number) => void;
}

type SieveOptions = SieveOptionsBase & SieveInput;
```

Supplied numeric options are validated before defaults; invalid values produce `INVALID_INPUT`. CLI numeric strings are checked in full, so values such as `5abc` are rejected. Both interactive and JSON CLI failures exit with code 1.

| Option | Allowed range |
| --- | --- |
| `count`, `animationThreshold`, `concurrency` | Integer ≥ 1 |
| `maxFrames` | Integer ≥ 2 |
| `scale` | Integer ≥ 16 |
| `quality` | Integer 1–100 |
| `fps`, `maxSegmentDuration` | Finite positive number (decimals allowed) |
| `threshold` | Finite (0, 1] |
| `iouThreshold` | Finite [0, 1] |

All images in frames input must share the same width and height. Empty arrays and single images are accepted.

### Result

```typescript
interface SieveResult {
  success: boolean;
  originalFramesCount: number; // Total frames extracted/provided
  prunedFramesCount: number; // Frames selected as key scenes
  outputFiles: string[]; // File paths (file mode)
  outputBuffers?: Buffer[]; // JPEG buffers (buffer/frames mode)
  animations?: AnimationMetadata[]; // Detected animations
  video?: VideoMetadata; // Video source metadata
  executionTimeMs: number;
}
```

### Pruning Strategies

The pipeline always uses **threshold-with-cap**: filter by distribution-normalized score, then prune to the `count` cap. Omitted `threshold` and `count` default to `0.5` and `20`. The selected count may be lower depending on candidates and scores.

The first and last candidates are protected, so both remain when `count=1` and at least two candidates exist. Standalone count and threshold strategies exist as internal functions but are not selected by the CLI or `extractScenes`.

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

## Output Metadata

When running in `file` mode, `scene-sieve` generates a `.metadata.json` file in the output directory.

`SieveResult.video` and file metadata use the same values:

- `originalDurationMs`: ffprobe source duration for file/buffer; the last candidate timestamp for frames input.
- `fps`: effective extraction FPS, rather than the requested value. Frames input uses 1, also used by animation tracking.
- `resolution`: actual output JPEG dimensions of the first selected frame, falling back to the first candidate or 0×0 when empty.
- `frames[].timestampMs`: extraction-grid time in milliseconds; frames input uses one-second intervals.
- `animations[].boundingBox`: output-image pixel coordinates, scaled independently on each axis from analysis coordinates, rounded to integers, and clamped to the output bounds. File frame IDs are 1-based; API animation IDs are 0-based.

```json
{
  "video": {
    "originalDurationMs": 15000,
    "fps": 5,
    "resolution": { "width": 1280, "height": 720 }
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

## How It Works

### Pipeline

scene-sieve processes input through a 5-stage pipeline:

1. **Init** — Creates a temporary workspace and resolves input mode
2. **Extract** — Pulls candidates on an FFmpeg FPS grid within the strict `maxFrames` cap (skipped in `frames` mode)
3. **Analyze** — Computes an information gain score G(t) for each adjacent frame pair
4. **Prune** — Selects frames from G(t) scores using threshold-with-cap
5. **Finalize** — Deletes existing output before renaming staging, or returns Buffers; cleans up workspace

### Vision Analysis

The analyzer scores each pair of adjacent frames through 4 stages:

1. **AKAZE Feature Diff** — Reuses per-frame preprocessing/features and the detector to compute newly appeared points (sNew only)
2. **DBSCAN Clustering** — Groups new feature points into spatial clusters
3. **IoU Tracking** — Tracks cluster bounding boxes across time; identifies and records repeated animation regions (e.g. loading spinners)
4. **G(t) Scoring** — Calculates information gain from cluster area ratio and feature density, discounting animated areas to focus on unique scene content

Frames with higher G(t) scores represent greater visual change and are preserved during pruning.

## Requirements

- **Node.js** >= 20
- **FFmpeg**: Bundled via `ffmpeg-static` — no system installation needed
- **OpenCV**: Bundled as WASM via `@techstark/opencv-js` — no native build needed
- **sharp**: Requires native binaries. Pre-built binaries are automatically downloaded for most platforms. See the [sharp installation guide](https://sharp.pixelplumbing.com/install) if you encounter build issues.

## License

[MIT](./LICENSE)
