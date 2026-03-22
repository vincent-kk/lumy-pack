# Preset: gif

GIF animations. Always uses FPS-based extraction (no I-frame detection).

## When to use

- Any `.gif` file — auto-selected by extension
- Animation inspection, UI motion review

## Flags

| Flag | Value | Reasoning |
|------|-------|-----------|
| `-n` | 10 | Moderate frame count for animation sequences |
| `-t` | 0.3 | Lower threshold to capture subtle frame differences |
| `--fps` | 5 | Default extraction rate |
| `--max-frames` | 50 | Tight cap; GIFs can have many frames |
| `-s` | 720 | Default analysis resolution |
| `-q` | 80 | Default quality |

## Command

```bash
npx -y @lumy-pack/scene-sieve "<input>" --json \
  -n 10 -t 0.3 --max-frames 50 \
  -o "<output-dir>" 2>/dev/null
```

## Notes

- GIFs bypass I-frame detection and always use FPS-based extraction
- For very large GIFs (>10MB), consider lowering `--max-frames` further
