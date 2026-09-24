#!/usr/bin/env bash
# Install Macro.app into /Applications (or ~/Applications) with MuskCult wired in.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/macos/Macro.app"
DEST_DIR="${MACRO_APP_DIR:-/Applications}"
DEST="$DEST_DIR/Macro.app"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This installer targets macOS. On Linux, use: npm run macro-launch"
  echo "Bundle is prepared at: $SRC"
  # Still refresh the bundle resources from the repo copy of tools.json
  cp "$ROOT/macro-launch/tools.json" "$SRC/Contents/Resources/tools.json"
  chmod +x "$SRC/Contents/MacOS/Macro"
  echo "Updated bundle contents for later copy to a Mac."
  exit 0
fi

if [[ ! -d "$SRC" ]]; then
  echo "Missing $SRC" >&2
  exit 1
fi

# Keep tools.json in sync with the repo
cp "$ROOT/macro-launch/tools.json" "$SRC/Contents/Resources/tools.json"
chmod +x "$SRC/Contents/MacOS/Macro"

# Prefer a writable Applications folder
if [[ ! -w "$DEST_DIR" ]]; then
  DEST_DIR="$HOME/Applications"
  DEST="$DEST_DIR/Macro.app"
  mkdir -p "$DEST_DIR"
fi

echo "Installing Macro Launch → $DEST"
rm -rf "$DEST"
mkdir -p "$DEST_DIR"
cp -R "$SRC" "$DEST"
chmod +x "$DEST/Contents/MacOS/Macro"

# Remember where MuskCult lives for the app
defaults write com.muskcult.macro-launch MuskCultHome "$ROOT" 2>/dev/null || true
# Also drop a small pointer file Macro.app can read
echo "$ROOT" > "$DEST/Contents/Resources/muskcult-home.txt"

# Ensure Documents/Apps layout (matches Four-Panel)
APPS_DIR="$HOME/Documents/Apps/MuskCult"
if [[ ! -e "$APPS_DIR" ]]; then
  mkdir -p "$HOME/Documents/Apps"
  ln -s "$ROOT" "$APPS_DIR"
  echo "Linked $APPS_DIR → $ROOT"
fi

echo "Done. Open with: open \"$DEST\""
echo "Or from Spotlight: Macro Launch"
