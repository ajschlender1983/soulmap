#!/usr/bin/env bash
# Stop the Soul Map and remove its background service. Your data stays in data/ and report/
# until you delete this folder. Ollama and its models stay; remove them from the Ollama app.
set -euo pipefail
LABEL="${SOUL_LABEL:-com.soulmap.app}"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
rm -f "$HOME/Library/LaunchAgents/$LABEL.plist"
echo "The Soul Map is stopped and will not start at login. Delete $(cd "$(dirname "$0")" && pwd) to remove it and your data."
