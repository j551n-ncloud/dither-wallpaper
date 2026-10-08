#!/bin/bash
# Swaps the Golden Gate Sunset aerial for the dither video, so it plays on the desktop and lock screen.
# Usage: ./set-lockscreen-video.sh [video.mov] (default out/aerial.mov from render.mjs)
# Run again after a macOS update overwrites it. Undo: run with "restore".
set -euo pipefail

ID="4207734D-74FE-4F92-B5E1-6EC8DEE24A15" # Golden Gate Sunset
TARGET="$HOME/Library/Application Support/com.apple.wallpaper/aerials/videos/$ID.mov"
NEW="${1:-$(dirname "$0")/out/aerial.mov}"
BACKUP="$HOME/Downloads/aerial-backup/$ID.mov"

if [ "${1:-}" = "restore" ]; then
  cat "$BACKUP" > "$TARGET"
  echo "Restored Apple's Golden Gate Sunset"
else
  mkdir -p "$(dirname "$BACKUP")"
  # only back up Apple's original (theirs is hundreds of MB, ours is ~250 MB)
  if [ ! -f "$BACKUP" ] && [ "$(stat -f%z "$TARGET")" -gt 400000000 ]; then cp "$TARGET" "$BACKUP"; fi
  # write into the existing file: its LastETag/SourceURL tags tell macOS the download is complete,
  # a fresh file without them gets re-downloaded from Apple
  cat "$NEW" > "$TARGET"
  echo "Replaced Golden Gate Sunset with $NEW"
fi
echo "Now pick another wallpaper and then Golden Gate Sunset again (or log out and in) to reload it."
