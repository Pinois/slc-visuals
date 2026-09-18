#!/bin/sh
# Réencode les vidéos de public/videos aux réglages de dl.sh (720p max, 30 im/s max, x264 lent, crf 28).
# Chaque fichier converti est marqué dans ses métadonnées, il n'est jamais réencodé deux fois.
DIR="$(cd "$(dirname "$0")" && pwd)/public/videos"
for f in "$DIR"/*.mp4; do
  n=$(basename "$f")
  if ffprobe -v error -show_entries format_tags=comment -of csv=p=0 "$f" | grep -q slc-x264-slow-28; then echo "== $n : déjà converti"; continue; fi
  before=$(stat -f %z "$f")
  ffmpeg -nostdin -loglevel error -y -i "$f" -an -vf "scale=-2:'min(720,ih)',fps='min(30,source_fps)'" -c:v libx264 -crf 28 -preset slow -metadata comment=slc-x264-slow-28 -movflags +faststart "$f.tmp.mp4" </dev/null \
    && mv "$f.tmp.mp4" "$f" && echo "== $n : $((before / 1048576)) Mo -> $(( $(stat -f %z "$f") / 1048576 )) Mo" || { rm -f "$f.tmp.mp4"; echo "== $n : ÉCHEC"; }
done
echo "== TERMINÉ : $(du -sh "$DIR" | cut -f1)"
