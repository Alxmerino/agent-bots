#!/usr/bin/env bash
# agent-bots Claude Code hook. Records per-session state to ~/.agentbots/sessions/<id>.json.
# Must never block or alter Claude Code: always exit 0, never print to stdout.
exec >/dev/null 2>&1
trap 'exit 0' EXIT

DIR="${AGENTBOTS_DIR:-$HOME/.agentbots}/sessions"
JQ=/usr/bin/jq; [[ -x $JQ ]] || JQ=/opt/homebrew/bin/jq; [[ -x $JQ ]] || JQ=jq
input="$(</dev/stdin)"

# Pull fields in one jq call; bail out quietly on invalid JSON.
fields="$(printf '%s' "$input" | "$JQ" -r '[.session_id // "", .hook_event_name // "", .cwd // ""] | @tsv')" || exit 0
IFS=$'\t' read -r sid event cwd <<<"$fields"
[[ -n "$sid" && -n "$event" && "$sid" != */* ]] || exit 0

[[ -d "$DIR" ]] || mkdir -p "$DIR"
file="$DIR/$sid.json"

if [[ "$event" == "SessionEnd" ]]; then
  rm -f "$file"
  exit 0
fi

# Find the Claude Code process: walk up the tree until the process name is "claude".
pid="" tty=""
if [[ ! -f "$file" ]]; then
  p=$PPID
  for _ in 1 2 3 4 5 6; do
    [[ -z "$p" || "$p" -le 1 ]] && break
    read -r ppid comm < <(ps -o ppid=,comm= -p "$p")
    if [[ "$(basename "$comm" | tr '[:upper:]' '[:lower:]')" == "claude" ]]; then
      pid=$p
      tty="$(ps -o tty= -p "$p" | tr -d ' ')"
      break
    fi
    p=$ppid
  done
fi

# Per-session lock (mkdir is atomic). Break locks older than 2s.
lock="$file.lock"
now="${EPOCHSECONDS:-$(date +%s)}"
for _ in {1..100}; do
  if mkdir "$lock" 2>/dev/null; then
    trap 'rmdir "$lock" 2>/dev/null; exit 0' EXIT
    break
  fi
  m="$(stat -f %m "$lock" 2>/dev/null)" && (( m < now - 2 )) && rmdir "$lock" 2>/dev/null
  sleep 0.02
done

prev="{}"
[[ -s "$file" ]] && prev="$(<"$file")"

# A random name, used only when the session has none yet.
NAMES=(Bolt Sprocket Widget Gizmo Rivet Pixel Cog Ziggy Blip Bleep Chip Dyna Echo Flux Gadget Hex
  Jolt Kilo Lumen Mako Nano Ohm Piston Quark Servo Tango Unit Volt Watt Zed Bitsy Crank Dynamo
  Ember Fizz Glitch Ion Juno Knob Loop Morse Nibble Orbit Pip Robo Spark Tinker Ratchet Wobble)
name="${NAMES[RANDOM % ${#NAMES[@]}]}"

tmp="$DIR/.tmp.$sid.$$"
printf '%s' "$input" | "$JQ" \
  --argjson prev "$prev" \
  --arg now "$now" --arg name "$name" \
  --arg pid "$pid" --arg tty "$tty" \
  --arg muxy "${MUXY_SESSION_ID:-}" --arg term "${TERM_PROGRAM:-}" '
  . as $in
  | ($now | tonumber) as $t
  | ($prev + {
      session_id: $in.session_id,
      name: ($prev.name // $name),
      cwd: ($in.cwd // $prev.cwd // ""),
      project: (($in.cwd // $prev.cwd // "") | split("/") | map(select(. != "")) | last // "unknown"),
      state: ($prev.state // "idle"),
      last_tool: ($prev.last_tool // ""),
      subagents: ($prev.subagents // {}),
      pid: ($prev.pid // (if $pid == "" then null else ($pid | tonumber) end)),
      tty: ($prev.tty // (if $tty == "" or $tty == "??" then null else $tty end)),
      muxy_session_id: ($prev.muxy_session_id // (if $muxy == "" then null else $muxy end)),
      term_program: ($prev.term_program // (if $term == "" then null else $term end)),
      updated: $t
    })
  | if   $in.hook_event_name == "SessionStart"     then .state = "idle"
    elif $in.hook_event_name == "UserPromptSubmit" then .state = "working"
    elif $in.hook_event_name == "PreToolUse"       then .state = "working" | .last_tool = ($in.tool_name // .last_tool)
    elif $in.hook_event_name == "PostToolUse"      then .state = "working"
    elif $in.hook_event_name == "PermissionRequest" then .state = "waiting"
    elif $in.hook_event_name == "Notification" then
      (if ($in.notification_type // "") | IN("permission_prompt", "elicitation_dialog") then .state = "waiting"
       elif $in.notification_type == "idle_prompt" then .state = "idle"
       else . end)
    elif $in.hook_event_name == "Stop" or $in.hook_event_name == "StopFailure" then .state = "idle" | .subagents = {}
    elif $in.hook_event_name == "SubagentStart"    then .subagents[$in.agent_id] = {type: ($in.agent_type // "agent"), since: $t}
    elif $in.hook_event_name == "SubagentStop"     then del(.subagents[$in.agent_id])
    else . end
' >"$tmp" && [[ -s "$tmp" ]] && mv "$tmp" "$file"
rm -f "$tmp"
