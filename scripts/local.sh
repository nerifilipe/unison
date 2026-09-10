#!/bin/sh
set -eu

action=${1:-start}
case "$action" in
  start|stop|status|logs|verify) ;;
  *) echo 'Usage: sh scripts/local.sh [start|stop|status|logs|verify]' >&2; exit 2 ;;
esac
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repo_root=$(dirname "$script_dir")

command -v docker >/dev/null 2>&1 || {
  echo 'Docker was not found. Install Docker Desktop or Docker Engine with Compose v2.' >&2
  exit 1
}
docker compose version || { echo 'Docker Compose v2 is required.' >&2; exit 1; }
engine_type=$(docker info --format '{{.OSType}}') || {
  echo 'Docker is not ready. Start Docker Desktop / Docker Engine and try again.' >&2
  exit 1
}
[ "$engine_type" = linux ] || { echo 'Switch Docker Desktop to Linux containers.' >&2; exit 1; }
compose() { docker compose --project-directory "$repo_root" -f "$repo_root/compose.yaml" "$@"; }

case "$action" in
  start)
    command -v curl >/dev/null 2>&1 || { echo 'Install curl for the startup verification.' >&2; exit 1; }
    compose up -d --build --wait --wait-timeout 180
    sh "$script_dir/smoke.sh"
    echo 'Unison is ready: http://localhost:3000'
    ;;
  stop) compose stop; echo 'Unison stopped. Accounts, playlists and audio are preserved.' ;;
  status) compose ps -a ;;
  logs) compose logs --tail=100 ;;
  verify) sh "$script_dir/smoke.sh" ;;
esac
