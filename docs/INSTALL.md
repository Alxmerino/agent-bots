# Installing Agent Bots

Agent Bots adds a row of little bots along the bottom of your screen, one for each Claude Code session you have open. A bot runs around and dances while Claude is working, waves at you when Claude needs your permission for something, and curls up to sleep when it's done.

Installing takes about two minutes, and you won't need the Terminal.

## Before you start

You'll need a Mac with Apple silicon (an M1 or newer chip) running macOS 15 Sequoia or later. To check, open the Apple menu, choose **About This Mac**, and look at **Chip** and **macOS**. You'll also need Claude Code running in a terminal app (Terminal, iTerm, Ghostty, or Muxy). Agent Bots doesn't work with the Claude desktop app, so chats, Cowork, and the desktop app's Code tab won't get a bot.

## Install

1. Download [Agent-Bots.dmg](https://github.com/Alxmerino/agent-bots/releases/latest/download/Agent-Bots.dmg).
2. Open the downloaded file and drag **Agent Bots** into the **Applications** folder.
3. Open **Agent Bots** from your Applications folder. The first time, your Mac asks whether you're sure you want to open an app downloaded from the internet. Click **Open**.
4. When Agent Bots asks **Connect to Claude Code?**, click **Connect**. This lets Agent Bots see your sessions. "What connecting changes" below explains exactly what it adds.

A robot icon now sits in your menu bar. Start a Claude Code session, or send a message in one you already have open, and its bot appears at the bottom left of your screen within a second or two.

## Using it

Hover over a bot to see its name, which project it's working in, and what it's doing. Click a bot to bring its session to the front. When a session ends, its bot dies dramatically and floats away as a ghost. That's how it tells you the session is over, not a sign that something crashed.

Click the robot icon in your menu bar to change how the bots look (robots, critters, dogs, cats, or aliens), move them to the bottom right of your screen, make them bigger or smaller, slow them down, or hide the name tags. Click any session listed in the menu to jump to it.

Agent Bots starts automatically when you log in. You can turn that off with **Start at login** in the menu.

Agent Bots also keeps itself up to date. When a new version is ready, it asks whether to restart. Click **Restart now**, or click **Later** and it switches over the next time Agent Bots opens. You never need to download it again.

## What connecting changes

Connecting adds a small script to your Claude Code settings so Claude Code can tell Agent Bots when a session starts, works, waits, or stops. Agent Bots backs up your settings before it touches them and leaves everything else in them alone. Nothing it records leaves your Mac.

## If something looks wrong

If no bot shows up, check that the robot icon's menu says **Connected to Claude Code**, then send a new message in your Claude Code session. If a session was already open when you connected, start a new one, since Claude Code only picks up the change in new sessions. Still nothing? [Open an issue](https://github.com/Alxmerino/agent-bots/issues) and describe what you see.

## Removing it

Click the robot icon in your menu bar, choose **Disconnect from Claude Code**, then **Quit Agent Bots**. Disconnecting takes the script back out of your Claude Code settings. Then drag Agent Bots from Applications to the Trash.
