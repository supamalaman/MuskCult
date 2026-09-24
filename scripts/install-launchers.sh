#!/usr/bin/env bash
# Install Macro Launch + MuskCult into the desktop app menu and Plank dock.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
DOCK_DIR="$HOME/.config/plank/dock1/launchers"

mkdir -p "$APP_DIR" "$DOCK_DIR"

cat > "$APP_DIR/macro-launch.desktop" <<EOF
[Desktop Entry]
Type=Application
Version=1.0
Name=Macro Launch
Comment=Launch MuskCult and other creative tools
Exec=python3 $ROOT/macro-launch/app.py
Path=$ROOT
Icon=$ROOT/public/favicon.svg
Terminal=false
Categories=AudioVideo;Graphics;Utility;
StartupNotify=true
EOF

cat > "$APP_DIR/muskcult.desktop" <<EOF
[Desktop Entry]
Type=Application
Version=1.0
Name=MuskCult
Comment=Music video maker — cut and reassemble clips
Exec=$ROOT/scripts/run-muskcult.sh
Path=$ROOT
Icon=$ROOT/public/favicon.svg
Terminal=false
Categories=AudioVideo;Graphics;
StartupNotify=true
EOF

cat > "$DOCK_DIR/macro-launch.dockitem" <<EOF
[PlankDockItemPreferences]
Launcher=file://$APP_DIR/macro-launch.desktop
EOF

cat > "$DOCK_DIR/muskcult.dockitem" <<EOF
[PlankDockItemPreferences]
Launcher=file://$APP_DIR/muskcult.desktop
EOF

update-desktop-database "$APP_DIR" 2>/dev/null || true
echo "Installed Macro Launch + MuskCult launchers."
echo "  menu: $APP_DIR"
echo "  dock: $DOCK_DIR"
