## ADDED Requirements

### Requirement: Menu bar icon with working count
The app SHALL show a menu bar icon whose title displays the number of sessions in `working` state, and SHALL update it within 1 second of a change.

#### Scenario: Two working
- **WHEN** two sessions are `working` and one is `idle`
- **THEN** the menu bar shows a count of 2

### Requirement: Live session list
The menu SHALL list every live session with bot name, project name and state. Selecting an entry SHALL focus that session's terminal.

#### Scenario: Open menu
- **WHEN** the user opens the menu with three live sessions
- **THEN** three entries appear showing project and state

#### Scenario: Select entry
- **WHEN** the user selects a session entry
- **THEN** that session's terminal is brought to the front

### Requirement: Display options
The menu SHALL offer these options: show/hide bots; show names (on/off); style (one entry per registered skin); bot size (S, M, L); walk speed (slow, normal, fast); show subagents (on/off); hide strip when no sessions (on/off); position (bottom left by default, bottom right); display (primary, follow cursor); stale timeout (10, 30, 60 minutes). Changing an option SHALL apply immediately without restarting the app.

#### Scenario: Change size
- **WHEN** the user selects bot size L
- **THEN** all bots redraw at the large size immediately

#### Scenario: Change style
- **WHEN** the user selects style Dogs
- **THEN** every bot redraws as a dog immediately, keeping its current activity

#### Scenario: Hide when empty
- **WHEN** "Hide strip when no sessions" is on and the last session ends
- **THEN** the strip window is hidden, and shown again when a session starts

#### Scenario: Follow cursor
- **WHEN** display is set to follow cursor and the cursor moves to another display
- **THEN** the strip moves to that display's Dock edge

### Requirement: Settings persistence
Options SHALL be saved to `~/.agentbots/config.json` on change and loaded at startup. A missing or invalid file SHALL fall back to defaults, and missing fields SHALL take their defaults individually (show bots, names on, style Bots, size M, speed normal, subagents on, hide-when-empty off, primary display, stale 30 min).

#### Scenario: Restart
- **WHEN** the user sets speed to fast and restarts the app
- **THEN** speed is still fast

#### Scenario: Corrupt config
- **WHEN** `config.json` contains invalid JSON
- **THEN** the app starts with defaults

### Requirement: Start at login and quit
The menu SHALL offer a "Start at login" toggle that registers or removes a login item, and a "Quit" item that exits the app.

#### Scenario: Enable start at login
- **WHEN** the user turns on "Start at login" and logs out and back in
- **THEN** the app launches automatically

#### Scenario: Quit
- **WHEN** the user selects Quit
- **THEN** the strip and menu bar icon disappear and the process exits
