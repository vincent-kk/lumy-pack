# Preset: very-long

Videos > 30min. Aggressive performance caps to prevent timeout/OOM.

## When to use

- Full meeting recordings, conference talks, livestream archives
- Duration-based auto-selection: > 30min

## Flags

| Flag | Value | Reasoning |
|------|-------|-----------|
| `-n` | 20 | Broad coverage without overwhelming output |
| `-t` | 0.5 | Default threshold |
| `--fps` | 1 | Minimal extraction rate |
| `--max-frames` | 150 | Tight cap for memory safety |
| `-s` | 480 | Reduced resolution for speed |
| `-q` | 80 | Default quality |
| `--concurrency` | 1 | Single-threaded to limit memory |

## Command

```bash
npx -y @lumy-pack/scene-sieve "<input>" --json \
  -n 20 --fps 1 --max-frames 150 -s 480 --concurrency 1 \
  -o "<output-dir>" 2>/dev/null
```
