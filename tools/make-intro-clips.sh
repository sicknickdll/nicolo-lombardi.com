#!/usr/bin/env bash
# Makes the small files used by the landing intro (js/intro.js) in assets/intro/:
#   <name>.webm + <name>.mp4  4-second silent loop, 360px on the long side, 24 fps
#   <name>.webp               its first frame (shown until the clip plays)
# Stills (images without a video) only get the small .webp.
# Needs ffmpeg. Usage: tools/make-intro-clips.sh   (edit the lists below, then run)
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p assets/intro
fit="fps=24,scale='if(gt(iw,ih),min(360,iw),-2)':'if(gt(iw,ih),-2,min(360,ih))',scale=trunc(iw/2)*2:trunc(ih/2)*2,setsar=1"

# source video in assets/ (without extension) and the second the clip starts at
clips=(
  "pgvXtdMshKqmetkpEhgM2k1TI 8"
  "Ste489lG9zmVBFJeCYP9xDo 5"
  "ktb-vfx-01 0"
  "q65cZYQLVwWuvK4CaJ99qUKYaI0 8"
  "dtWaKoY1sNjmQihjqZxhqg2lUw 2"
  "malik-cross-film 20"
  "zSZrThHWODZG0ReCYFLVQcZv8fk 4"
  "ktb-vfx-03 0"
  "Vfrnp4LUs7aaOAevNvmhbI8FJrw 5"
  "i7MWkcoSeItRmxvFvuUf3tTLM 6"
)
stills=(DTlMGv30IEOltcth8y1RmJJoVug SKCYB8BMwkneaPvdQDQqhbuyVKE lexus-header wichita-666-header)

for entry in "${clips[@]}"; do
  read -r name at <<<"$entry"
  echo "→ $name"
  ffmpeg -hide_banner -loglevel error -y -ss "$at" -t 4 -i "assets/$name.mp4" -an -vf "$fit" \
    -c:v libvpx-vp9 -crf 40 -b:v 0 -row-mt 1 "assets/intro/$name.webm"
  ffmpeg -hide_banner -loglevel error -y -ss "$at" -t 4 -i "assets/$name.mp4" -an -vf "$fit" \
    -c:v libx264 -preset slow -crf 28 -pix_fmt yuv420p -movflags +faststart "assets/intro/$name.mp4"
  ffmpeg -hide_banner -loglevel error -y -i "assets/intro/$name.mp4" -frames:v 1 -q:v 75 \
    "assets/intro/$name.webp"
done
for name in "${stills[@]}"; do
  echo "→ $name"
  ffmpeg -hide_banner -loglevel error -y -i "assets/$name.webp" -vf "$fit" -q:v 75 \
    "assets/intro/$name.webp"
done
du -ch assets/intro/* | tail -1
