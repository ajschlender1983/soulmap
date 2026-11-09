#!/usr/bin/env bash
# Installs Ollama (into ~/Applications, no admin password) and pulls the local model, for people who
# choose "Only this Mac" in onboarding. The app runs it in the background; install.sh runs it with SOUL_LOCAL=1.
#   scripts/local-model.sh [model]   default: qwen3:8b with 16 GB of memory or more, qwen3:4b below that
set -euo pipefail
TOOLS="$HOME/.soulmap"
mkdir -p "$TOOLS"
OLLAMA="$(command -v ollama || true)"
for app in "/Applications/Ollama.app" "$HOME/Applications/Ollama.app"; do
  [[ -z "$OLLAMA" && -x "$app/Contents/Resources/ollama" ]] && OLLAMA="$app/Contents/Resources/ollama"
done
if [[ -z "$OLLAMA" ]]; then
  echo "STEP Installing Ollama"
  mkdir -p "$HOME/Applications"
  curl -fsSL -o "$TOOLS/Ollama.zip" https://ollama.com/download/Ollama-darwin.zip
  ditto -x -k "$TOOLS/Ollama.zip" "$HOME/Applications" && rm -f "$TOOLS/Ollama.zip"
  OLLAMA="$HOME/Applications/Ollama.app/Contents/Resources/ollama"
fi
if ! curl -fs http://127.0.0.1:11434/api/version >/dev/null; then
  echo "STEP Starting Ollama"
  open -a "$(dirname "$(dirname "$(dirname "$OLLAMA")")")" 2>/dev/null || ("$OLLAMA" serve >/dev/null 2>&1 &)
  for _ in $(seq 1 60); do curl -fs http://127.0.0.1:11434/api/version >/dev/null && break; sleep 1; done
  curl -fs http://127.0.0.1:11434/api/version >/dev/null || { echo "FAIL Ollama did not start. Open the Ollama app once, then try again."; exit 1; }
fi
RAM_GB=$(( $(sysctl -n hw.memsize) / 1073741824 ))
MODEL="${1:-${SOUL_MODEL:-$([[ $RAM_GB -ge 16 ]] && echo qwen3:8b || echo qwen3:4b)}}"
if ! "$OLLAMA" list 2>/dev/null | awk '{print $1}' | grep -qx "$MODEL"; then
  echo "STEP Downloading $MODEL"
  "$OLLAMA" pull "$MODEL"
fi
echo "DONE $MODEL"
