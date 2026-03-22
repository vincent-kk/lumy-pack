# Preset: hq-capture

High-fidelity frame extraction for documentation screenshots. Intent override.

## When to use

- User needs sharp, high-quality frames (documentation, presentations)
- Trigger phrases: "스크린샷 뽑아줘", "선명하게 추출", "고화질"

## Flags

| Flag | Value | Reasoning |
|------|-------|-----------|
| `-n` | 8 | Moderate count; quality over quantity |
| `-t` | 0.5 | Default threshold |
| `--fps` | 5 | Default extraction rate |
| `--max-frames` | 300 | Default cap |
| `-s` | 1080 | Higher resolution preserves detail |
| `-q` | 95 | Near-lossless JPEG quality |

## Command

```bash
npx @lumy-pack/scene-sieve "<input>" --json \
  -n 8 -q 95 -s 1080 \
  -o "<output-dir>" 2>/dev/null
```
