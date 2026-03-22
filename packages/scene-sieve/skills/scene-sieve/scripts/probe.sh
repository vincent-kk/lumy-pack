#!/usr/bin/env bash
#
# probe.sh — Probe video file and recommend a scene-sieve preset.
#
# Usage: ./probe.sh <input-file> [user-intent]
#
# Arguments:
#   input-file    Path to video or GIF file
#   user-intent   Optional: quick-glance | detailed | hq-capture | inspection | screen-recording
#
# Output: JSON with video info + recommended preset + flags
#
# Example:
#   ./probe.sh demo.mp4
#   ./probe.sh recording.mp4 screen-recording
#   ./probe.sh animation.gif

set -euo pipefail

INPUT="${1:-}"
INTENT="${2:-}"

if [[ -z "$INPUT" ]]; then
  echo '{"ok":false,"error":"Usage: probe.sh <input-file> [user-intent]"}' >&2
  exit 1
fi

if [[ ! -f "$INPUT" ]]; then
  echo "{\"ok\":false,\"error\":\"File not found: $INPUT\"}"
  exit 1
fi

# --- Detect extension ---
EXT="${INPUT##*.}"
EXT_LOWER="$(echo "$EXT" | tr '[:upper:]' '[:lower:]')"
FILE_SIZE=$(stat -f%z "$INPUT" 2>/dev/null || stat -c%s "$INPUT" 2>/dev/null || echo "0")

# --- Locate ffprobe ---
FFPROBE_BIN=""

# 1. System ffprobe
if command -v ffprobe &>/dev/null; then
  FFPROBE_BIN="ffprobe"
fi

# 2. Bundled ffprobe via @ffprobe-installer (npm)
if [[ -z "$FFPROBE_BIN" ]]; then
  BUNDLED=$(node -e "try{console.log(require('@ffprobe-installer/ffprobe').path)}catch{}" 2>/dev/null || true)
  if [[ -n "$BUNDLED" && -x "$BUNDLED" ]]; then
    FFPROBE_BIN="$BUNDLED"
  fi
fi

# --- Probe with ffprobe ---
DURATION="0"
WIDTH="0"
HEIGHT="0"
FORMAT=""
HAS_VIDEO="false"
PROBE_OK="false"

if [[ -n "$FFPROBE_BIN" ]]; then
  PROBE_JSON=$("$FFPROBE_BIN" -v quiet -print_format json -show_format -show_streams "$INPUT" 2>/dev/null || echo "{}")

  DURATION=$(echo "$PROBE_JSON" | grep -o '"duration"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"duration"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/' || echo "0")

  WIDTH=$(echo "$PROBE_JSON" | grep -o '"width"[[:space:]]*:[[:space:]]*[0-9]*' | head -1 | sed 's/.*:[[:space:]]*//' || echo "0")
  HEIGHT=$(echo "$PROBE_JSON" | grep -o '"height"[[:space:]]*:[[:space:]]*[0-9]*' | head -1 | sed 's/.*:[[:space:]]*//' || echo "0")

  FORMAT=$(echo "$PROBE_JSON" | grep -o '"format_name"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"format_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/' || echo "")

  if echo "$PROBE_JSON" | grep -q '"codec_type"[[:space:]]*:[[:space:]]*"video"'; then
    HAS_VIDEO="true"
  fi

  PROBE_OK="true"
else
  # Fallback: estimate duration from file size
  # Rough heuristic: ~1MB per 10s for typical compressed video
  DURATION=$(awk "BEGIN {printf \"%.1f\", $FILE_SIZE / 1048576 * 10}")
fi

# Ensure DURATION is numeric
DURATION=$(echo "$DURATION" | grep -o '[0-9.]*' | head -1)
DURATION="${DURATION:-0}"

DURATION_INT=$(awk "BEGIN {printf \"%d\", $DURATION}")

# --- Select preset ---
if [[ -n "$INTENT" ]]; then
  # Intent override takes priority
  PRESET="$INTENT"
