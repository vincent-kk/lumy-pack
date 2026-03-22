# Preset: long-video

Videos 5–30min. Lower FPS and scale for speed.

## When to use

- Meetings, lectures, webinars, long tutorials
- Duration-based auto-selection: 5–30min

## Flags

| Flag | Value | Reasoning |
|------|-------|-----------|
| `-n` | 15 | More frames for longer content |
| `-t` | 0.5 | Default threshold |
| `--fps` | 2 | Reduced to avoid excessive extraction |
| `--max-frames` | 200 | Lower cap to bound processing time |
| `-s` | 480 | Reduced resolution for faster analysis |
| `-q` | 80 | Default quality |

## Command

```bash
npx @lumy-pack/scene-sieve "<input>" --json \
  -n 15 --fps 2 --max-frames 200 -s 480 \
  -o "<output-dir>" 2>/dev/null
```
