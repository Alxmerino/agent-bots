#!/usr/bin/env bash
# Fixture tests for hook.sh. Runs against a temp AGENTBOTS_DIR.
set -u
HOOK="$(cd "$(dirname "$0")" && pwd)/hook.sh"
export AGENTBOTS_DIR="$(mktemp -d)"
F="$AGENTBOTS_DIR/sessions/s1.json"
pass=0 fail=0

ev() { printf '%s' "$1" | "$HOOK"; }
check() { # name, jq expr that must be true
  if jq -e "$2" "$F" >/dev/null 2>&1; then pass=$((pass+1)); else fail=$((fail+1)); echo "FAIL: $1 ($2)"; jq -c . "$F" 2>/dev/null; fi
}

ev '{"session_id":"s1","hook_event_name":"SessionStart","cwd":"/Users/x/code/proj-a"}'
check "start idle" '.state=="idle" and .project=="proj-a"'
check "has name" '(.name|type)=="string" and (.name|length)>0'
NAME="$(jq -r .name "$F")"
ev '{"session_id":"s1","hook_event_name":"UserPromptSubmit","cwd":"/Users/x/code/proj-a"}'
check "prompt working" '.state=="working"'
ev '{"session_id":"s1","hook_event_name":"PreToolUse","tool_name":"Bash"}'
check "tool" '.state=="working" and .last_tool=="Bash"'
ev '{"session_id":"s1","hook_event_name":"Notification","notification_type":"permission_prompt"}'
check "perm waiting" '.state=="waiting"'
ev '{"session_id":"s1","hook_event_name":"PostToolUse","tool_name":"Bash"}'
check "post working" '.state=="working"'
ev '{"session_id":"s1","hook_event_name":"PermissionRequest"}'
check "permreq waiting" '.state=="waiting"'
ev '{"session_id":"s1","hook_event_name":"PreToolUse","tool_name":"Agent"}'
ev '{"session_id":"s1","hook_event_name":"SubagentStart","agent_id":"a1","agent_type":"Explore"}'
ev '{"session_id":"s1","hook_event_name":"SubagentStart","agent_id":"a2","agent_type":"Plan"}'
check "subagents added" '.subagents.a1.type=="Explore" and (.subagents|length)==2'
ev '{"session_id":"s1","hook_event_name":"SubagentStop","agent_id":"a1","agent_type":"Explore"}'
check "subagent removed" '(.subagents|keys)==["a2"]'
ev '{"session_id":"s1","hook_event_name":"Stop"}'
check "stop idle, subagents cleared" '.state=="idle" and .subagents=={}'
ev '{"session_id":"s1","hook_event_name":"UserPromptSubmit"}'
ev '{"session_id":"s1","hook_event_name":"Notification","notification_type":"idle_prompt"}'
check "idle_prompt idle" '.state=="idle"'
ev '{"session_id":"s1","hook_event_name":"Notification","notification_type":"auth_success"}'
check "other notif unchanged" '.state=="idle"'
check "cwd kept" '.project=="proj-a"'
check "name stable" ".name==\"$NAME\""

# Malformed input: no output, exit 0, file unchanged
before="$(cat "$F")"
out="$(printf 'not json' | "$HOOK")"; rc=$?
[[ $rc -eq 0 && -z "$out" && "$(cat "$F")" == "$before" ]] && pass=$((pass+1)) || { fail=$((fail+1)); echo "FAIL: malformed"; }

# Path traversal in session id is rejected
ev '{"session_id":"../evil","hook_event_name":"SessionStart"}'
[[ ! -e "$AGENTBOTS_DIR/evil.json" ]] && pass=$((pass+1)) || { fail=$((fail+1)); echo "FAIL: traversal"; }

# Concurrency: 20 parallel subagent starts must all land and leave valid JSON
for i in $(seq 1 20); do ev "{\"session_id\":\"s1\",\"hook_event_name\":\"SubagentStart\",\"agent_id\":\"c$i\"}" & done; wait
check "concurrent writes all kept" '(.subagents|length)==20'
[[ -z "$(ls "$AGENTBOTS_DIR/sessions" | grep -E 'lock|tmp')" ]] && pass=$((pass+1)) || { fail=$((fail+1)); echo "FAIL: leftover lock/tmp"; ls -a "$AGENTBOTS_DIR/sessions"; }

ev '{"session_id":"s1","hook_event_name":"SessionEnd"}'
[[ ! -e "$F" ]] && pass=$((pass+1)) || { fail=$((fail+1)); echo "FAIL: session end"; }

rm -rf "$AGENTBOTS_DIR"
echo "pass=$pass fail=$fail"
[[ $fail -eq 0 ]]
