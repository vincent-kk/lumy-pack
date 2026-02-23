#!/bin/sh
# filid Node.js Finder (find-node.sh)
#
# Locates the Node.js binary and executes it with the provided arguments.
# Designed for nvm/fnm users where `node` is not on PATH in non-interactive
# shells (e.g. Claude Code hook invocations).
#
# Priority:
#   0. Cached path in ~/.claude/plugins/filid/node-path-cache (skip full search)
#   1. nvm default alias → matching version, fallback to highest version
#   2. fnm default alias → matching version, fallback to highest version
#   3. `command -v node` (node is on PATH — fallback for non-nvm/fnm setups)
#   4. Homebrew / system paths (/opt/homebrew/bin/node, /usr/local/bin/node)
#
# Exits 0 on failure so it never blocks Claude Code hook processing.

# ---------------------------------------------------------------------------
# Helper: extract major version number from a node binary path containing vX.Y.Z
# ---------------------------------------------------------------------------
extract_major_version() {
  # Strip everything up to and including the last "/v"
  _ver="${1##*/v}"
  # Strip from first dot onward: "20.11.0/bin/node" -> "20"
  _ver="${_ver%%.*}"
  # Return only if numeric
  case "$_ver" in
    *[!0-9]*) echo 0 ;;
    '') echo 0 ;;
    *) echo "$_ver" ;;
  esac
}

# ---------------------------------------------------------------------------
# 0. Check cached path — if valid, exec immediately
# ---------------------------------------------------------------------------
CACHE_FILE="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/plugins/filid/node-path-cache"

if [ -f "$CACHE_FILE" ]; then
  CACHED_LINE=$(cat "$CACHE_FILE")
  # Parse "path:major" format using parameter expansion only
  CACHED="${CACHED_LINE%%:*}"
  _cached_major="${CACHED_LINE##*:}"
  # Validate cached major is numeric and >= 20
  case "$_cached_major" in
    *[!0-9]*|'') _cached_major=0 ;;
  esac
  if [ -x "$CACHED" ] && [ "$_cached_major" -ge 20 ]; then
    exec "$CACHED" "$@"
  fi
  rm -f "$CACHE_FILE"  # stale or invalid cache — remove and fall through
fi

NODE_BIN=""

# ---------------------------------------------------------------------------
# 1. nvm: prefer default alias, fall back to highest major version
# ---------------------------------------------------------------------------
if [ -z "$NODE_BIN" ] && [ -d "$HOME/.nvm/versions/node" ]; then
  # 1a. Try nvm default alias
  if [ -f "$HOME/.nvm/alias/default" ]; then
    _nvm_alias=$(cat "$HOME/.nvm/alias/default")
    # Resolve lts/* or lts/{name} alias chain
    case "$_nvm_alias" in
      lts/*)
        _lts_name="${_nvm_alias#lts/}"
        [ -f "$HOME/.nvm/alias/lts/$_lts_name" ] && _nvm_alias=$(cat "$HOME/.nvm/alias/lts/$_lts_name")
        ;;
    esac
    # Extract target major version from resolved alias
    _target_major=""
    case "$_nvm_alias" in
      *[!0-9.]*) ;;                                # non-numeric, skip
      *.*) _target_major="${_nvm_alias%%.*}" ;;     # semver or partial: 20.11.0 -> 20
      *)   _target_major="$_nvm_alias" ;;           # major only: 20
    esac
    # Find matching node binary for the default major version
    if [ -n "$_target_major" ]; then
      # shellcheck disable=SC2231
      for _path in "$HOME/.nvm/versions/node/v${_target_major}."*/bin/node; do
        [ -x "$_path" ] && NODE_BIN="$_path"
      done
    fi
  fi

  # 1b. Fallback: highest major version (if default not resolved)
  if [ -z "$NODE_BIN" ]; then
    _best_major=0
    # shellcheck disable=SC2231
    for _path in "$HOME/.nvm/versions/node/"*/bin/node; do
      if [ -x "$_path" ]; then
        _major=$(extract_major_version "$_path")
        if [ "$_major" -gt "$_best_major" ]; then
          _best_major=$_major
          NODE_BIN="$_path"
        fi
      fi
    done
  fi
