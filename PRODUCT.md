# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

The designed surfaces are the website (`site/`, deployed to GitHub Pages). The product itself is a macOS menu bar app (Tauri v2) whose bots are drawn by the same renderer the site imports from `app/src/`.

## Users

Developers first: people who run several Claude Code sessions in parallel on a Mac and lose track of which one is working, which one is waiting on them for a permission, and which one is done. Non-developers who use Claude Code (designers, PMs) are welcome and can install from the `.dmg` without Terminal (docs/INSTALL.md), but copy, proof and calls to action aim at developers.

## Product Purpose

Agent Bots puts a small pixel character along the bottom of the screen for every running Claude Code session. A bot works while its session works, waves a "!" when Claude needs the user, sleeps when the turn is done, and dies dramatically and floats off as a ghost when the session ends. Subagents appear as smaller bots following their parent. Success for the website right now means downloads, GitHub stars, and contributors.

## Positioning

Delight with a job. Lead with personality (one work animation per turn: typing at a desk, laying bricks, shoveling, sweeping, a treadmill, painting, moonwalking, flips; the death and ghost; six styles), backed by the practical payoff: see at a glance which session needs you, and click a bot to bring its terminal forward or open its desktop session.

Neighboring tools exist and must not be misrepresented: menu bar monitors (cc-status-bar, nudged, clawd-bar, claude-menu) and pixel pets (Claude Pets, a near-identical concept with 21 sprite characters and task text). Differences Agent Bots can truthfully claim: about a 3 MB download, updates itself, subagents as follower bots, works with any terminal and the Claude desktop Code tab, free and open source (MIT). It is signed and notarized, but that is not marketed: users expect an app to open without a warning, so it is table stakes, not a feature (maintainer's decision).

## Operating Context

- Install: download `Agent-Bots.dmg` from the latest GitHub release, drag to Applications, open, click Connect. Connecting adds a hook to `~/.claude/settings.json` (backed up first) and turns on start at login. Disconnect from the menu bar removes it.
- The hook writes one small JSON file per session to `~/.agentbots/sessions/`; nothing leaves the Mac.
- The app sits in the menu bar (pixel bot-face template icon, working count, "!n" for waiting sessions) with settings for style, size, speed, names, position, display and stale timeout.
- Updates install in the background from GitHub releases.
- Releases are cut only by the maintainer; outside contributors send PRs (CONTRIBUTING.md).

## Capabilities and Constraints

- macOS 15 or later on Apple silicon only. Claude Code 2.1 or newer.
- Works with Claude Code in any terminal or editor terminal, and in the Claude desktop app's Code tab (local sessions, worktrees, scheduled-task runs). Desktop chat, Cowork, cloud sessions and SSH sessions run no hooks on the Mac and can't be supported.
- Clicking a bot brings its terminal app to the front, not the exact tab; sessions in tmux or over ssh can't be focused. A desktop session opens at that exact session through the undocumented `claude://code/continue?session=local_<id>` link (falls back to the Code home if it breaks).
- The strip spans half the screen width (bottom left by default, or bottom right) and doesn't show over fullscreen apps.
- Styles: Bots, Critters, Dogs, Cats, Aliens, Blobs. Adding a style is one file in `app/src/skins/`.
- Not affiliated with Anthropic. Claude and Claude Code are Anthropic trademarks; the site and app must not use Anthropic branding.
- Undecided: a custom domain (the site lives at alxmerino.github.io/agent-bots for now).

## Brand Commitments

- Name: Agent Bots.
- Logo: the pixel bot face used as the menu bar icon (`app/src-tauri/icons/tray.png`); the app icon is the chibi robot drawn by the real renderer (`app/icon.html`).
- The bots on any surface come from the app's own renderer, never redrawn or faked, so what visitors see is what they install.
- Voice: plain, friendly, a little playful; short sentences; no hype.

## Evidence on Hand

- Demo GIF: `docs/demo.gif` (756x136, about 57 s); demo video: the maintainer's local `demo.mp4` (1512x272); reproducible with `scripts/demo.sh`.
- Link preview image: `site/public/og.png` (1200x630), regenerated from `site/og.html`.
- Live, interactive bots on the site itself (the hero playground).
- Releases: v0.2.0 and v0.3.0 on GitHub, notarized; auto-update verified from 0.2.0 to 0.3.0.
- None yet: testimonials, user counts, download numbers, press, or star counts. Do not fabricate any of these.

## Product Principles

1. Show, don't describe: real bots doing real animations beat any explanation.
2. The fun has a job: every animation maps to a session state the user needs to know.
3. Stay out of the way: click-through everywhere except the bots, tiny footprint, nothing leaves the Mac.
4. Honest about scope: macOS only, terminal and desktop Code tab sessions only, app-level terminal focus. Say limits plainly.
5. Easy to extend: styles and animations are small, self-contained additions that invite contributors.

## Accessibility & Inclusion

The site respects `prefers-reduced-motion` (bots freeze), keeps text contrast at WCAG AA, uses 44px touch targets and visible focus rings, and treats animated canvases as decorative (`aria-hidden`) with text carrying the meaning. Lighthouse accessibility currently scores 100; keep it there.
