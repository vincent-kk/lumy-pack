---
name: scene-sieve
version: 0.0.13
complexity: simple
tags: [video, frames, cv, gif, extraction, llm-vision]
description: >
  Extract key frames from video and GIF files using computer vision (AKAZE + DBSCAN).
  Trigger on: "look at a video", "check this recording", "extract frames", "get frames from a GIF",
  "what's in this video/gif", scene detection, video-to-image conversion, screen recording review.
---

# Scene Sieve — Video Frame Extraction for LLMs

CLI tool that extracts visually meaningful key frames from video/GIF using computer vision,
letting you "see" motion media as a sequence of representative still images.

## When to use

- User provides a video or GIF and wants you to understand its contents
- Inspecting screen recordings, demos, or animations
- Extracting screenshots, thumbnails, or key frames
- Any visual comprehension of motion media (.mp4, .mov, .avi, .mkv, .webm, .gif)

## Quick reference

```bash
npx -y @lumy-pack/scene-sieve "<input>" --json -n <count> -o "<output-dir>" 2>/dev/null
```

Always use `--json` for structured output. Add `2>/dev/null` to suppress stderr progress.

### Essential flags

| Flag | Purpose | Default |
|------|---------|---------|
| `-n, --count <N>` | Max frames to keep | 20 |
| `-t, --threshold <0-1>` | Score cutoff | 0.5 |
| `-o, --output <path>` | Output directory | same as input |
| `--fps <N>` | Extraction FPS | 5 |
| `-q, --quality <1-100>` | JPEG quality | 80 |
| `--json` | Structured JSON output | false |

See [reference.md](./reference.md) for all 14 flags including advanced options.

## Workflow

### 1. Probe and select preset

Run the probe script from this skill's directory (`<skill-dir>` = directory containing this SKILL.md):

```bash
"<skill-dir>/scripts/probe.sh" "<input-file>" [intent]
```

The script auto-detects bundled ffprobe, probes duration/resolution, and returns JSON with:
- `probe` — video metadata (duration, resolution, format)
- `preset.name` — matched preset (`short-clip`, `medium-video`, `long-video`, etc.)
- `command` — ready-to-run scene-sieve command with optimal flags

Optional `intent` argument overrides duration-based selection:
`quick-glance` | `detailed` | `hq-capture` | `inspection` | `screen-recording`

See [presets/index.md](./presets/index.md) for the full decision matrix and all 10 preset definitions.

### 2. Prepare workspace

```bash
mkdir -p "$(dirname '<input-file>')/frames"
```

### 3. Run extraction

Use the `command` field from probe output directly, appending `-o`:

```bash
# probe output → "command": "npx -y @lumy-pack/scene-sieve ... -n 12 -t 0.5 ..."
# Append -o and run:
<probe.command> -o "<output-dir>" 2>/dev/null
```

If probe was skipped, fall back to the matching preset file in [presets/](./presets/index.md) for flags.

### 4. Parse output

Check `ok` field first. On success, `data.outputFiles` lists extracted frame paths.
On failure, `error.code` indicates the issue.

See [reference.md § JSON Output Format](./reference.md) for full schema.

### 5. Read frames

Read output images sequentially (`frame_0001.jpg`, `frame_0003.jpg`, ...).
Gaps in numbering are normal — they indicate pruned frames.

Read `.metadata.json` for timestamp mapping (`timestampMs` per frame).

### 6. Analyze and respond

- Describe the frame sequence chronologically
- Note transitions and scene changes between frames
- Reference timestamps when describing events
- Answer the user's specific question based on visual evidence

## Error recovery

| Error code | Action |
|------------|--------|
| `FILE_NOT_FOUND` | Verify file path with user |
| `INVALID_FORMAT` | Check extension; file may be corrupted or audio-only |
| `PIPELINE_ERROR` | Retry with `--debug`; inspect temp files |
| `WORKER_ERROR` | Retry once, or reduce load with `--max-frames 100` |

See [reference.md § Troubleshooting](./reference.md) for detailed recovery steps.

## Resources

- [scripts/probe.sh](./scripts/probe.sh) — Video probe + preset auto-selection script (run before extraction)
- [presets/index.md](./presets/index.md) — Decision matrix and summary table for preset selection
  - [short-clip.md](./presets/short-clip.md) — ≤ 30s clips
  - [medium-video.md](./presets/medium-video.md) — 30s–5min videos
  - [long-video.md](./presets/long-video.md) — 5–30min videos
  - [very-long.md](./presets/very-long.md) — > 30min videos
  - [gif.md](./presets/gif.md) — GIF animations
  - [quick-glance.md](./presets/quick-glance.md) — Fast summary ("대충 봐줘")
  - [detailed.md](./presets/detailed.md) — Thorough analysis ("자세히 분석해줘")
  - [hq-capture.md](./presets/hq-capture.md) — High-quality screenshots ("선명하게 추출")
  - [inspection.md](./presets/inspection.md) — Visual bug detection ("버그 있는지 봐")
  - [screen-recording.md](./presets/screen-recording.md) — UI walkthroughs ("화면 녹화")
- [reference.md](./reference.md) — Complete flag reference (14 flags), JSON output schema, pruning modes, troubleshooting
- [examples.md](./examples.md) — End-to-end workflow recipes and programmatic API usage
