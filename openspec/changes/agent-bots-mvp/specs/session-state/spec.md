## ADDED Requirements

### Requirement: Per-session state file
The hook script SHALL maintain one JSON file per Claude Code session at `~/.agentbots/sessions/<session_id>.json` containing `session_id`, `name`, `cwd`, `project` (basename of `cwd`), `state`, `last_tool`, `subagents`, `muxy_session_id`, `term_program`, `pid`, and `updated` (unix seconds).

#### Scenario: File created on session start
- **WHEN** a Claude Code session fires `SessionStart`
- **THEN** `~/.agentbots/sessions/<session_id>.json` exists with `state` = `idle` and `project` = basename of the session's `cwd`

#### Scenario: Random name assigned once
- **WHEN** a session file is first created
- **THEN** `name` is a random robot name, and later events never change it

#### Scenario: Terminal identifiers recorded
- **WHEN** the session runs inside Muxy
- **THEN** the file's `muxy_session_id` equals the hook environment's `MUXY_SESSION_ID` and `term_program` equals `TERM_PROGRAM`

#### Scenario: Missing session file is created on any event
- **WHEN** any tracked hook fires for a session with no existing file (e.g. app installed mid-session)
- **THEN** the hook creates the file before applying the event

### Requirement: Event to state mapping
The hook script SHALL set `state` from the hook event as follows: `UserPromptSubmit`, `PreToolUse` and `PostToolUse` set `working`; `PermissionRequest`, and `Notification` with `notification_type` of `permission_prompt` or `elicitation_dialog`, set `waiting`; `Notification` with `idle_prompt`, `Stop` and `StopFailure` set `idle`. Other notification types leave state unchanged. `PreToolUse` SHALL also set `last_tool` to the tool name. Every write SHALL refresh `updated`.

#### Scenario: Prompt submitted
- **WHEN** `UserPromptSubmit` fires
- **THEN** `state` is `working`

#### Scenario: Tool call
- **WHEN** `PreToolUse` fires for tool `Bash`
- **THEN** `state` is `working` and `last_tool` is `Bash`

#### Scenario: Permission prompt
- **WHEN** `PermissionRequest` fires, or `Notification` fires with `notification_type` = `permission_prompt`
- **THEN** `state` is `waiting`

#### Scenario: Idle reminder is not waiting
- **WHEN** `Notification` fires with `notification_type` = `idle_prompt`
- **THEN** `state` is `idle`

#### Scenario: Turn finished
- **WHEN** `Stop` fires
- **THEN** `state` is `idle`

### Requirement: Subagent tracking
The hook script SHALL add an entry to `subagents` keyed by agent id with the agent type and start time when a subagent starts, and SHALL remove that entry when the subagent stops. On `Stop` of the parent session, all subagent entries SHALL be cleared.

#### Scenario: Subagent spawned
- **WHEN** a subagent of type `Explore` starts
- **THEN** `subagents` contains its id with `type` = `Explore`

#### Scenario: Subagent finished
- **WHEN** that subagent stops
- **THEN** its id is no longer in `subagents`

#### Scenario: Parent stops with leftover entries
- **WHEN** `Stop` fires while `subagents` is non-empty
- **THEN** `subagents` is empty

### Requirement: Session cleanup
The hook script SHALL delete the session file on `SessionEnd`. Consumers SHALL treat a session as dead when its recorded `pid` is no longer running. Only when no `pid` was recorded SHALL they fall back to treating it as dead once `updated` is older than the configured stale timeout, so a live session left idle for hours keeps its bot.

#### Scenario: Clean exit
- **WHEN** `SessionEnd` fires
- **THEN** the session file no longer exists

#### Scenario: Crashed session
- **WHEN** the Claude process is killed and no `SessionEnd` fires
- **THEN** the overlay stops showing the session once its `pid` is gone or the stale timeout passes

### Requirement: Safe and fast writes
Writes SHALL be atomic (write to temp file in the same directory, then rename) and serialized per session so concurrent hooks do not lose updates. The hook SHALL exit 0 and print nothing to stdout in all cases, including malformed input, so it never blocks or alters Claude Code behavior. A single invocation SHALL complete in under 50ms on typical hardware.

#### Scenario: Concurrent events
- **WHEN** two `PreToolUse` hooks for the same session fire at the same moment
- **THEN** the resulting file is valid JSON and reflects one of the two writes

#### Scenario: Malformed input
- **WHEN** the hook receives invalid JSON on stdin
- **THEN** it exits 0 without writing and without output

### Requirement: Non-destructive installation
Installing the hooks SHALL add entries to `~/.claude/settings.json` without removing or reordering existing hook entries, and SHALL back up the file first. Uninstalling SHALL remove only the entries it added.

#### Scenario: Existing Muxy hooks preserved
- **WHEN** the installer runs on a settings file containing Muxy hooks
- **THEN** all Muxy hook entries remain unchanged and the agent-bots entries are present

#### Scenario: Idempotent install
- **WHEN** the installer runs twice
- **THEN** each agent-bots hook appears exactly once
