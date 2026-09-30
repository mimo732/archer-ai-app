#!/bin/bash
# ARCHER AI — Windows portable build (no wine needed)
# Electron win32-x64 prebuilt + ARCHER sources → ARCHER/ARCHER.exe → ARCHER-Windows.zip
set -euo pipefail

W=/home/z/my-project/scripts/winbuild
DL=/home/z/my-project/scripts/apkbuild/dl
OUT=/home/z/my-project/client/public/downloads
mkdir -p "$OUT"

rm -rf "$W/ARCHER"
mkdir -p "$W/ARCHER"
unzip -oq "$DL/electron-win.zip" -d "$W/ARCHER"

# app executable (default Electron icon in Explorer; ARCHER icon shows in taskbar/window)
mv "$W/ARCHER/electron.exe" "$W/ARCHER/ARCHER.exe"

# the app payload — same layout electron-builder would produce (resources/app)
mkdir -p "$W/ARCHER/resources/app/build"
cp /home/z/my-project/electron/main.js \
   /home/z/my-project/electron/preload.js \
   /home/z/my-project/electron/package.json \
   /home/z/my-project/electron/config.default.json \
   "$W/ARCHER/resources/app/"
cp /home/z/my-project/electron/build/icon.png "$W/ARCHER/resources/app/build/"

# server-core (pure Node device executors) travels with the app
mkdir -p "$W/ARCHER/resources/server-core/src"
cp -r /home/z/my-project/server/src/. "$W/ARCHER/resources/server-core/src/"

cd "$W"
zip -rq "$OUT/ARCHER-Windows.zip" ARCHER
echo "--- zip contents (top) ---"
unzip -l "$OUT/ARCHER-Windows.zip" | head -12
unzip -l "$OUT/ARCHER-Windows.zip" | rg "ARCHER.exe|server-core|resources/app" | head -8
ls -la "$OUT"
