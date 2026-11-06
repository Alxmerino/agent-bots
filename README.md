# Agent Bots

Agent Bots puts a strip of small characters along the bottom of your screen, one for every Claude Code session you have running. A bot runs, moonwalks, does the robot, or paints while its session is working, waves a "!" when Claude is waiting on you for a permission, and lies down to sleep when the turn is done. When a session ends, its bot dies (dramatically) and floats off as a ghost. Subagents show up as smaller bots that follow their parent around.

Hover a bot to see its name, project, current activity, and last tool. Click it to jump to its terminal. The menu bar icon shows how many sessions are working and lets you switch styles and other settings.

Not a developer? Follow [docs/INSTALL.md](docs/INSTALL.md) instead; it installs from a `.dmg` with no Terminal.

It runs on macOS only. We've tested it with Muxy, and support for iTerm, Ghostty, and Terminal is built in but hasn't been tested yet.

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

To try a release build locally, run `pnpm tauri build` in `app/`. That produces `app/src-tauri/target/release/bundle/dmg/Agent Bots_<version>_aarch64.dmg` (Apple silicon only). A local build isn't signed with a Developer ID, so it's fine on your own Mac but Gatekeeper blocks it on others. Share releases from `scripts/release.sh` instead. On first launch, the installed app asks to connect to Claude Code. Connecting does what `scripts/install.sh` does and also turns on start at login. **Connect** and **Disconnect** in the menu replace the scripts for anyone who installs from the `.dmg`.

## Releasing

Installed apps update themselves from this repo's GitHub releases. They check at launch and every 6 hours (or right away from **Check for updates…** in the menu), install the new version in the background, and offer a restart. To ship a version:

1. Bump the version in `app/src-tauri/tauri.conf.json`, `app/src-tauri/Cargo.toml`, and `app/package.json`.
2. Run `scripts/release.sh "What changed"`.

The script builds the app, signs it with your Developer ID, has Apple notarize it, signs the update bundle, and publishes a release with the `.dmg`, the update bundle, and the `latest.json` feed the apps read. It stops before building if any of the setup below is missing. The newest `.dmg` is always at `https://github.com/Alxmerino/agent-bots/releases/latest/download/Agent-Bots.dmg`, so that's the link to share.

### One-time setup on the release Mac

1. **Developer ID certificate.** In your Apple Developer account, create a "Developer ID Application" certificate and install it in your keychain. `security find-identity -v -p codesigning` shows its full name. Export it in your shell profile:

   ```bash
   export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
   ```

2. **Notarization credentials.** Either an App Store Connect API key (`APPLE_API_KEY`, `APPLE_API_ISSUER`, `APPLE_API_KEY_PATH`) or your Apple ID with an app-specific password (`APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`). Tauri notarizes and staples the app when these are set.

3. **Updater key.** Updates are signed separately from the Apple signature, with a key only you hold:

   ```bash
   cd app && pnpm tauri signer generate -w ~/.tauri/agent-bots.key
   ```

   Paste the contents of `~/.tauri/agent-bots.key.pub` into `plugins.updater.pubkey` in `app/src-tauri/tauri.conf.json` and commit it. Keep a copy of the private key in your password manager. If it's lost, installed apps can't take updates anymore and everyone has to reinstall from a new `.dmg` built with a new key. Plain `pnpm tauri build` doesn't need it.

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

## Known limitations

- The strip doesn't show over fullscreen apps. It does show on every Space.
- Clicking a Muxy session brings Muxy forward and switches to that session's project, but not to the exact tab, because Muxy's CLI doesn't offer tab focus. iTerm sessions should jump to the exact tab (untested).
- Clicking a bot does nothing for terminals other than Muxy, iTerm, Ghostty, and Terminal.
- Only Claude Code sessions started in a terminal get a bot. The Claude desktop app (chat, Cowork, and its Code tab) isn't supported.

## How it's put together

`hook/hook.sh` is the whole data layer, with tests in `hook/test.sh` (run it directly). The app in `app/` is Tauri v2. The Rust side in `app/src-tauri/src/lib.rs` watches the sessions folder, checks whether each session's Claude process is still alive, streams the cursor position so the window can let clicks pass through, and builds the menu. The TypeScript side in `app/src/` draws the bots on a canvas. The design decisions, specs, and task list from the original build are in `openspec/changes/agent-bots-mvp/`.
