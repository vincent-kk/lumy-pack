# Preset: inspection

Low threshold with animation-aware settings for visual bug detection. Intent override.

## When to use

- Inspecting for visual glitches, flickering, rendering bugs
- Trigger phrases: "버그 있는지 봐", "깜빡이는 부분 찾아줘", "시각적 문제"

## Flags

| Flag | Value | Reasoning |
|------|-------|-----------|
| `-n` | 20 | High count to catch transient issues |
| `-t` | 0.15 | Very low threshold — captures subtle changes |
| `--fps` | 5 | Default extraction rate |
| `--max-frames` | 300 | Default cap |
| `-s` | 720 | Default analysis resolution |
| `-q` | 80 | Default quality |
| `-it` | 0.7 | Lower IoU catches more animation regions |
| `-at` | 3 | Fewer frames needed to classify as animation |

## Command

```bash
npx -y @lumy-pack/scene-sieve "<input>" --json \
  -n 20 -t 0.15 -it 0.7 -at 3 \
  -o "<output-dir>" 2>/dev/null
```

## Notes

- Animation-aware: `-it 0.7 -at 3` prevents repeating animation frames from dominating output
- Very low threshold may produce many frames for visually busy content
