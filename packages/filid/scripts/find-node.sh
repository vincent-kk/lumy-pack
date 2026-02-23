#!/bin/sh
# filid Node.js Finder (find-node.sh)
#
# Locates the Node.js binary and executes it with the provided arguments.
# Designed for nvm/fnm users where `node` is not on PATH in non-interactive
# shells (e.g. Claude Code hook invocations).
#
# Priority:
#   0. Cached path in ~/.claude/plugins/filid/node-path-cache (skip full search)
#   1. `which node` (node is on PATH)
#   2. nvm versioned paths  (~/.nvm/versions/node/*/bin/node)
#   3. fnm versioned paths  (~/.fnm/node-versions/*/installation/bin/node)
#   4. Homebrew / system paths (/opt/homebrew/bin/node, /usr/local/bin/node)
#
# Exits 0 on failure so it never blocks Claude Code hook processing.

# ---------------------------------------------------------------------------
# 0. Check cached path — if valid, exec immediately
# ---------------------------------------------------------------------------
CACHE_FILE="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/plugins/filid/node-path-cache"

if [ -f "$CACHE_FILE" ]; then
  CACHED=$(cat "$CACHE_FILE")
  if [ -x "$CACHED" ]; then
    exec "$CACHED" "$@"
  fi
  rm -f "$CACHE_FILE"  # stale cache — remove and fall through to full search
fi

NODE_BIN=""

# ---------------------------------------------------------------------------
# 1. which node
# ---------------------------------------------------------------------------
if [ -z "$NODE_BIN" ] && command -v node >/dev/null 2>&1; then
  NODE_BIN="node"
fi

# ---------------------------------------------------------------------------
# 2. nvm versioned paths: iterate to find the latest installed version
# ---------------------------------------------------------------------------
if [ -z "$NODE_BIN" ] && [ -d "$HOME/.nvm/versions/node" ]; then
  # shellcheck disable=SC2231
  for _path in "$HOME/.nvm/versions/node/"*/bin/node; do
    [ -x "$_path" ] && NODE_BIN="$_path"
    # Keep iterating — later entries tend to be newer (lexicographic order)
  done
fi

# ---------------------------------------------------------------------------
# 3. fnm versioned paths (Linux and macOS default locations)
# ---------------------------------------------------------------------------
if [ -z "$NODE_BIN" ]; then
  for _fnm_base in \
    "$HOME/.fnm/node-versions" \
    "$HOME/Library/Application Support/fnm/node-versions" \
    "$HOME/.local/share/fnm/node-versions"; do
    if [ -d "$_fnm_base" ]; then
      # shellcheck disable=SC2231
      for _path in "$_fnm_base/"*/installation/bin/node; do
        [ -x "$_path" ] && NODE_BIN="$_path"
      done
      [ -n "$NODE_BIN" ] && break
    fi
  done
fi

# ---------------------------------------------------------------------------
# 4. Common Homebrew / system paths
# ---------------------------------------------------------------------------
if [ -z "$NODE_BIN" ]; then
  for _path in /opt/homebrew/bin/node /usr/local/bin/node /usr/bin/node; do
    if [ -x "$_path" ]; then
      NODE_BIN="$_path"
      break
    fi
  done
fi

# ---------------------------------------------------------------------------
# Invoke node with all provided arguments
# ---------------------------------------------------------------------------
if [ -z "$NODE_BIN" ]; then
  printf '[filid] Error: Could not find node binary. Ensure Node.js >= 20 is installed.\n' >&2
  exit 0  # exit 0 so this hook does not block Claude Code
fi

# Cache the resolved path for subsequent invocations
echo "$NODE_BIN" > "$CACHE_FILE" 2>/dev/null

exec "$NODE_BIN" "$@"
