#!/usr/bin/env bash
set -eo pipefail

# Mirror GLiNER ONNX model: download from onnx-community, verify, upload to vincent-kk HF repo.
# Parses JSON output from Docker to auto-update model-manager.ts.
#
# Usage:
#   bash scripts/model/docker-convert.sh              # full pipeline (upload + update)
#   bash scripts/model/docker-convert.sh --skip-upload # verify only (no upload, still updates TS)
#
# Required: HF_TOKEN environment variable for upload.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
IMAGE_NAME="ink-veil-model-convert"
SOURCE_FILE="$PROJECT_DIR/src/detection/ner/model-manager.ts"
TODAY=$(date +%Y-%m-%d)

# ── Load .env + resolve HF_TOKEN ───────────────────────────────────────────

# Walk up from project dir to $HOME, load the first .env found
_dir="$PROJECT_DIR"
while [[ "$_dir" != "/" ]]; do
  if [[ -f "$_dir/.env" ]]; then
    set -a
    source "$_dir/.env"
    set +a
    break
  fi
  # Stop at $HOME — don't go above it
  [[ "$_dir" == "$HOME" ]] && break
  _dir="$(dirname "$_dir")"
done

# Map common token variable names to HF_TOKEN
: "${HF_TOKEN:=${HUGGINGFACE_API_TOKEN:-}}"

# ── Pre-flight checks ─────────────────────────────────────────────────────

if ! command -v docker &>/dev/null; then
  echo "ERROR: docker is not installed"
  exit 1
fi

SKIP_UPLOAD=false
EXTRA_ARGS=()
for arg in "$@"; do
  [[ "$arg" == "--skip-upload" ]] && SKIP_UPLOAD=true
  EXTRA_ARGS+=("$arg")
done

if [[ "$SKIP_UPLOAD" == false ]] && [[ -z "${HF_TOKEN:-}" ]]; then
  echo "ERROR: HF_TOKEN is required for upload."
  echo ""
  echo "  1. Create a token at https://huggingface.co/settings/tokens (write access)"
  echo "  2. Add to .env:  HF_TOKEN=hf_xxx"
  echo "     Or inline:    HF_TOKEN=hf_xxx yarn model:convert"
  echo ""
  echo "  Or do a dry run: yarn model:convert:dry"
  exit 1
fi

# ── JSON parser ───────────────────────────────────────────────────────────

parse_json() {
  local json="$1"
  local field="$2"
  if command -v jq &>/dev/null; then
    echo "$json" | jq -r ".[0].$field"
  else
    python3 -c "import json,sys; d=json.loads(sys.stdin.read()); print(d[0]['$field'])" <<< "$json"
  fi
}

# ── Build ──────────────────────────────────────────────────────────────────

echo "=== Building Docker image: $IMAGE_NAME ==="
docker build \
  -f "$PROJECT_DIR/scripts/model/Dockerfile" \
  -t "$IMAGE_NAME" \
  "$PROJECT_DIR"

# ── Run ────────────────────────────────────────────────────────────────────

echo ""
echo "=== Running model mirror pipeline ==="

DOCKER_ARGS=(
  --rm
  -v "$PROJECT_DIR/.model:/workspace/output"
)

if [[ "$SKIP_UPLOAD" == false ]]; then
  DOCKER_ARGS+=(-e "HF_TOKEN=${HF_TOKEN}")
fi

# Run once: stderr goes to terminal (logs), stdout captured (JSON)
JSON_OUTPUT=$(docker run "${DOCKER_ARGS[@]}" "$IMAGE_NAME" "${EXTRA_ARGS[@]}" 2>/dev/stderr)

echo ""
echo "=== Pipeline output ==="
echo "$JSON_OUTPUT"

# ── Parse and update model-manager.ts ──────────────────────────────────────

if echo "$JSON_OUTPUT" | python3 -c "import json,sys; json.loads(sys.stdin.read())" 2>/dev/null; then
  MODEL_ID=$(parse_json "$JSON_OUTPUT" "model_id")
  SHA256=$(parse_json "$JSON_OUTPUT" "sha256")
  SIZE_BYTES=$(parse_json "$JSON_OUTPUT" "sizeBytes")
  URL=$(parse_json "$JSON_OUTPUT" "url")

  echo ""
  echo "=== Updating model-manager.ts ==="
  echo "  model_id:  $MODEL_ID"
  echo "  sha256:    $SHA256"
  echo "  sizeBytes: $SIZE_BYTES"
  echo "  url:       $URL"

  if [[ -f "$SOURCE_FILE" ]]; then
    # Update url
    MODEL_ID="$MODEL_ID" URL="$URL" \
      perl -i -0pe '
        my $mid = $ENV{MODEL_ID};
        my $url = $ENV{URL};
        s/((?:\x27${mid}\x27|"${mid}").*?url:\s*)\x27[^\x27]*\x27/${1}\x27${url}\x27/s;
      ' "$SOURCE_FILE"

    # Update sha256 with date comment
    SOURCE_REF="vincent-kk/gliner_multi-v2.1-onnx@main"
    MODEL_ID="$MODEL_ID" TODAY="$TODAY" SOURCE_REF="$SOURCE_REF" HASH="$SHA256" \
      perl -i -0pe '
        my $mid = $ENV{MODEL_ID};
        my $today = $ENV{TODAY};
        my $src = $ENV{SOURCE_REF};
        my $h = $ENV{HASH};
        s/((?:\x27${mid}\x27|"${mid}").*?)(\/\/ Updated:.*?\n)?(\s*sha256:\s*)\x27[^\x27]*\x27/$1\/\/ Updated: ${today} | Source: ${src}\n$3\x27${h}\x27/s;
      ' "$SOURCE_FILE"

    # Update sizeBytes
    MODEL_ID="$MODEL_ID" FSIZE="$SIZE_BYTES" \
      perl -i -0pe '
        my $mid = $ENV{MODEL_ID};
        my $sz = $ENV{FSIZE};
        s/((?:\x27${mid}\x27|"${mid}").*?sizeBytes:\s*)\d[\d_]*/${1}${sz}/s;
      ' "$SOURCE_FILE"

    echo ""
    echo "=== Changes ==="
    cd "$PROJECT_DIR" && git --no-pager diff --no-color -- src/detection/ner/model-manager.ts || true
  else
    echo "  WARNING: $SOURCE_FILE not found"
  fi
else
  echo ""
  echo "WARNING: Could not parse JSON output. Manual update required."
  echo "Run: yarn update-model-hashes"
fi

# ── Cleanup ────────────────────────────────────────────────────────────────

echo ""
echo "=== Cleaning up Docker image ==="
docker rmi "$IMAGE_NAME" >/dev/null 2>&1 && echo "  Removed image: $IMAGE_NAME" || true
docker image prune -f >/dev/null 2>&1

echo ""
echo "=== Done ==="
echo ""
echo "Next steps:"
echo "  1. Review changes: git diff src/detection/ner/model-manager.ts"
echo "  2. Run tests: yarn test:run"
