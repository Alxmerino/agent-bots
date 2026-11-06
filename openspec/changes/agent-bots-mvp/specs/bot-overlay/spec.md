## ADDED Requirements

### Requirement: Overlay strip window
The app SHALL show one transparent, borderless, always-on-top window spanning the left or right half (per the Position setting, left by default) of the target display's usable area (excluding the menu bar and Dock), flush with the bottom of that area so it sits above a bottom Dock and beside a side Dock, with no Dock icon or app switcher entry.

#### Scenario: App launched
- **WHEN** the app starts
- **THEN** a transparent strip appears on the bottom-left half of the display, above the Dock, with no window chrome and no Dock icon

#### Scenario: Dock on the side or Dock moved
- **WHEN** the Dock is on the left or right, or the user moves the Dock or changes the display resolution while the app runs
- **THEN** within a second the strip sits at the bottom of the usable area, on the chosen half, without overlapping the Dock

#### Scenario: Visible on every Space
- **WHEN** the user switches Spaces
- **THEN** the strip stays visible

Known limitation: the strip does not appear over fullscreen apps. Accepted for the MVP; a non-activating NSPanel is the likely fix if needed later.

### Requirement: Click-through outside bots
The strip SHALL pass mouse events through to windows below except while the cursor is over a bot's hitbox.

#### Scenario: Click empty area
- **WHEN** the user clicks a point in the strip with no bot
- **THEN** the click reaches the window underneath

#### Scenario: Click a bot
- **WHEN** the user clicks a bot
- **THEN** the app receives the click

### Requirement: One bot per live session
The overlay SHALL show exactly one bot per live session file and SHALL add or remove bots within 1 second of a session file being created, changed, or deleted. Each bot's color SHALL be derived deterministically from its project name.

#### Scenario: New session
- **WHEN** a session file appears
- **THEN** a new bot appears within 1 second

#### Scenario: Session ends
- **WHEN** a session file is deleted or the session is judged dead
- **THEN** its bot disappears after its death animation

#### Scenario: Same project, same color
- **WHEN** two sessions share a project name
- **THEN** their bots have the same color

### Requirement: State animation
While its session is `working`, a bot SHALL cycle through randomly chosen activities, each lasting several seconds: running to a random point, moonwalking, robot dance, jumping jacks, flips, and painting. While `idle`, a bot SHALL stop moving and cycle through rest activities: yawning, lying down, and sleeping (with "z"). While `waiting`, a bot SHALL stand still with an alert indicator ("!").

#### Scenario: Working
- **WHEN** a session's state becomes `working`
- **THEN** its bot performs one of the working activities and switches to another random one after it finishes

#### Scenario: Working variety
- **WHEN** a bot has been `working` for one minute
- **THEN** it has performed at least three different activities

#### Scenario: Idle
- **WHEN** state becomes `idle`
- **THEN** the bot stops, yawns, lies down, then sleeps

### Requirement: Dramatic death on session end
When a session ends or is judged dead, its bot SHALL play a dramatic death animation lasting 2 to 4 seconds (for example: clutching chest, staggering, falling over, a ghost floating up) before being removed. Mini bots of that session SHALL die with it.

#### Scenario: Session exits
- **WHEN** a session file is deleted
- **THEN** its bot plays the death animation and is removed when the animation ends

#### Scenario: Session returns during death
- **WHEN** a session file reappears with the same id before the death animation finishes
- **THEN** the bot is revived instead of a duplicate being created

#### Scenario: Waiting
- **WHEN** state becomes `waiting`
- **THEN** the bot stops and shows the alert indicator

### Requirement: Subagent mini bots
When enabled in settings, each entry in a session's `subagents` SHALL appear as a smaller bot that follows its parent bot. Mini bots SHALL disappear when their entry is removed.

#### Scenario: Subagent appears
- **WHEN** a session gains a subagent entry
- **THEN** a mini bot appears next to the parent

#### Scenario: Disabled
- **WHEN** "Show subagents" is off
- **THEN** no mini bots are drawn

### Requirement: Hover tooltip
Hovering a bot SHALL show a tooltip with the bot's name, project name, current activity, state, last tool, and subagent count. Hover SHALL work while the app is not focused.

#### Scenario: Hover
- **WHEN** the cursor rests on a bot
- **THEN** a tooltip shows its name, project, activity, state, last tool, and subagent count, even though another app is focused

### Requirement: Resource budget
The app (including its WebKit helper processes) SHALL use less than 90MB memory, under 10% CPU on average while at least one bot is working, and less when all bots sleep. Animation SHALL run at 12fps while bots move and 5fps while all sleep, scheduled by timer rather than per display refresh, and SHALL stop entirely when there are no bots.

The original 2% target is not reachable with a WebView renderer: WebKit costs about 0.6% CPU per frame per second regardless of how much is drawn. Measured on an Apple Silicon Mac with one working and one sleeping bot: 22% at 30fps with one full-width canvas, 13% at 20fps with per-bot layers and timer scheduling, 8.5% at 12fps (about 80MB). The outline (each character drawn four extra times as a silhouette) measured about 10% with one working and two sleeping bots; an offscreen-canvas outline cost about 14% and was dropped. A native renderer (Swift/CALayer) would be the path to ~1-2% if that ever matters.

#### Scenario: Working load
- **WHEN** one bot works and one sleeps for one minute
- **THEN** total CPU across the app and its WebKit processes averages under 10% and memory stays under 90MB

#### Scenario: No bots
- **WHEN** no sessions are running
- **THEN** the app draws nothing and schedules at most one check per second

### Requirement: Selectable character skins
The overlay SHALL draw every bot with the selected skin. Skins: Bots (default), Critters, Dogs, Cats, Aliens, Blobs. Skins SHALL share a chibi style: big round head, small body, stubby limbs, tall dot eyes with blush, and a 1-pixel dark outline drawn by the renderer for every skin. Every skin SHALL support every activity, including lying down and death. Skins SHALL be defined in a registry so a new skin can be added by creating one file and one registry entry, with no changes to activities or the menu.

#### Scenario: Blob rests and dies sensibly
- **WHEN** the style is Blobs and a bot lies down or dies
- **THEN** it flattens to rest and melts into a puddle when dead, instead of tipping over

#### Scenario: New skin appears in the menu
- **WHEN** a developer adds a skin to the registry and restarts the app
- **THEN** the Style menu lists it without any Rust change

### Requirement: Name tags
When "Show names" is on, each session bot SHALL show its name in a small tag under its feet, and the strip SHALL grow to fit the tags. The tag SHALL fade out with the bot's death animation.

#### Scenario: Names on
- **WHEN** show names is on
- **THEN** each session bot has its name under it

#### Scenario: Names off
- **WHEN** show names is off
- **THEN** no tags are drawn and the strip returns to its smaller height
