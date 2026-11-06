#!/usr/bin/env bash
# Removes only the agent-bots hook entries from ~/.claude/settings.json.
set -euo pipefail
SETTINGS="${CLAUDE_SETTINGS:-$HOME/.claude/settings.json}"
CMD="$HOME/.agentbots/hook.sh"

[[ -f "$SETTINGS" ]] || exit 0
cp "$SETTINGS" "$SETTINGS.agentbots-backup.$(date +%Y%m%d%H%M%S)"
tmp="$(mktemp)"
jq --arg cmd "$CMD" '
  if .hooks then
    .hooks |= (with_entries(.value |= (map(.hooks |= map(select(.command != $cmd))) | map(select(.hooks | length > 0))))
               | with_entries(select(.value | length > 0)))
  else . end
' "$SETTINGS" >"$tmp" && mv "$tmp" "$SETTINGS"
echo "Removed agent-bots hooks from $SETTINGS. Delete ~/.agentbots to remove state."
