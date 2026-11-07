#!/usr/bin/env bash
# Plays a scripted ~1 minute scene with fake sessions and records it, for a demo video.
# Agent Bots must be running.
#
#   scripts/demo.sh                 records the bots' strip to ~/Desktop/agent-bots-demo-<time>.mov
#   scripts/demo.sh path/to/out.mov records to that file
#   scripts/demo.sh --no-record     only plays the scene (record it yourself with Cmd+Shift+5)
#
# Recording needs Screen Recording permission for the app you run this from (System Settings >
# Privacy & Security > Screen & System Audio Recording). Demo bots disappear when the script exits.
# Real Claude Code sessions still show, so quit those first for a clean shot.
set -euo pipefail
DIR="$HOME/.agentbots/sessions"
OUT="${1:-$HOME/Desktop/agent-bots-demo-$(date +%Y%m%d-%H%M%S).mov}"
mkdir -p "$DIR"
trap 'rm -f "$DIR"/demo-*.json' EXIT

# session <id> <name> <project> <state> <last tool> [subagent ids...]
session() {
  [[ -n "${DRY:-}" ]] && return
  local id=$1 name=$2 project=$3 state=$4 tool=$5 subs="" a
  shift 5
  for a in "$@"; do subs+="${subs:+,}\"$a\":{\"type\":\"Explore\",\"since\":$(date +%s)}"; done
  # Write then rename, so the app never reads a half-written file. Files starting with "." are ignored.
  printf '{"session_id":"demo-%s","name":"%s","cwd":"/demo/%s","project":"%s","state":"%s","last_tool":"%s","subagents":{%s},"pid":%d,"updated":%d}\n' \
    "$id" "$name" "$project" "$project" "$state" "$tool" "$subs" $$ "$(date +%s)" >"$DIR/.demo-$id.tmp"
  mv "$DIR/.demo-$id.tmp" "$DIR/demo-$id.json"
}
end() { [[ -n "${DRY:-}" ]] || rm -f "$DIR/demo-$1.json"; }
LENGTH=0
beat() { if [[ -n "${DRY:-}" ]]; then LENGTH=$((LENGTH + $1)); else sleep "$1"; fi; }

scene() {
  session 1 Bolt agent-bots working Edit;                 beat 2
  session 2 Sprocket marketing-site working Bash;         beat 2
  session 3 Gizmo api-server working Read;                beat 2
  session 4 Pixel docs idle "";                           beat 3
  session 3 Gizmo api-server working Task a1;             beat 2  # Gizmo calls in help
  session 3 Gizmo api-server working Task a1 a2;          beat 4
  session 2 Sprocket marketing-site waiting Bash;         beat 5  # "!": needs permission
  session 2 Sprocket marketing-site working Bash;         beat 4  # approved, back to work
  session 1 Bolt agent-bots idle Edit;                    beat 4  # turn done: yawn, sleep
  session 3 Gizmo api-server working Task a2;             beat 2
  session 3 Gizmo api-server working Read;                beat 3
  session 4 Pixel docs working Grep;                      beat 4  # new prompt, new animation
  session 1 Bolt agent-bots working Write;                beat 5
  end 3;                                                  beat 5  # Gizmo's session ends: dies, ghost
  session 2 Sprocket marketing-site idle Bash;            beat 3
  session 4 Pixel docs idle Grep;                         beat 5
}

if [[ "$OUT" == "--no-record" ]]; then
  echo "Playing the scene in 3s. Start your recording now."; sleep 3
  scene
  echo "Done."
  exit 0
fi

DRY=1 scene; unset DRY # adds up the beats, so the recording ends with the scene

# Record exactly the strip: half the primary display's width, bottom left or right, just above the
# Dock, as tall as the bot size needs (the same math as place() and strip_height() in lib.rs).
CFG="$HOME/.agentbots/config.json"
case "$(sed -n 's/.*"size": *"\([SML]\)".*/\1/p' "$CFG" 2>/dev/null)" in S) SCALE=2 ;; L) SCALE=4 ;; *) SCALE=3 ;; esac
grep -q '"show_names": *false' "$CFG" 2>/dev/null && NAMES=0 || NAMES=16
grep -q '"side": *"right"' "$CFG" 2>/dev/null && SIDE=right || SIDE=left
STRIP=$((40 * SCALE + NAMES))
read -r X Y W < <(osascript -l JavaScript - "$SIDE" "$STRIP" <<'JS'
ObjC.import("AppKit");
function run([side, strip]) {
  const s = $.NSScreen.screens.js[0], f = s.frame, v = s.visibleFrame; // AppKit: origin bottom left
  const half = Math.round(v.size.width / 2);
  const x = side === "left" ? v.origin.x : v.origin.x + v.size.width - half;
  return `${x} ${f.size.height - v.origin.y - Number(strip)} ${half}`; // screencapture: origin top left
}
JS
)
screencapture -v -x -V $((LENGTH + 2)) -R "$X,$Y,$W,$STRIP" "$OUT" &
REC=$!
sleep 1
if ! kill -0 "$REC" 2>/dev/null; then
  echo "Couldn't start recording. Give the app you're running this from Screen Recording permission:" >&2
  echo "System Settings > Privacy & Security > Screen & System Audio Recording, then reopen it and try again." >&2
  echo "Or run: scripts/demo.sh --no-record, and record with Cmd+Shift+5." >&2
  exit 1
fi
echo "Recording the ${W}x${STRIP} strip for $((LENGTH + 2))s..."
scene
wait "$REC" || true
if [[ -s "$OUT" ]]; then echo "Saved: $OUT"; else echo "Recording failed: no file at $OUT" >&2; exit 1; fi
