#!/usr/bin/env bash
# Build a signed, notarized Agent Bots release and publish it on GitHub, where installed apps pick
# it up within 6 hours (or right away from "Check for updates…" in the menu).
#
#   1. Bump the version in app/src-tauri/tauri.conf.json, app/src-tauri/Cargo.toml and app/package.json.
#   2. scripts/release.sh "What changed, in a sentence or two"
#
# Maintainer only. Forks: set AGENTBOTS_REPO and use your own certificate and updater key.
# One-time setup on the release Mac:
#   - gh, logged in with write access to the repo
#   - APPLE_SIGNING_IDENTITY: a "Developer ID Application: Name (TEAMID)" certificate in the keychain
#     (create it in your Apple Developer account; security find-identity -v -p codesigning shows the name)
#   - notarization credentials: APPLE_API_KEY + APPLE_API_ISSUER + APPLE_API_KEY_PATH,
#     or APPLE_ID + APPLE_PASSWORD (app-specific password) + APPLE_TEAM_ID
#   - the updater signing key at ~/.tauri/agent-bots.key (override with AGENTBOTS_KEY). Create it with
#     `cd app && pnpm tauri signer generate -w ~/.tauri/agent-bots.key`, paste the .pub contents into
#     plugins.updater.pubkey in tauri.conf.json, and keep a backup of the private key and its password
#     (TAURI_SIGNING_PRIVATE_KEY_PASSWORD). Lose either and installed apps can't update.
#
# The newest .dmg is always at https://github.com/$REPO/releases/latest/download/Agent-Bots.dmg.
set -euo pipefail

REPO="${AGENTBOTS_REPO:-Alxmerino/agent-bots}"
KEY="${AGENTBOTS_KEY:-$HOME/.tauri/agent-bots.key}"
NOTES="${1:-}"
cd "$(dirname "$0")/../app"

die() { echo "$*" >&2; exit 1; }
VERSION="$(jq -r .version src-tauri/tauri.conf.json)"
TAG="v$VERSION"

[[ -f "$KEY" && -f "$KEY.pub" ]] || die "No updater key at $KEY. Create one: pnpm tauri signer generate -w $KEY"
[[ "$(jq -r .plugins.updater.pubkey src-tauri/tauri.conf.json)" == "$(<"$KEY.pub")" ]] ||
  die "plugins.updater.pubkey in tauri.conf.json doesn't match $KEY.pub. Paste the contents of $KEY.pub there."
[[ -n "${APPLE_SIGNING_IDENTITY:-}" ]] ||
  die "Set APPLE_SIGNING_IDENTITY (security find-identity -v -p codesigning lists yours)."
[[ -n "${APPLE_API_KEY:-}" || -n "${APPLE_ID:-}" ]] ||
  die "Set notarization credentials (APPLE_API_KEY/APPLE_API_ISSUER/APPLE_API_KEY_PATH or APPLE_ID/APPLE_PASSWORD/APPLE_TEAM_ID)."
if gh release view "$TAG" -R "$REPO" >/dev/null 2>&1; then
  die "$TAG is already released. Bump the version first."
fi

export TAURI_SIGNING_PRIVATE_KEY="$(<"$KEY")" TAURI_SIGNING_PRIVATE_KEY_PASSWORD="${TAURI_SIGNING_PRIVATE_KEY_PASSWORD:-}"
# Updater artifacts (.app.tar.gz + .sig) are only built here, so plain builds don't need the key.
# Tauri signs with APPLE_SIGNING_IDENTITY and notarizes when the Apple credentials are set.
pnpm tauri build --config '{"bundle":{"createUpdaterArtifacts":true}}'

B=src-tauri/target/release/bundle
DMG="$(ls "$B"/dmg/*_"$VERSION"_aarch64.dmg)"
spctl -a -t exec -vv "$B/macos/Agent Bots.app" || die "Gatekeeper rejects the app; check signing and notarization."

# Tauri notarizes only the .app; notarize and staple the .dmg too so the download itself passes Gatekeeper.
if [[ -n "${APPLE_API_KEY:-}" ]]; then
  NOTARY=(--key "$APPLE_API_KEY_PATH" --key-id "$APPLE_API_KEY" --issuer "$APPLE_API_ISSUER")
else
  NOTARY=(--apple-id "$APPLE_ID" --password "$APPLE_PASSWORD" --team-id "$APPLE_TEAM_ID")
fi
NOTARIZED="$(xcrun notarytool submit "$DMG" "${NOTARY[@]}" --wait)"
echo "$NOTARIZED"
grep -q 'status: Accepted' <<<"$NOTARIZED" || die "Apple rejected the .dmg; run xcrun notarytool log <id> for details."
xcrun stapler staple "$DMG"
spctl -a -t open --context context:primary-signature -vv "$DMG" || die "Gatekeeper rejects the .dmg."

OUT="$(mktemp -d)"
# Fixed asset names, so https://github.com/$REPO/releases/latest/download/Agent-Bots.dmg always works.
cp "$B/macos/Agent Bots.app.tar.gz" "$OUT/Agent-Bots-aarch64.app.tar.gz"
cp "$DMG" "$OUT/Agent-Bots.dmg"
jq -n --arg v "$VERSION" --arg notes "$NOTES" --arg date "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg sig "$(<"$B/macos/Agent Bots.app.tar.gz.sig")" \
  --arg url "https://github.com/$REPO/releases/download/$TAG/Agent-Bots-aarch64.app.tar.gz" \
  '{version: $v, notes: $notes, pub_date: $date, platforms: {"darwin-aarch64": {signature: $sig, url: $url}}}' \
  >"$OUT/latest.json"

gh release create "$TAG" -R "$REPO" --title "Agent Bots $VERSION" --notes "${NOTES:-Agent Bots $VERSION}" \
  "$OUT/Agent-Bots.dmg" "$OUT/Agent-Bots-aarch64.app.tar.gz" "$OUT/latest.json"
echo "Released $TAG: https://github.com/$REPO/releases/tag/$TAG"
