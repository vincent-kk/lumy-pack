# Preset: medium-video

Videos 30s–5min. Balanced defaults work well.

## When to use

- Product demos, tutorial clips, social media videos
- Duration-based auto-selection: 30s–5min

## Flags

| Flag | Value | Reasoning |
|------|-------|-----------|
| `-n` | 12 | Good coverage for medium-length content |
| `-t` | 0.5 | Default threshold |
| `--fps` | 5 | Default extraction rate |
| `--max-frames` | 300 | Default cap |
| `-s` | 720 | Default analysis resolution |
| `-q` | 80 | Default quality |

## Command

```bash
npx @lumy-pack/scene-sieve "<input>" --json \
  -n 12 \
  -o "<output-dir>" 2>/dev/null
```
