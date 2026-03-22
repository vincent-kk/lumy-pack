# Preset: short-clip

Clips ≤ 30 seconds. Full resolution, moderate frame count.

## When to use

- Short demos, quick interactions, brief screen recordings
- Duration-based auto-selection: ≤ 30s

## Flags

| Flag | Value | Reasoning |
|------|-------|-----------|
| `-n` | 8 | Enough for scene coverage without redundancy |
| `-t` | 0.5 | Default threshold |
| `--fps` | 5 | Default; short clips don't need reduction |
| `--max-frames` | 300 | Default cap (won't hit for short clips) |
| `-s` | 720 | Default analysis resolution |
| `-q` | 85 | Slightly above default for better visual quality |

## Command

```bash
npx @lumy-pack/scene-sieve "<input>" --json \
  -n 8 -q 85 \
  -o "<output-dir>" 2>/dev/null
```
