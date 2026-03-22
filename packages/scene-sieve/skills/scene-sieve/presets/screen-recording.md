# Preset: screen-recording

Optimized for UI walkthroughs with sparse, discrete state changes. Intent override.

## When to use

- Screen recordings, app demos, UI walkthroughs
- Trigger phrases: "화면 녹화", "recording", "UI 데모"

## Flags

| Flag | Value | Reasoning |
|------|-------|-----------|
| `-n` | 12 | Enough to capture UI state transitions |
| `-t` | 0.3 | Lower threshold for discrete UI changes |
| `--fps` | 2 | Low FPS; screen recordings have long static periods |
| `--max-frames` | 300 | Default cap |
| `-s` | 720 | Default analysis resolution |
| `-q` | 80 | Default quality |

## Command

```bash
npx -y @lumy-pack/scene-sieve "<input>" --json \
  -n 12 --fps 2 -t 0.3 \
  -o "<output-dir>" 2>/dev/null
```

## Notes

- Low FPS (2) is key — screen recordings have long static periods between interactions
- Each frame typically represents a distinct UI state
- Read `.metadata.json` timestamps to describe the user's step-by-step actions
