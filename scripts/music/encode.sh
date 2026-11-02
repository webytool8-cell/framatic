#!/usr/bin/env bash
# Encode generated WAVs to MP3 for the app (uses Remotion's bundled ffmpeg).
# Usage: bash scripts/music/encode.sh /tmp/audio-gen public/audio
set -euo pipefail
SRC="$1"; DEST="$2"
mkdir -p "$DEST/music" "$DEST/sfx" "$DEST/transitions"
for f in "$SRC"/music/*.wav "$SRC"/sfx/*.wav "$SRC"/transitions/*.wav; do
  rel="${f#"$SRC"/}"
  npx remotion ffmpeg -loglevel error -y -i "$f" -c:a libmp3lame -b:a 160k "$DEST/${rel%.wav}.mp3"
done
cp "$SRC/manifest.json" "$DEST/manifest.json"
