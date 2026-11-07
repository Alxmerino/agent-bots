# Agent Bots

**[Website and download](https://alxmerino.github.io/agent-bots/)**

![Four bots along the bottom of a Mac screen: one on a treadmill, one waving a "!" for a permission prompt, one doing flips with two smaller subagent bots, one laying bricks](docs/demo.gif)

Agent Bots puts a strip of small characters along the bottom of your screen, one for every Claude Code session you have running. While its session is working, a bot types at a desk, lays bricks, shovels, sweeps, hits the treadmill, paints, or moonwalks: one move per turn, and a different one every turn until it has done them all. It waves a "!" when Claude is waiting on you for a permission, and lies down to sleep when the turn is done. When a session ends, its bot dies (dramatically) and floats off as a ghost. Subagents show up as smaller bots that follow their parent around.

Hover a bot to see its name, project, current activity, and last tool. Click it to bring its terminal app to the front, whichever terminal or editor you use. Everywhere else, clicks pass straight through the strip. The menu bar icon shows how many sessions are working and lets you switch styles and other settings.

Not a developer? Follow [docs/INSTALL.md](docs/INSTALL.md) instead; it installs from a `.dmg` with no Terminal.

It runs on macOS only and works with Claude Code in any terminal.

## What you need

- macOS
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) 2.1 or newer (the hook relies on `SubagentStart` and async hooks)
- `jq` (`brew install jq`)
- Rust (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`)
- Node 22 or newer, plus pnpm

## What the installer changes

`scripts/install.sh` copies `hook/hook.sh` to `~/.agentbots/hook.sh` and registers it in `~/.claude/settings.json` for eleven Claude Code hook events. It saves a timestamped backup of your settings first (`settings.json.agentbots-backup.<date>`) and leaves every existing hook alone, so it's safe alongside Muxy's hooks or anything else you have. Running it twice won't add duplicates.

The hook runs on every tool call in every Claude Code session. It reads the event Claude Code sends it, writes one small JSON file per session to `~/.agentbots/sessions/`, and exits. It never prints anything or blocks Claude, and the tool-call events run async so they don't slow anything down. Nothing leaves your machine.

## Install

1. Install the hook:

   ```bash
   scripts/install.sh
   ```

2. Run the app:

   ```bash
   cd app
   pnpm install
   pnpm tauri dev
   ```

3. Start a new Claude Code session (or send a prompt in an existing one). Its bot appears within a second.

To try a release build locally, run `pnpm tauri build` in `app/`. That produces `app/src-tauri/target/release/bundle/dmg/Agent Bots_<version>_aarch64.dmg` (Apple silicon only). A local build isn't signed with a Developer ID, so it's fine on your own Mac but Gatekeeper blocks it on others. Signed builds are on the [Releases](https://github.com/Alxmerino/agent-bots/releases) page. On first launch, the installed app asks to connect to Claude Code. Connecting does what `scripts/install.sh` does and also turns on start at login. **Connect** and **Disconnect** in the menu replace the scripts for anyone who installs from the `.dmg`.

## Uninstall

```bash
scripts/uninstall.sh
rm -rf ~/.agentbots
```

The uninstaller backs up your settings and removes only the hook entries it added.

## Options

Everything lives in the menu bar icon, and changes apply right away. You can switch the style (Bots, Critters, Dogs, Cats, Aliens, or Blobs), move the bots to the bottom left (the default) or bottom right of the screen, change the bot size and walk speed, and whether names and subagents show. You can also hide the strip when no agents are running, have it follow your cursor to another display, and set how long a session with no process ID can go quiet before its bot is cleared. Settings are saved to `~/.agentbots/config.json`.

## Adding a style

Each style is one file in `app/src/skins/` (the code calls a style a skin). Create a file that exports a `Skin` (the contract and helpers are in `app/src/skins/types.ts`), then add it to `SKINS` in `app/src/skins/index.ts`. The menu picks it up on the next launch, with no Rust changes. Every style gets the same poses, so all the activities and the death animation work without extra code. Most styles call the `chibi()` helper, which draws the shared big-head body, and add their own ears, tails, and accessories on top. The renderer adds the dark outline to every style. The `lie` function decides what lying down means for your character: most styles tip over, and blobs flatten instead (they handle it in `draw`).

To preview your style, run `pnpm dev` in `app/` and open `http://localhost:1420/poses.html?skin=<id>`. That page draws every activity at several points in time. The plain `http://localhost:1420/` page runs the strip in a browser with fake sessions and a control panel.

## Recording a demo

With the app running, start a screen recording (Cmd+Shift+5) and run `scripts/demo.sh`. It plays a scripted scene of about a minute with fake sessions (working, a permission prompt, subagents, a nap, a death) and removes them when it exits.

## Known limitations

- The strip doesn't show over fullscreen apps. It does show on every Space.
- Clicking a bot brings its terminal app forward, not the exact tab or window. Sessions inside tmux or over ssh have no app to bring forward, so clicking them does nothing.
- Only Claude Code sessions started in a terminal get a bot. The Claude desktop app (chat, Cowork, and its Code tab) isn't supported.

## How it's put together

`hook/hook.sh` is the whole data layer, with tests in `hook/test.sh` (run it directly). The app in `app/` is Tauri v2. The Rust side in `app/src-tauri/src/lib.rs` watches the sessions folder, checks whether each session's Claude process is still alive, streams the cursor position so the window can let clicks pass through except over a bot, finds the terminal app above a session's process when you click it, and builds the menu. The TypeScript side in `app/src/` draws the bots on a canvas. See [CONTRIBUTING.md](CONTRIBUTING.md) to send a change.
