#!/bin/sh
# Télécharge une vidéo et la range dans public/videos/<nom>.mp4 :
# 720p max, 30 im/s max, H.264 (x264 lent, crf 28), coupée à 3 minutes, sans son. Il faut yt-dlp et ffmpeg.
# usage : ./dl.sh <url> <nom> [début en secondes, défaut 0]
set -e
[ $# -eq 2 ] || [ $# -eq 3 ] || { echo "usage : $0 <url> <nom> [début en secondes]" >&2; exit 1; }
START=${3:-0}; END=$((START + 180))
DIR="$(cd "$(dirname "$0")" && pwd)/public/videos"
TMP="$(mktemp -d)"
yt-dlp --no-warnings -f "bv*[height<=720]/bv*" --download-sections "*${START}-${END}" -o "$TMP/src.%(ext)s" "$1"
ffmpeg -nostdin -y -i "$TMP"/src.* -an -vf "scale=-2:'min(720,ih)',fps='min(30,source_fps)'" -c:v libx264 -crf 28 -preset slow -metadata comment=slc-x264-slow-28 -movflags +faststart "$TMP/out.mp4"
mv "$TMP/out.mp4" "$DIR/$2.mp4"
rm -rf "$TMP"
echo "OK : public/videos/$2.mp4 ($(du -h "$DIR/$2.mp4" | cut -f1))"
