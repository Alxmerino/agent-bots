#!/usr/bin/env bash
# Installs the agent-bots hook into ~/.claude/settings.json. Safe to re-run.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$HOME/.agentbots"
SETTINGS="${CLAUDE_SETTINGS:-$HOME/.claude/settings.json}"
CMD="$DEST/hook.sh"

mkdir -p "$DEST/sessions"
cp "$ROOT/hook/hook.sh" "$CMD"
chmod +x "$CMD"

[[ -f "$SETTINGS" ]] || echo '{}' >"$SETTINGS"
cp "$SETTINGS" "$SETTINGS.agentbots-backup.$(date +%Y%m%d%H%M%S)"

# Tool events fire constantly, so run them async; the rest stay sync to keep state order.
tmp="$(mktemp)"
jq --arg cmd "$CMD" '
  def entry($async): {matcher: "", hooks: [({type: "command", command: $cmd} + (if $async then {async: true} else {} end))]};
  def strip: map(.hooks |= map(select(.command != $cmd))) | map(select(.hooks | length > 0));
  .hooks //= {}
  | reduce (
      ["SessionStart", false], ["UserPromptSubmit", false], ["PreToolUse", true], ["PostToolUse", true],
      ["PermissionRequest", false], ["Notification", false], ["Stop", false], ["StopFailure", false],
      ["SubagentStart", false], ["SubagentStop", false], ["SessionEnd", false]
    ) as [$ev, $async]
    (.; .hooks[$ev] = ((.hooks[$ev] // []) | strip) + [entry($async)])
' "$SETTINGS" >"$tmp" && mv "$tmp" "$SETTINGS"

echo "Installed hook to $CMD and registered it in $SETTINGS"
echo "Start a new Claude Code session (existing sessions pick it up on next event)."
