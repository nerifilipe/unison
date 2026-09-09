#!/bin/sh
set -eu
# Original synthesized chords; no sampled or third-party recordings.
# Fixed sample rate, duration, phase and filters make generation repeatable.
mkdir -p /audio
generate() {
  name="$1"; a="$2"; b="$3"; c="$4"
  ffmpeg -hide_banner -loglevel error -y \
    -f lavfi -i "aevalsrc=0.10*sin(2*PI*$a*t)*(0.65+0.35*sin(2*PI*0.12*t))+0.07*sin(2*PI*$b*t)*(0.65+0.35*sin(2*PI*0.18*t))+0.05*sin(2*PI*$c*t):s=44100:d=60" \
    -af 'afade=t=in:d=2,afade=t=out:st=57:d=3' \
    -ac 2 -c:a pcm_s16le -map_metadata -1 "/audio/$name.wav"
}
generate first-light 261.63 329.63 392.00
generate slow-orbit 220.00 261.63 329.63
generate tidal 174.61 220.00 261.63
