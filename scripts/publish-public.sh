#!/usr/bin/env bash
# Every change goes to the open-source repo (Max, 2026-11-19).
# Exports the shareable files into the public checkout, then commits and pushes them.
#   scripts/publish-public.sh "<commit message>"
set -euo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)"
PUB="${SOUL_PUBLIC_DIR:-$SRC/../soulmap-public}"
MSG="${1:?usage: publish-public.sh \"<commit message>\"}"
bash "$SRC/scripts/export-public.sh" "$PUB"
cd "$PUB"
git add -A
if git diff --cached --quiet; then echo "public repo already up to date"; exit 0; fi
git -c user.name="maximilian-dollaz" -c user.email="270666726+maximilian-dollaz@users.noreply.github.com" \
  commit -q -m "$MSG"
git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push -q origin main
echo "pushed: $(git log --oneline -1)"
