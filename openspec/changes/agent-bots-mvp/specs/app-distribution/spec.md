## ADDED Requirements

### Requirement: Installable without a terminal
The app SHALL ship as a `.dmg` containing a `.app` signed with a Developer ID and notarized by Apple (so Gatekeeper opens it without workarounds), so a non-developer can install it by dragging it to Applications. The hook script SHALL be bundled inside the app, and SHALL use the system `jq` at `/usr/bin/jq` (macOS 15 and later), so no Homebrew or other developer tools are needed.

#### Scenario: Fresh Mac
- **WHEN** a user with only macOS 15+ and Claude Code installs the app from the `.dmg`
- **THEN** the app runs and its hook works without installing anything else

### Requirement: Connect to Claude Code from the app
On first launch, the app SHALL ask the user whether to connect to Claude Code. Connecting SHALL copy the bundled hook to `~/.agentbots/hook.sh` and register it in `~/.claude/settings.json` with the same behavior as `scripts/install.sh` (backup first, existing hooks untouched, no duplicates, key order preserved). The menu SHALL show whether the app is connected and offer Connect or Disconnect. Disconnecting SHALL remove only the app's hook entries. The app SHALL refresh `~/.agentbots/hook.sh` on launch while connected, so an app update also updates the hook.

#### Scenario: First launch
- **WHEN** the app starts for the first time
- **THEN** it asks to connect to Claude Code, and does nothing to `settings.json` unless the user agrees

#### Scenario: Declined
- **WHEN** the user declines
- **THEN** the app does not ask again on later launches, and the menu offers "Connect to Claude Code…"

#### Scenario: Disconnect
- **WHEN** the user chooses Disconnect
- **THEN** only the app's hook entries are removed from `settings.json`, after a backup

#### Scenario: Compatible with the script installer
- **WHEN** a developer installed with `scripts/install.sh` and then opens the app
- **THEN** the app shows as connected and doesn't add duplicate entries

### Requirement: Start at login by default for installed builds
After the user connects, a release build SHALL turn on start at login. Debug builds SHALL never register a login item.

#### Scenario: Connect in release build
- **WHEN** the user connects in the installed app
- **THEN** "Start at login" is on

### Requirement: Terminal sessions only
Agent Bots SHALL support Claude Code sessions started from a terminal. The Claude desktop app (chat, Cowork, and its Code tab) is out of scope, and the install guide SHALL say so.

#### Scenario: Desktop app user reads the guide
- **WHEN** someone who only uses the Claude desktop app reads the install guide
- **THEN** it tells them Agent Bots won't show their sessions before they install

### Requirement: Automatic updates
Installed release builds SHALL check a public GitHub release feed (`latest.json`) at launch and every 6 hours, download and install a newer signed version in the background, and offer to restart. Updates SHALL be signed with the project's updater key and rejected if the signature doesn't verify. The menu SHALL offer "Check for updates…", replaced by "Restart to update to <version>" once an update is installed. Debug builds SHALL never update themselves. Builds without the private key SHALL still succeed; only the release script produces updater artifacts.

#### Scenario: New version published
- **WHEN** a newer release is published and an installed app checks
- **THEN** the app replaces itself with the new version and asks whether to restart now, and the next launch runs the new version either way

#### Scenario: Already current
- **WHEN** the user picks "Check for updates…" and no newer release exists
- **THEN** the app says it's on the latest version

#### Scenario: Release
- **WHEN** the maintainer bumps the version and runs `scripts/release.sh`
- **THEN** a GitHub release is created with the signed update bundle, `latest.json`, and a `.dmg` at a fixed download URL