elif [[ "$EXT_LOWER" == "gif" ]]; then
  PRESET="gif"
elif (( DURATION_INT <= 30 )); then
  PRESET="short-clip"
elif (( DURATION_INT <= 300 )); then
  PRESET="medium-video"
elif (( DURATION_INT <= 1800 )); then
  PRESET="long-video"
else
  PRESET="very-long"
fi

# --- Map preset to flags ---
case "$PRESET" in
  short-clip)
    COUNT=8; THRESHOLD="0.5"; FPS=5; MAX_FRAMES=300; SCALE=720; QUALITY=85; EXTRA="" ;;
  medium-video)
    COUNT=12; THRESHOLD="0.5"; FPS=5; MAX_FRAMES=300; SCALE=720; QUALITY=80; EXTRA="" ;;
  long-video)
    COUNT=15; THRESHOLD="0.5"; FPS=2; MAX_FRAMES=200; SCALE=480; QUALITY=80; EXTRA="" ;;
  very-long)
    COUNT=20; THRESHOLD="0.5"; FPS=1; MAX_FRAMES=150; SCALE=480; QUALITY=80; EXTRA="--concurrency 1" ;;
  gif)
    COUNT=10; THRESHOLD="0.3"; FPS=5; MAX_FRAMES=50; SCALE=720; QUALITY=80; EXTRA="" ;;
  quick-glance)
    COUNT=5; THRESHOLD="0.5"; FPS=2; MAX_FRAMES=300; SCALE=480; QUALITY=80; EXTRA="" ;;
  detailed)
    COUNT=30; THRESHOLD="0.2"; FPS=10; MAX_FRAMES=300; SCALE=720; QUALITY=80; EXTRA="" ;;
  hq-capture)
    COUNT=8; THRESHOLD="0.5"; FPS=5; MAX_FRAMES=300; SCALE=1080; QUALITY=95; EXTRA="" ;;
  inspection)
    COUNT=20; THRESHOLD="0.15"; FPS=5; MAX_FRAMES=300; SCALE=720; QUALITY=80; EXTRA="-it 0.7 -at 3" ;;
  screen-recording)
    COUNT=12; THRESHOLD="0.3"; FPS=2; MAX_FRAMES=300; SCALE=720; QUALITY=80; EXTRA="" ;;
  *)
    # Unknown intent, fall back to medium-video
    PRESET="medium-video"
    COUNT=12; THRESHOLD="0.5"; FPS=5; MAX_FRAMES=300; SCALE=720; QUALITY=80; EXTRA="" ;;
esac

# --- Build command ---
CMD="npx @lumy-pack/scene-sieve \"$INPUT\" --json -n $COUNT -t $THRESHOLD --fps $FPS --max-frames $MAX_FRAMES -s $SCALE -q $QUALITY"
if [[ -n "$EXTRA" ]]; then
  CMD="$CMD $EXTRA"
fi

# --- Format duration for display ---
DURATION_MIN=$(awk "BEGIN {printf \"%d\", $DURATION / 60}")
DURATION_SEC=$(awk "BEGIN {printf \"%d\", $DURATION - $DURATION_MIN * 60}")

# --- Output JSON ---
cat <<EOF
{
  "ok": true,
  "probe": {
    "file": "$INPUT",
    "extension": "$EXT_LOWER",
    "fileSize": $FILE_SIZE,
    "duration": $DURATION,
    "durationDisplay": "${DURATION_MIN}m${DURATION_SEC}s",
    "resolution": "${WIDTH}x${HEIGHT}",
    "format": "$FORMAT",
    "hasVideo": $HAS_VIDEO,
    "probeAvailable": $PROBE_OK
  },
  "preset": {
    "name": "$PRESET",
    "flags": {
      "count": $COUNT,
      "threshold": $THRESHOLD,
      "fps": $FPS,
      "maxFrames": $MAX_FRAMES,
      "scale": $SCALE,
      "quality": $QUALITY,
      "extra": "$EXTRA"
    }
  },
  "command": "$CMD"
}
EOF
