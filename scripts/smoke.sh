#!/bin/sh
set -eu
base_url=${1:-http://localhost:3000}
command -v curl >/dev/null 2>&1 || { echo 'Install curl to run this check.' >&2; exit 1; }
curl -fsS --max-time 20 "$base_url/" >/dev/null
catalog=$(curl -fsS --max-time 20 "$base_url/api/tracks")
for track in first-light slow-orbit tidal; do
  printf '%s' "$catalog" | grep -Eq "\"id\"[[:space:]]*:[[:space:]]*\"$track\"" || {
    echo "Missing generated track: $track" >&2
    exit 1
  }
  status=$(curl -fsS --max-time 20 -H 'Range: bytes=0-43' -o /dev/null -w '%{http_code}' "$base_url/media/demo/$track.wav")
  [ "$status" = 206 ] || { echo "Range request failed for $track: HTTP $status" >&2; exit 1; }
  echo "OK: $track, HTTP 206"
done
echo 'UI, API and storage smoke check passed. Play a track in the browser to verify audio output.'
