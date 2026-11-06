## Why

Several Claude Code sessions run at once across Muxy tabs and projects, and the only way to know which ones are working, waiting on a permission prompt, or finished is to cycle through tabs. A small always-visible bot per session gives that status at a glance without switching context.

## What Changes

- New Claude Code hook script that records each session's state (working, waiting, idle), last tool, project, and active subagents to one JSON file per session under `~/.agentbots/sessions/`.
- New macOS desktop app (Tauri v2) that draws a transparent, always-on-top strip above the Dock. Each session appears as a bot that walks while working, sleeps while idle, and shows an alert while waiting. Subagents appear as smaller bots next to their parent.
- Clicking a bot brings its terminal to the front.
- New menu bar icon showing the working-agent count, a live session list, and display options persisted to `~/.agentbots/config.json`.
- Hook registration added to `~/.claude/settings.json` next to the existing Muxy hooks. Existing hooks are left untouched.

## Capabilities

### New Capabilities
- `session-state`: hook script, per-session state file format, event-to-state mapping, subagent tracking, cleanup of ended and stale sessions.
- `bot-overlay`: transparent always-on-top strip, bot rendering and animation per state, subagent mini bots, hover tooltip, click-through outside bots, visibility across Spaces and fullscreen apps.
- `menubar-settings`: tray icon with working count, session list, option toggles, config persistence and live apply, start at login, quit.
- `app-distribution`: `.dmg` packaging, bundled hook, connecting to Claude Code from inside the app, start at login, and automatic updates, so designers and PMs can install it once without a terminal.
- `terminal-focus`: bring a session's terminal to the front when its bot or menu entry is clicked.

### Modified Capabilities
None. New project with no existing specs.

## Impact

- **New code:** `~/code/agent-bots/` (hook script, Tauri app: Rust shell plus TypeScript canvas frontend).
- **User config:** `~/.claude/settings.json` gains hook entries; `~/.agentbots/` created for state and config.
- **Dependencies:** Rust toolchain (not yet installed), Tauri v2 CLI, `notify` crate, `tauri-plugin-autostart`, `jq` for the hook script.
- **Performance:** hooks run on every tool call, so the script must finish in well under 50ms. The app should stay under 80MB RAM while idle.
- **Risk:** Muxy exposes no URL scheme or documented API, so focusing the exact tab may not be possible; first version only activates the Muxy app.
