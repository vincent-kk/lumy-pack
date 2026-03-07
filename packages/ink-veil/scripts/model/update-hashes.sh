#!/usr/bin/env bash
set -eo pipefail

# Update GLiNER model SHA-256 hashes in model-manager.ts
# Downloads from vincent-kk HF repo, computes hash, and updates source.
# Can run independently of docker-convert.sh (for re-verification).
#
# Usage: bash scripts/model/update-hashes.sh [--force]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
MODEL_DIR="$PROJECT_DIR/.model"
SOURCE_FILE="$PROJECT_DIR/src/detection/ner/model-manager.ts"

FORCE=false
[[ "${1:-}" == "--force" ]] && FORCE=true

TODAY=$(date +%Y-%m-%d)

# Model definitions: id|url|source_ref
MODELS=(
  "gliner_multi-v2.1|https://huggingface.co/vincent-kk/gliner_multi-v2.1-onnx/resolve/main/onnx/model_int8.onnx|vincent-kk/gliner_multi-v2.1-onnx@main"
)

echo "=== GLiNER Model Hash Updater ==="
echo ""

for entry in "${MODELS[@]}"; do
  IFS='|' read -r model_id url source_ref <<< "$entry"
  model_dir="$MODEL_DIR/$model_id"
  model_file="$model_dir/model_int8.onnx"

  echo "--- $model_id ---"

  # Download if needed
  if [[ -f "$model_file" ]] && [[ "$FORCE" == false ]]; then
    echo "  File exists, skipping download (use --force to re-download)"
  else
    echo "  Downloading from HuggingFace..."
    mkdir -p "$model_dir"
    if ! curl -L --progress-bar -o "$model_file" "$url"; then
      echo "  ERROR: Download failed for $model_id"
      continue
    fi
  fi

  # Validate file (must be > 1MB to be a real model, not an error page)
  file_size=$(stat -f%z "$model_file" 2>/dev/null || stat -c%s "$model_file" 2>/dev/null)
  if [[ "$file_size" -lt 1048576 ]]; then
    echo "  ERROR: File too small (${file_size} bytes) — likely not a valid model"
    continue
  fi

  # Compute hash
  hash=$(shasum -a 256 "$model_file" | awk '{print $1}')
  size_mb=$((file_size / 1048576))

  echo "  Hash:  $hash"
  echo "  Size:  ${size_mb}MB ($file_size bytes)"

  # Update model-manager.ts
  if grep -q "'$model_id'" "$SOURCE_FILE" 2>/dev/null || grep -q "\"$model_id\"" "$SOURCE_FILE" 2>/dev/null; then
    # Replace url
    MODEL_ID="$model_id" URL="$url" \
      perl -i -0pe '
        my $mid = $ENV{MODEL_ID};
        my $url = $ENV{URL};
        s/((?:\x27${mid}\x27|"${mid}").*?url:\s*)\x27[^\x27]*\x27/${1}\x27${url}\x27/s;
      ' "$SOURCE_FILE"

    # Replace sha256 value and add/update comment
    MODEL_ID="$model_id" TODAY="$TODAY" SOURCE_REF="$source_ref" HASH="$hash" \
      perl -i -0pe '
        my $mid = $ENV{MODEL_ID};
        my $today = $ENV{TODAY};
        my $src = $ENV{SOURCE_REF};
        my $h = $ENV{HASH};
        s/((?:\x27${mid}\x27|"${mid}").*?)(\/\/ Updated:.*?\n)?(\s*sha256:\s*)\x27[^\x27]*\x27/$1\/\/ Updated: ${today} | Source: ${src}\n$3\x27${h}\x27/s;
      ' "$SOURCE_FILE"

    # Update sizeBytes
    MODEL_ID="$model_id" FSIZE="$file_size" \
      perl -i -0pe '
        my $mid = $ENV{MODEL_ID};
        my $sz = $ENV{FSIZE};
        s/((?:\x27${mid}\x27|"${mid}").*?sizeBytes:\s*)\d[\d_]*/${1}${sz}/s;
      ' "$SOURCE_FILE"

    echo "  Updated model-manager.ts"
  else
    echo "  WARNING: Model entry '$model_id' not found in $SOURCE_FILE"
  fi

  echo ""
done

echo "=== Summary ==="
echo ""
printf "%-25s %-66s %10s\n" "Model" "SHA-256" "Size"
printf "%-25s %-66s %10s\n" "-------------------------" "------------------------------------------------------------------" "----------"
for entry in "${MODELS[@]}"; do
  IFS='|' read -r model_id _ _ <<< "$entry"
  model_file="$MODEL_DIR/$model_id/model_int8.onnx"
  if [[ -f "$model_file" ]]; then
    hash=$(shasum -a 256 "$model_file" | awk '{print $1}')
    size=$(stat -f%z "$model_file" 2>/dev/null || stat -c%s "$model_file" 2>/dev/null)
    size_mb=$((size / 1048576))
    printf "%-25s %-66s %7sMB\n" "$model_id" "$hash" "$size_mb"
  fi
done
echo ""
echo "Done."
