# Contributing

Thanks for helping out. Bug fixes, new styles, and small improvements are all welcome.

## Before you start

For anything bigger than a bug fix or a new style, open an issue first so we can agree on the approach before you put time into it.

Agent Bots is macOS only and works with Claude Code in any terminal. Changes that assume a specific terminal app won't be merged.

## Setup

You need everything in [What you need](README.md#what-you-need). Then:

```bash
scripts/install.sh   # registers the hook in ~/.claude/settings.json (backs it up first)
cd app
pnpm install
pnpm tauri dev
```

Most frontend work doesn't need Tauri at all: `pnpm dev` and open `http://localhost:1420/` for the strip with fake sessions and a control panel, or `http://localhost:1420/poses.html?skin=<id>` to see every pose of a style. To add a style, see [Adding a style](README.md#adding-a-style).

## Before opening a PR

Run these and make sure they pass:

```bash
hook/test.sh                       # hook tests
cd app && pnpm build               # typecheck and frontend build
cd src-tauri && cargo test && cargo clippy
```

If you changed `hook/hook.sh`, add or update a case in `hook/test.sh`. The hook runs on every tool call in every Claude Code session, so it must stay fast, never print anything, and never block Claude.

In the PR, say what changed and why, and how you tested it. A screenshot or short recording helps for anything visual.

## Releases

Releases are signed with the maintainer's Apple Developer ID and updater key, so only the maintainer cuts them. Don't bump version numbers in a PR. If you fork the project and want to ship your own builds, see the header of `scripts/release.sh`.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
