#!/usr/bin/env bash
set -eo pipefail

# Update GLiNER model SHA-256 hashes in model-manager.ts
# Downloads all model files from vincent-kk HF repo, computes hashes, and prints registry update.
#
# Usage: bash scripts/model/update-hashes.sh [--force]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
MODEL_DIR="$PROJECT_DIR/.model"
SOURCE_FILE="$PROJECT_DIR/src/detection/ner/model-manager.ts"

FORCE=false
[[ "${1:-}" == "--force" ]] && FORCE=true

TODAY=$(date +%Y-%m-%d)

REPO_BASE="https://huggingface.co/vincent-kk/gliner_multi-v2.1-onnx/resolve/main"
MODEL_ID="gliner_multi-v2.1"

# All required model files
FILES=(
  "onnx/model_int8.onnx"
  "config.json"
  "gliner_config.json"
  "tokenizer.json"
  "tokenizer_config.json"
  "special_tokens_map.json"
  "added_tokens.json"
  "spm.model"
)

echo "=== GLiNER Model Hash Updater ==="
echo ""
echo "Model: $MODEL_ID"
echo "Files: ${#FILES[@]}"
echo ""

model_dir="$MODEL_DIR/$MODEL_ID"
mkdir -p "$model_dir"

total_size=0

for f in "${FILES[@]}"; do
  echo "--- $f ---"

  # Create subdirectory if needed
  local_file="$model_dir/$f"
  mkdir -p "$(dirname "$local_file")"

  # Download if needed
  if [[ -f "$local_file" ]] && [[ "$FORCE" == false ]]; then
    echo "  File exists, skipping download (use --force to re-download)"
  else
    echo "  Downloading from HuggingFace..."
    url="$REPO_BASE/$f"
    if ! curl -L --progress-bar -o "$local_file" "$url"; then
      echo "  ERROR: Download failed for $f"
      continue
    fi
  fi

  # Compute hash and size
  file_size=$(stat -f%z "$local_file" 2>/dev/null || stat -c%s "$local_file" 2>/dev/null)
  hash=$(shasum -a 256 "$local_file" | awk '{print $1}')

  total_size=$((total_size + file_size))

  echo "  Hash: $hash"
  echo "  Size: $file_size bytes"
  echo ""
done

echo "=== Registry Update (copy to model-manager.ts) ==="
echo ""
echo "files: ["

for f in "${FILES[@]}"; do
  local_file="$model_dir/$f"
  if [[ -f "$local_file" ]]; then
    hash=$(shasum -a 256 "$local_file" | awk '{print $1}')
    file_size=$(stat -f%z "$local_file" 2>/dev/null || stat -c%s "$local_file" 2>/dev/null)
    printf "  { repoPath: '%s', localPath: '%s', sha256: '%s', sizeBytes: %s },\n" "$f" "$f" "$hash" "$file_size"
  fi
done

echo "],"
echo "totalSizeBytes: $total_size,"
echo ""
echo "=== Summary ==="
echo ""
printf "%-30s %-66s %12s\n" "File" "SHA-256" "Size"
printf "%-30s %-66s %12s\n" "------------------------------" "------------------------------------------------------------------" "------------"
for f in "${FILES[@]}"; do
  local_file="$model_dir/$f"
  if [[ -f "$local_file" ]]; then
    hash=$(shasum -a 256 "$local_file" | awk '{print $1}')
    size=$(stat -f%z "$local_file" 2>/dev/null || stat -c%s "$local_file" 2>/dev/null)
    printf "%-30s %-66s %10s B\n" "$f" "$hash" "$size"
  fi
done
echo ""
echo "Total: $total_size bytes ($(( total_size / 1048576 ))MB)"
echo ""
echo "Done."
