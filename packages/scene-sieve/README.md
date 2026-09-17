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
- **Change signals and contact sheets** — Metadata v2 records regions, raw scores and holds, with an optional `sheet.jpg` overview
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
| `--sheet` | Generate a selected-frame contact sheet | `false` |
| `--include-edges` | Include candidate edge diagnostics in metadata | `false` |

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
  sheet?: boolean | SheetOptions; // Contact sheet (default: false)
  includeEdges?: boolean; // Candidate edge diagnostics (default: false)
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
| `sheet` | Boolean or `SheetOptions`: columns integer ≥ 1, tileWidth integer ≥ 16, maxTiles integer ≥ 2, label boolean. Default false; enabled defaults 4, 320, 40, true |
| `includeEdges` | Boolean, default false |

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
  frames?: FrameMetadata[]; // Same one-based frames as the metadata document
  sheet?: SheetMetadata; // Present only when a sheet was rendered
  sheetBuffer?: Buffer; // JPEG sheet in buffer/frames modes only
  executionTimeMs: number;
}
```

`frames[i]` pairs with `outputBuffers[i]`; fileName remains the same deterministic file-mode label for in-memory output. API frames[].frameId is one-based, while API animations[].startFrameId and endFrameId remain zero-based. Document animation IDs are one-based.

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

File mode writes a v2 `.metadata.json` beside the selected JPEGs. Existing fields retain their meaning; treat a document without `metadataVersion` as v1. The package exports `SieveMetadata`, `FrameMetadata`, `FrameChange`, `EdgeMetadata`, `EdgeChange`, `ToolMetadata`, `ToolParams`, `SheetMetadata`, `SheetOptions`, `VideoMetadata` and `AnimationMetadata`.

`tool.name` and `tool.version` identify the runtime package. `tool.params` contains exactly nine fields in the order shown below. Its `fps` is the requested value; `video.fps` is the effective value. Cache selected frames using input identity, tool version and these params. Include sheet settings and `includeEdges` when caching complete output bundles, because those output options are excluded from params.

`SieveResult.video` and the document share these values:

- `originalDurationMs`: ffprobe duration for file/buffer, or the last candidate timestamp for frames input.
- `fps`: effective sampling frequency; frames input and its animation tracker use 1.
- `resolution`: actual output JPEG size of the first selection, falling back to the first candidate or 0×0.
- `candidatesCount` and `selectedCount`: counts before and after pruning.
- `source`: input mode and basename only; `fileName` is null for buffer/frames input.

Each `frames[]` entry has a one-based step and candidate ID, a deterministic `fileName`, rounded `timestampMs`, and `holdsMs`: time until the next selected frame, or until the source end for the last frame, clamped to zero. Frames input uses one-second candidate intervals.

The first frame has `change: null`. Later entries aggregate every available adjacent candidate edge from the previous selection to this one:

| Field | Meaning |
| --- | --- |
| `fromFrameId` | Previous selected candidate ID, one-based |
| `skippedCandidates` | Pruned candidates between the selections |
| `peakScore`, `sumScore` | Maximum and sum of raw G(t), before pruning normalization |
| `areaRatio` | Exact union area of all non-animation cluster boxes divided by analysis image area, clamped to [0,1] |
| `regions` | Up to five distinct largest boxes in integer output pixels, sorted by area descending, then y, x and width ascending |

Area is computed in analysis coordinates before output rounding. It is an absolute box-area fraction, distinct from both feature-density G(t) and video-relative normalized pruning scores. Overlapping boxes contribute only once. Region boxes use the same axis-specific scaling, rounding and clamping as `animations[].boundingBox`.

Animation exclusion follows `animationIndices`: exactly the clusters the tracker classified as animation and discounted in G(t) for that pair. Earlier observations can remain in change regions before the tracker recognizes repetition; there is no retrospective removal based on the final animation list. Failed pairs contribute their fallback score without boxes.

`includeEdges: true` (CLI `--include-edges`) appends `edges[]` in candidate graph order with `sourceFrameId`, `targetFrameId` (one-based), raw `score`, `areaRatio` and `animatedAreaRatio`. The key is absent by default.

Use `sheet: true` or CLI `--sheet` for `sheet.jpg`. API defaults are `{ columns: 4, tileWidth: 320, maxTiles: 40, label: true }`; partial objects override individual fields. Tiles preserve the output aspect ratio with a white background and 4px gaps/margins. Labels read `#<frameId> mm:ss.s` with tenths truncated. Excess tiles are sampled uniformly, always including the first and last selection. `sheet` records the effective columns, tile dimensions, one-based tile `frameIds` and `sampled`. File output order is frame JPEGs, optional sheet, then metadata. Buffer/frames mode returns `sheetBuffer`; absent or empty sheets create neither `sheet` nor `sheetBuffer` keys.

Metadata keys have a fixed order. Area ratios round to four decimals; raw scores round to six. Trailing zeroes are not preserved by JSON. Identical input bytes, basename, tool version, params and output options produce identical metadata bytes regardless of concurrency, output directory or execution time. Sheet JPEG determinism is limited to the same machine, sharp version and font environment.

The following complete example was generated from a four-second FFmpeg `testsrc=size=320x240:rate=5` MP4 using:

```bash
scene-sieve test_input.mp4 --fps 5 -mf 12 -n 2 -t 0.001 -s 320 --sheet
```

The runtime version is 0.2.0 before the minor changeset is released; these values come from an actual run.

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

- **Node.js** 20.19+ (20.x) or >= 22.12
- **FFmpeg**: Bundled via `ffmpeg-static` — no system installation needed
- **OpenCV**: Bundled as WASM via `@techstark/opencv-js` — no native build needed
- **sharp**: Requires native binaries. Pre-built binaries are automatically downloaded for most platforms. See the [sharp installation guide](https://sharp.pixelplumbing.com/install) if you encounter build issues.

## License

[MIT](./LICENSE)
