## Context

Several Claude Code sessions run in parallel inside Muxy (a macOS terminal app) across tabs and projects. Muxy already registers its own Claude Code hooks in `~/.claude/settings.json`, calling `~/Library/Application Support/Muxy/hooks/muxy-claude-hook.sh`, which forwards events to Muxy over a local socket. Muxy has no URL scheme and no documented API. Muxy sets `MUXY_SESSION_ID` and `TERM_PROGRAM` in each shell.

Toolchain on the machine: Node 24, pnpm, jq. Rust is not installed.

## Goals / Non-Goals

**Goals:**
- Status of every Claude Code session visible at all times without switching tabs.
- Data layer independent of the UI, so the UI can be replaced later.
- Zero effect on Claude Code behavior or speed.
- Low resource use. This runs all day.

**Non-Goals:**
- Agents other than Claude Code (Codex, Cursor, etc.).
- Controlling sessions from the bots (sending prompts, approving permissions).
- Windows or Linux support.
- Distribution, signing, notarization. Personal tool, built locally.

## Decisions

### State via hooks writing files, not a socket or daemon
Hooks write one JSON file per session to `~/.agentbots/sessions/`; the app watches the folder.
- *Why:* works when the app isn't running (state is ready on launch), debuggable with `cat`, no server to keep alive, survives app crashes.
- *Alternatives:* local socket to the app (state lost when app is down, hook must handle connection errors, as Muxy's log shows it doing today); parsing transcript JSONL files (fragile, undocumented format).

### Hook in bash + jq
- *Why:* jq is already installed, starts in a few ms, and one script handles all events via `hook_event_name` from stdin.
- *Alternatives:* Node script (~40ms startup on every tool call is too slow); compiled Rust binary (fast but adds a build step for the hook; revisit if bash proves slow).
- Concurrency: per-session lock with `mkdir <file>.lock` (atomic on macOS; `flock` isn't installed by default), short retry loop, stale lock removed after 2s. Write to temp file then `mv`.
- Measured ~54ms per call, about 17ms of it bash startup. `PreToolUse`/`PostToolUse` are registered with `async: true` (supported in Claude Code 2.1.x) so they never delay tool calls. All other events stay synchronous so state transitions land in order (an async `Stop` could otherwise race a late `PostToolUse`).
- `Notification` maps by `notification_type`: `permission_prompt`/`elicitation_dialog` → waiting, `idle_prompt` → idle, others ignored.
- PID: record the Claude Code process id by walking up from `$PPID` to the first process whose command is `claude` (hook runs through an intermediate shell). Used for dead-session detection.

### Tauri v2 with plain TypeScript and canvas
- *Why:* small binary and memory footprint (system WebView), transparent always-on-top windows supported, built-in tray API, sprites are easy in canvas. User preferred web tech over Swift.
- *Alternatives:* Electron (~150MB RAM baseline, click-through is harder), native Swift (lightest but user doesn't want to maintain Swift), Raycast (no persistent UI), terminal pane (bound to one tab).
- No frontend framework. One canvas, a `requestAnimationFrame` loop, a few hundred lines of TS. Vite for dev server and build.

### Rust side kept thin
Rust owns: window setup, fs watching (`notify` crate, debounced 100ms), reading and validating session files, PID liveness checks, tray menu, config file I/O, running `open`/`osascript` for focus. Emits `sessions-changed` and `config-changed` events to the frontend. Frontend owns rendering, animation, hit-testing.
- *Why:* fs and process access belong on the native side; keeps frontend free of Tauri fs permissions.

### Click-through by toggling ignore-cursor-events
Window starts with `set_ignore_cursor_events(true)`. A Rust task polls global cursor position at ~30Hz and sends it to the frontend; the frontend checks bot hitboxes and calls back to toggle ignore off when the cursor is over a bot and on when it leaves.
- *Why:* a fully transparent window still blocks clicks on macOS; Tauri has no per-pixel hit-testing.
- *Alternative:* window-per-bot (no polling needed, but many windows to position and animate; harder).
- Polling only runs while at least one bot is visible.

### Spaces and fullscreen visibility
Use Tauri `visible_on_all_workspaces(true)` and `always_on_top(true)`. If the strip doesn't show over fullscreen apps, set `NSWindowCollectionBehavior` `canJoinAllSpaces | fullScreenAuxiliary` and window level `NSStatusWindowLevel` via `objc2` on the raw `NSWindow`. Set `ActivationPolicy::Accessory` to hide from the Dock and app switcher.

### Strip placement
Window height = bot size L + tooltip room (~96px). Position from the display's work area (`visibleFrame`) so it sits just above the Dock wherever the Dock is. If the Dock is on the left or right, place the strip at the bottom of the work area anyway.

### Config
`~/.agentbots/config.json`, written by Rust on each menu change, emitted to the frontend as `config-changed`. Defaults as listed in the menubar-settings spec. Tray menu uses native check/radio items.

### Terminal focus
Map `term_program` to an action:
- Muxy: the bundled CLI (`/Applications/Muxy.app/Contents/MacOS/muxy`) has no tab or pane focus ("Tabs, panes and workspaces belong to UI clients"). `muxy <folder>` opens a folder as a project in the desktop app. So: if the session `cwd` exactly matches a directory from `muxy project list --json`, run `muxy <cwd>` to switch to that project, then `open -a Muxy`. The exact match keeps a click from ever adding a project. Result: project-level focus, not exact tab.
- `iTerm.app`: AppleScript to select the session by tty (store `tty` in the state file).
- `ghostty`: `open -a Ghostty` only.
- Unknown: no-op.

### Bots drawn procedurally, not from sprite sheets
Ten-plus activities (six working, three idle, alert, death) would need dozens of hand-drawn frames. Instead each bot is a small rig of parts (head, body, two arms, two legs, antenna) drawn as pixel rectangles on a low-res offscreen canvas, then scaled up with nearest-neighbor so it still looks pixel-art. Each activity is a function `(t) => pose` returning part offsets and rotations, plus body x/y and rotation (for flips). Adding an activity is one function.
- *Alternative:* sprite sheets (better art control, but every new activity needs new frames).
- Activity system: per-state pool, random pick with no immediate repeat, each activity has a duration. Death is a one-shot sequence; the bot is kept in a `dying` list until it ends.

## Risks / Trade-offs

- [Hook slows Claude Code] → keep script under 50ms; measure with `hyperfine`; replace with small Rust binary if needed.
- [`SubagentStart` hook or its payload fields may not exist in installed Claude Code] → verify first (task 1.1). Fallback: infer subagents from `PreToolUse` with tool `Task`/`Agent` plus `SubagentStop`.
- [Cursor polling costs CPU] → 30Hz only while bots visible; measure against the 2% budget.
- [Strip covers clickable UI right above Dock] → click-through outside bots; size S option; hide toggle.
- [Fullscreen visibility needs private-ish AppKit tweaks] → isolate in one Rust function; acceptable to lose fullscreen support if it breaks.
- [Muxy updates overwrite settings.json hooks] → installer is idempotent; re-run after Muxy updates.
- [Rust not installed] → install `rustup` before task group 2.

## Migration Plan

- Install: `scripts/install.sh` copies `hook.sh` to `~/.agentbots/`, backs up `~/.claude/settings.json`, merges hook entries with jq.
- Rollback: `scripts/uninstall.sh` removes only entries whose command contains `agentbots/hook.sh`; delete `~/.agentbots/`.

## Open Questions

- ~~Muxy tab focus~~: resolved, project-level only (see Terminal focus).
- ~~Subagent payload~~: resolved, `SubagentStart`/`SubagentStop` carry `agent_id` and `agent_type` (Claude Code 2.1.319).
- Should `waiting` also trigger a macOS notification? Out of scope for MVP; Muxy already notifies.
