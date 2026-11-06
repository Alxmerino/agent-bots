## ADDED Requirements

### Requirement: Focus terminal on click
Clicking a bot (or selecting its menu entry) SHALL bring the terminal app hosting that session to the front, chosen from the session's `term_program` and `muxy_session_id`.

#### Scenario: Muxy session
- **WHEN** the user clicks a bot whose session has a `muxy_session_id`
- **THEN** Muxy becomes the frontmost app

#### Scenario: iTerm session
- **WHEN** the user clicks a bot whose `term_program` is `iTerm.app`
- **THEN** iTerm becomes frontmost

#### Scenario: Unknown terminal
- **WHEN** `term_program` is missing or unrecognized (including sessions without a terminal)
- **THEN** nothing is launched and the click causes no error

### Requirement: Exact tab focus where supported
Where the terminal exposes a way to select a specific tab or pane, the app SHALL focus the exact tab running the session. Where it does not, focusing the app alone SHALL be accepted.

#### Scenario: Muxy without tab API
- **WHEN** no Muxy tab-selection mechanism is available
- **THEN** clicking activates Muxy only and logs no error to the user
