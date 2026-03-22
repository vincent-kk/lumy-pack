# Scene Sieve — Workflow Examples

## Quick overview: "What's in this video?"

The most common pattern — user provides a video and wants a summary.

```bash
# 1. Prepare workspace
mkdir -p "$(dirname '/path/to/video.mp4')/frames"

# 2. Extract 10 representative frames
npx -y @lumy-pack/scene-sieve "/path/to/video.mp4" --json -n 10 -o "$(dirname '/path/to/video.mp4')/frames" 2>/dev/null

# 3. Parse JSON → read each frame_*.jpg → describe chronologically
```

**When to adjust:** If the video is short (<10s), use `-n 5`. If it's a detailed tutorial, use `-n 15`.

---

## Screen recording review

Optimized for UI walkthroughs where changes are sparse.

```bash
mkdir -p /tmp/recording-frames
npx -y @lumy-pack/scene-sieve "/path/to/recording.mp4" --json -n 12 --fps 2 -o /tmp/recording-frames 2>/dev/null
```

**Key flags:** `--fps 2` because screen recordings have long static periods. `-n 12` captures enough UI state transitions.

**Follow-up:** Read `.metadata.json` to map each frame to a timestamp, then describe the user's actions step by step.

---

## GIF animation inspection

For checking GIF animations for visual bugs or understanding animation sequences.

```bash
mkdir -p /tmp/gif-frames
npx -y @lumy-pack/scene-sieve "/path/to/animation.gif" --json -n 15 -t 0.2 -o /tmp/gif-frames 2>/dev/null
```

**Key flags:** `-t 0.2` (low threshold) captures subtle frame differences that would be pruned at the default 0.5.

**Note:** GIFs always use FPS-based extraction. For large GIFs, add `--max-frames 50`.

---

## Long video (>5 min)

Optimized extraction for meetings, lectures, or lengthy recordings.

```bash
mkdir -p /tmp/meeting-frames
npx -y @lumy-pack/scene-sieve "/path/to/meeting.mp4" \
  --json -n 20 --fps 1 --max-frames 200 -s 480 \
  -o /tmp/meeting-frames 2>/dev/null
```

**Key flags:**
- `--fps 1` — one frame per second is enough for slow-paced content
- `--max-frames 200` — caps total extraction to prevent memory issues
- `-s 480` — lower analysis resolution for speed

**For very long videos (>30 min):** Also add `--concurrency 1` to reduce memory pressure.

---

## High-fidelity frame extraction

When the user needs detailed, high-quality frames (e.g., for documentation screenshots).

```bash
mkdir -p /tmp/hq-frames
npx -y @lumy-pack/scene-sieve "/path/to/demo.mp4" --json -n 5 -q 95 -s 1080 -o /tmp/hq-frames 2>/dev/null
```

**Key flags:** `-q 95` for near-lossless JPEG. `-s 1080` for higher analysis resolution (preserves detail).

---

## Maximum coverage analysis

When you need to capture every meaningful change (e.g., debugging frame-by-frame).

```bash
mkdir -p /tmp/full-analysis
npx -y @lumy-pack/scene-sieve "/path/to/clip.mp4" \
  --json -n 50 -t 0.2 --fps 10 \
  -o /tmp/full-analysis 2>/dev/null
```

**Key flags:** High frame count + low threshold + high FPS for comprehensive extraction.

**Warning:** This produces many frames. Only use for short clips (<30s) to avoid overwhelming the context.

---

## Animation-heavy video

Videos with repeating animations (loading spinners, carousels) that should be de-emphasized.

```bash
npx -y @lumy-pack/scene-sieve "/path/to/ui-demo.mp4" \
  --json -n 10 -it 0.7 -at 3 \
  -o /tmp/ui-frames 2>/dev/null
```

**Key flags:**
- `-it 0.7` — lower IoU threshold catches more animation regions
- `-at 3` — fewer consecutive frames needed to classify as animation

This prevents the output from being dominated by repeating animation frames.

---

## Programmatic API (Node.js)

For integration into scripts or pipelines without CLI:

```typescript
import { sieve } from '@lumy-pack/scene-sieve';

// File mode — outputs to disk
const result = await sieve({
  mode: 'file',
  input: '/path/to/video.mp4',
  output: '/tmp/frames',
  count: 10,
  json: true,
});

// Buffer mode — returns Buffer[]
const bufferResult = await sieve({
  mode: 'buffer',
  input: videoBuffer,
  count: 8,
});

// Frames mode — skip FFmpeg, analyze pre-extracted frames
const framesResult = await sieve({
  mode: 'frames',
  input: frameBuffers, // Buffer[]
  count: 5,
});
```

**Three input modes:**

| Mode | Input | Output | FFmpeg |
|------|-------|--------|--------|
| `file` | File path | JPGs on disk | Yes |
| `buffer` | `Buffer` | `Buffer[]` | Yes (via temp file) |
| `frames` | `Buffer[]` | `Buffer[]` | No (direct analysis) |
