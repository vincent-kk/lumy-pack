# Scene Sieve — Reference

## Complete Flag Reference

| Flag | Purpose | Type | Default |
|------|---------|------|---------|
| `-n, --count <N>` | Max frames to keep | number | 20 |
| `-t, --threshold <0-1>` | Normalized score cutoff (keep frames above this ratio of max change) | number | 0.5 |
| `-o, --output <path>` | Output directory | string | same as input |
| `--fps <N>` | Max FPS for frame extraction | number | 5 |
| `-mf, --max-frames <N>` | Max frames to extract (auto-reduces FPS for long videos) | number | 300 |
| `-s, --scale <px>` | Scale size for vision analysis | number | 720 |
| `-q, --quality <1-100>` | JPEG output quality | number | 80 |
| `-it, --iou-threshold <0-1>` | IoU threshold for animation tracking | number | 0.9 |
| `-at, --anim-threshold <N>` | Min consecutive frames to classify as animation | number | 5 |
| `--max-segment-duration <sec>` | Max segment duration for long video splitting | number | 300 |
| `--concurrency <N>` | Parallel segment processing count | number | 2 |
| `--debug` | Preserve temp workspace for inspection | boolean | false |
| `--json` | Structured JSON output to stdout | boolean | false |
| `--describe` | Output JSON schema of available options | boolean | false |

### Flag tuning guide

**`-n` vs `-t`** — These control two different pruning strategies:
- `count` only → greedy merge algorithm (min-heap, O(N log N))
- `threshold` only → max-normalized score filter (O(N))
- Both → threshold filter first, then greedy merge on remaining frames

**`--fps`** — Higher values capture fast-paced content but increase processing time. For screen recordings with sparse changes, `--fps 2` is sufficient. For action video, try `--fps 10`.

**`--max-frames`** — Safety cap. For videos longer than `max-frames / fps` seconds, FPS is auto-reduced. Lower this for memory-constrained environments.

**`-s, --scale`** — Vision analysis resolution. Lowering to 480 halves processing time but may miss small UI changes.

**`-it, --iou-threshold`** — Controls how aggressively repeating animation regions are tracked. Lower values (0.7) catch more animations but risk false positives.

**`-at, --anim-threshold`** — Minimum frames a region must repeat to be classified as animation. Raise for content with legitimate repeating elements.

**`--max-segment-duration`** — Long videos are split into segments for parallel processing. Lower values increase parallelism but add segment boundary overhead.

## JSON Output Format

### Success response

```json
{
  "ok": true,
  "command": "extract",
  "data": {
    "success": true,
    "originalFrames": 90,
    "selectedFrames": 5,
    "outputFiles": [
      "/path/to/output/frame_0001.jpg",
      "/path/to/output/frame_0003.jpg",
      "/path/to/output/.metadata.json"
    ],
    "animations": [],
    "video": {
      "originalDurationMs": 19218,
      "fps": 5,
      "resolution": { "width": 720, "height": 405 }
    }
  },
  "meta": { "version": "0.0.13", "durationMs": 24054, "timestamp": "..." }
}
```

### Error response

```json
{
  "ok": false,
  "command": "extract",
  "error": { "code": "FILE_NOT_FOUND", "message": "File not found: /bad/path.mp4" },
  "meta": { ... }
}
```

### Metadata file (`.metadata.json`)

Written alongside output frames:

```json
{
  "video": { "originalDurationMs": 19218, "fps": 5, "resolution": { "width": 720, "height": 405 } },
  "frames": [
    { "step": 1, "fileName": "frame_0001.jpg", "frameId": 1, "timestampMs": 0 },
    { "step": 2, "fileName": "frame_0003.jpg", "frameId": 3, "timestampMs": 432 }
  ],
  "animations": []
}
```

Use `timestampMs` to describe when events happen in the video.

## Pruning Modes

The pruning strategy is auto-selected by `input-resolver.ts` based on which flags are provided:

| Condition | Mode | Algorithm |
|-----------|------|-----------|
| `-n` only | `count` | `pruneTo` — greedy merge via min-heap, O(N log N) |
| `-t` only | `threshold` | `pruneByThreshold` — max-normalized score filter, O(N) |
| Both `-n` and `-t` | `threshold-with-cap` | threshold filter → subgraph rebuild → pruneTo |

First and last frames are always protected (boundary protection) and never pruned.

## Error Codes

| Code | Meaning | Recovery |
|------|---------|----------|
| `FILE_NOT_FOUND` | Input file doesn't exist | Ask the user to verify the file path |
| `INVALID_FORMAT` | Unsupported format or no video stream | Check extension; file may be corrupted or audio-only |
| `INVALID_INPUT` | Bad option values | Check numeric options (quality 1-100, threshold 0-1) |
| `PIPELINE_ERROR` | FFmpeg or OpenCV failure | Retry with `--debug` to preserve temp files, inspect them |
| `WORKER_ERROR` | Worker thread crash | Retry once; try `--max-frames 100` to reduce load |

## Troubleshooting

### "command not found" or npx fails

```bash
npx -y @lumy-pack/scene-sieve --version
```

If this fails, install globally: `npm install -g @lumy-pack/scene-sieve`

### Processing takes too long (>60s)

For long videos (>5 min), reduce workload:

```bash
npx -y @lumy-pack/scene-sieve "<input>" --json -n 10 --fps 2 --max-frames 100 -s 480 -o "<output>" 2>/dev/null
```

### Out of memory

Lower concurrency and scale:

```bash
npx -y @lumy-pack/scene-sieve "<input>" --json -n 10 --concurrency 1 -s 480 -o "<output>" 2>/dev/null
```

### GIF-specific notes

GIFs always use FPS-based extraction (no I-frame detection). For large GIFs, use `--max-frames 50` to limit extraction.

### Describe flag for self-inspection

Use `--describe` to get the JSON schema of all available options:

```bash
npx -y @lumy-pack/scene-sieve --describe
```

Useful for programmatic integration or verifying available flags.
