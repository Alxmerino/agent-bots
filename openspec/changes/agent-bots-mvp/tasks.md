## 1. Session state (hook)

- [x] 1.1 Verify hook events and payloads in installed Claude Code: log raw stdin for SessionStart, UserPromptSubmit, PreToolUse, Notification, PermissionRequest, Stop, SubagentStart, SubagentStop, SessionEnd to a temp file; record field names for session id, cwd, tool name, agent id, agent type
- [x] 1.2 Write `hook/hook.sh`: parse stdin with jq, map event to state, create file if missing, record muxy_session_id, term_program, tty, pid (walk up to `claude` process)
- [x] 1.3 Add subagent add/remove and clear-on-Stop logic (or Task-tool fallback if SubagentStart missing)
- [x] 1.4 Add per-session mkdir lock, temp-file + mv writes, exit 0 and silent on all errors
- [x] 1.5 Write `scripts/install.sh` (backup settings.json, idempotent jq merge) and `scripts/uninstall.sh`
- [x] 1.6 Test: fixture-driven script that pipes sample payloads through hook.sh and asserts resulting JSON; concurrent-write test; malformed-input test
- [x] 1.7 Measure hook runtime with `hyperfine` (< 50ms); install for real and watch `~/.agentbots/sessions/` during a live session

## 2. App skeleton

- [x] 2.1 Install Rust via rustup; scaffold Tauri v2 app with Vite + vanilla TS in `app/`
- [x] 2.2 Configure window: transparent, no decorations, always on top, skip taskbar, Accessory activation policy, visible on all workspaces
- [x] 2.3 Position strip at bottom of primary display work area, full width
- [x] 2.4 Rust: watch sessions folder with `notify` (debounced), parse files, filter dead PIDs and stale entries, emit `sessions-changed`; emit full list on frontend load
- [x] 2.5 Frontend: draw one colored square per session (color hashed from project); verify add/remove within 1s
- [x] 2.6 Verify strip visible across Spaces and over fullscreen app; add objc2 collection-behavior fix if not (Spaces OK; fullscreen not working, accepted as known limitation)

## 3. Interaction

- [x] 3.1 Rust: cursor-position polling (~30Hz, only while bots visible), send to frontend
- [x] 3.2 Frontend: hitbox test, toggle ignore-cursor-events command; verify clicks pass through empty strip areas
- [x] 3.3 Hover tooltip with project, state, last tool, subagent count

## 4. Bots and animation

- [x] 4.1 Bot drawn procedurally from parts (head, body, arms, legs, antenna) so poses can be animated without hand-drawn frames per activity
- [x] 4.2 Renderer with per-project tint, pixel snapping, nearest-neighbor scaling
- [x] 4.3 Activity system: each state has a pool of timed activities; pick random next, no immediate repeat
- [x] 4.4 Working activities: run, moonwalk, robot dance, jumping jacks, flip, painting (leaves paint dabs that fade)
- [x] 4.5 Idle sequence: yawn → lie down → sleep with "z"; waiting: alert "!" bounce
- [x] 4.6 Death animation (clutch, stagger, fall, ghost floats up); remove after; revive if session returns
- [x] 4.8 Skin registry (robot, critters, dogs, cats, aliens); `lie` pose so each skin decides how to rest and die
- [x] 4.9 Random names from hook; optional name tags under bots
- [x] 4.7 Subagent mini bots following parent; appear/disappear with entries; die with parent

## 5. Terminal focus

- [x] 5.1 Rust `focus_session` command: Muxy → `open -a Muxy`; iTerm → AppleScript select by tty; Ghostty → `open -a Ghostty`; unknown → no-op
- [x] 5.2 Wire bot click to `focus_session`
- [x] 5.3 Investigate `muxy-hook` binary for a focus-by-session command; implement exact tab focus if found, otherwise record finding in design.md

## 6. Menu bar and settings

- [x] 6.1 Config load/save in Rust with defaults and invalid-file fallback; emit `config-changed`
- [x] 6.2 Tray icon with working-count title, updated on sessions change
- [x] 6.3 Live session list items calling `focus_session`
- [x] 6.4 Option items: show/hide, size, speed, subagents, hide-when-empty, display (primary / follow cursor), stale timeout; frontend applies live
- [x] 6.6 Menu: Show names toggle and Style submenu fed by the frontend skin registry
- [x] 6.5 Start at login via `tauri-plugin-autostart`; Quit

## 7. Verification

- [ ] 7.1 Run through every scenario in the four specs with two real sessions in different Muxy tabs
- [x] 7.2 Measure memory and CPU (measured 8.5% CPU / ~80MB at 12fps; budget revised in bot-overlay spec)
- [x] 7.3 Kill a session with `kill -9`; confirm bot disappears via PID check (Rust test `dead_and_stale_sessions_are_dropped`)
- [ ] 7.4 Build release `.app`, copy to /Applications, enable start at login, reboot test

## 8. Packaging for non-developers

- [x] 8.1 Hook prefers system `/usr/bin/jq`
- [x] 8.2 Bundle hook in the app; Rust connect/disconnect (settings merge with preserved key order, backup), refresh hook on launch
- [x] 8.3 First-launch "Connect to Claude Code?" prompt; menu shows connection state with Connect/Disconnect
- [x] 8.4 Release builds enable start at login on connect; debug builds never do
- [x] 8.5 Real app icon
- [x] 8.6 Ad-hoc signed `.dmg` build
- [x] 8.7 One-page install guide for non-developers (including the "Open Anyway" step)

## 9. v0.2: cuter bots, position, updates

- [x] 9.1 Place the strip with AppKit points (fixes mid-screen strip on Retina / side Dock); re-check placement every 0.5s
- [x] 9.2 Position option: bottom left (default) / bottom right
- [x] 9.3 Drop Claude desktop app support (no `open -a Claude` fallback; guide and README say terminal only)
- [x] 9.4 Chibi redraw of all skins with renderer-drawn outline
- [x] 9.5 Blobs skin
- [x] 9.6 Auto-updater (tauri-plugin-updater, signed, GitHub releases) and `scripts/release.sh`; verified locally 0.2.0 → 0.2.1
- [ ] 9.7 Confirm the strip position on a Retina MacBook with the Dock on the side
- [ ] 9.8 First real release once the repo is public: publish v0.2.0, then v0.2.1 to confirm installed apps update
- [x] 9.9 Move to personal repo (Alxmerino/agent-bots): identifier, authors, MIT license, URLs; release script requires Developer ID signing, notarization, and a matching updater key
