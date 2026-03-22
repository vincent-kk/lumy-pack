# Preset: detailed

Maximum coverage for thorough frame-by-frame analysis. Intent override.

## When to use

- User wants comprehensive analysis of every meaningful change
- Trigger phrases: "프레임 하나하나 봐줘", "자세히 분석해줘", "꼼꼼히"

## Flags

| Flag | Value | Reasoning |
|------|-------|-----------|
| `-n` | 30 | High frame count for comprehensive coverage |
| `-t` | 0.2 | Low threshold to capture subtle changes |
| `--fps` | 10 | High extraction rate |
| `--max-frames` | 300 | Default cap |
| `-s` | 720 | Default analysis resolution |
| `-q` | 80 | Default quality |

## Command

```bash
npx @lumy-pack/scene-sieve "<input>" --json \
  -n 30 -t 0.2 --fps 10 \
  -o "<output-dir>" 2>/dev/null
```

## Notes

- Produces many frames — best for short-to-medium clips (< 5min)
- For long videos, combine with `--max-frames 200 -s 480` to stay within resource limits
