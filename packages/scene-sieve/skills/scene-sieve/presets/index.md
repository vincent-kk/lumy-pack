# Presets — Decision Matrix

## Auto-selection via script

```bash
node scripts/probe.mjs "<input-file>" [intent]
```

The script probes the video and returns the matched preset + ready-to-run command as JSON.
Cross-platform (macOS, Linux, Windows) — requires only Node.js.

## Duration-based selection

Match top-to-bottom. First matching row wins.

| Condition | Preset file | Reasoning |
|-----------|-------------|-----------|
| Extension `.gif` | `gif.md` | No I-frame; FPS-only extraction |
| Duration ≤ 30s | `short-clip.md` | Few frames needed; full quality ok |
| Duration ≤ 5min | `medium-video.md` | Balanced defaults |
| Duration ≤ 30min | `long-video.md` | Reduce FPS and scale for performance |
| Duration > 30min | `very-long.md` | Aggressive caps to prevent timeout/OOM |

## Intent overrides

If the user's intent is clear, override the duration-based preset:

| User intent | Preset file | Trigger examples |
|-------------|-------------|------------------|
| Quick glance / summary | `quick-glance.md` | "이 영상 뭔지 봐줘", "대충 뭔 내용인지" |
| Detailed analysis | `detailed.md` | "프레임 하나하나 봐줘", "자세히 분석해줘" |
| High-quality screenshots | `hq-capture.md` | "스크린샷 뽑아줘", "선명하게 추출" |
| Bug/visual inspection | `inspection.md` | "버그 있는지 봐", "깜빡이는 부분 찾아줘" |
| Screen recording | `screen-recording.md` | "화면 녹화", "recording" |

## Fallback (no ffprobe)

Use file size as proxy:

| File size | Estimated duration | Preset |
|-----------|--------------------|--------|
| < 5 MB | Short clip | `short-clip.md` |
| 5–50 MB | Medium | `medium-video.md` |
| 50–500 MB | Long | `long-video.md` |
| > 500 MB | Very long | `very-long.md` |

## Summary table

| Preset | `-n` | `-t` | `--fps` | `--max-frames` | `-s` | `-q` | Other |
|--------|------|------|---------|----------------|------|------|-------|
| short-clip | 8 | 0.5 | 5 | 300 | 720 | 85 | — |
| medium-video | 12 | 0.5 | 5 | 300 | 720 | 80 | — |
| long-video | 15 | 0.5 | 2 | 200 | 480 | 80 | — |
| very-long | 20 | 0.5 | 1 | 150 | 480 | 80 | `--concurrency 1` |
| gif | 10 | 0.3 | 5 | 50 | 720 | 80 | — |
| quick-glance | 5 | 0.5 | 2 | 300 | 480 | 80 | — |
| detailed | 30 | 0.2 | 10 | 300 | 720 | 80 | — |
| hq-capture | 8 | 0.5 | 5 | 300 | 1080 | 95 | — |
| inspection | 20 | 0.15 | 5 | 300 | 720 | 80 | `-it 0.7 -at 3` |
| screen-recording | 12 | 0.3 | 2 | 300 | 720 | 80 | — |