fi

# ---------------------------------------------------------------------------
# 2. fnm: prefer default alias, fall back to highest major version
# ---------------------------------------------------------------------------
if [ -z "$NODE_BIN" ]; then
  for _fnm_base in \
    "$HOME/.fnm" \
    "$HOME/Library/Application Support/fnm" \
    "$HOME/.local/share/fnm"; do
    if [ -d "$_fnm_base/node-versions" ]; then
      # 2a. Try fnm default alias
      if [ -f "$_fnm_base/aliases/default" ]; then
        _fnm_alias=$(cat "$_fnm_base/aliases/default")
        _fnm_alias="${_fnm_alias#v}"  # strip leading 'v'
        _target_major=""
        case "$_fnm_alias" in
          *[!0-9.]*) ;;
          *.*) _target_major="${_fnm_alias%%.*}" ;;
          *)   _target_major="$_fnm_alias" ;;
        esac
        if [ -n "$_target_major" ]; then
          # shellcheck disable=SC2231
          for _path in "$_fnm_base/node-versions/v${_target_major}."*/installation/bin/node; do
            [ -x "$_path" ] && NODE_BIN="$_path"
          done
        fi
      fi

      # 2b. Fallback: highest major version
      if [ -z "$NODE_BIN" ]; then
        _best_major=0
        # shellcheck disable=SC2231
        for _path in "$_fnm_base/node-versions/"*/installation/bin/node; do
          if [ -x "$_path" ]; then
            _major=$(extract_major_version "$_path")
            if [ "$_major" -gt "$_best_major" ]; then
              _best_major=$_major
              NODE_BIN="$_path"
            fi
          fi
        done
      fi
      [ -n "$NODE_BIN" ] && break
    fi
  done
fi

# ---------------------------------------------------------------------------
# 3. command -v node (fallback for non-nvm/fnm setups)
# ---------------------------------------------------------------------------
if [ -z "$NODE_BIN" ]; then
  _resolved=$(command -v node 2>/dev/null)
  if [ -n "$_resolved" ] && [ -x "$_resolved" ]; then
    NODE_BIN="$_resolved"
  fi
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
# Validate minimum version (Node.js >= 20)
# ---------------------------------------------------------------------------
if [ -n "$NODE_BIN" ]; then
  _node_version=$("$NODE_BIN" --version 2>/dev/null)  # e.g. "v20.11.0"
  # Parameter expansion only — no sed/cut
  _node_major="${_node_version#v}"    # "20.11.0"
  _node_major="${_node_major%%.*}"    # "20"
  case "$_node_major" in
    *[!0-9]*) _node_major=0 ;;
    '') _node_major=0 ;;
  esac
  if [ "$_node_major" -lt 20 ]; then
    printf '[filid] Warning: Found node %s (%s) but require >= 20. Skipping.\n' \
      "$_node_version" "$NODE_BIN" >&2
    NODE_BIN=""
  fi
fi

# ---------------------------------------------------------------------------
# Invoke node with all provided arguments
# ---------------------------------------------------------------------------
if [ -z "$NODE_BIN" ]; then
  printf '[filid] Error: Could not find node binary. Ensure Node.js >= 20 is installed.\n' >&2
  exit 0  # exit 0 so this hook does not block Claude Code
fi

# Cache the resolved path with version for subsequent invocations
mkdir -p "$(dirname "$CACHE_FILE")" 2>/dev/null
echo "${NODE_BIN}:${_node_major}" > "$CACHE_FILE" 2>/dev/null

exec "$NODE_BIN" "$@"
