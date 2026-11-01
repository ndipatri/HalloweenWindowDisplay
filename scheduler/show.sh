#!/bin/bash
# Overrides the video schedule. Installed as ~/video-scheduler/show.
#
#   show                          what's on screen now, and why
#   show grownup                  play grownup until the schedule next changes
#   show kid 30                   play kid for 30 minutes, then back to the schedule
#   show christmas/kid 5          preview another season's kid videos for 5 minutes
#   show christmas 5              preview just a season's own videos
#   show off                      black until the schedule next changes
#   show grownup --until-cleared  play grownup until you run `show schedule`
#   show schedule                 cancel the override and follow the schedule
#
# A plain playlist name (kid, grownup) means today's season's.
# The scheduler picks the change up within a second; no restart needed.
set -euo pipefail

root="${VIDEO_SCHEDULER_ROOT:-$HOME/video-scheduler}"
override="$root/override.json"
status_file="$root/status"

usage() {
  sed -n '4,14p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

print_status() {
  if [ -f "$status_file" ]; then
    echo "Now showing: $(cat "$status_file")"
  else
    echo "No status yet. Is the scheduler running? Check $root/scheduler.log"
  fi
}

# Wait for the scheduler to apply the change, then report.
report() {
  sleep 2
  print_status
}

time_at() { # epoch seconds -> "8:30 PM" (macOS date, else GNU date)
  date -r "$1" '+%-I:%M %p' 2>/dev/null || date -d "@$1" '+%-I:%M %p'
}

write_override() { # playlist-json expires-ms-or-null until-cleared
  local now_ms tmp
  now_ms=$(( $(date +%s) * 1000 ))
  tmp="$override.tmp.$$"
  printf '{"playlist": %s, "setAt": %s, "expires": %s, "untilCleared": %s}\n' \
    "$1" "$now_ms" "$2" "$3" > "$tmp"
  mv -f "$tmp" "$override"
}

[ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ] && usage 0

if [ $# -eq 0 ]; then
  print_status
  exit 0
fi

target="$1"
shift

if [ "$target" = "schedule" ]; then
  [ $# -eq 0 ] || usage 1
  rm -f "$override"
  echo "Override cancelled. Following the schedule."
  report
  exit 0
fi

minutes=""
until_cleared=false
for arg in "$@"; do
  case "$arg" in
    --until-cleared) until_cleared=true ;;
    *[!0-9]* | "" | 0) echo "Not a number of minutes: $arg" >&2; usage 1 ;;
    *) [ -z "$minutes" ] || usage 1; minutes="$arg" ;;
  esac
done
if [ -n "$minutes" ] && $until_cleared; then
  echo "Use either a number of minutes or --until-cleared, not both." >&2
  exit 1
fi

if [ "$target" = "off" ] || [ "$target" = "black" ]; then
  playlist_json=null
  label="black"
else
  case "$target" in
    */*/* | .* | */.* | */ | *'"'* | *\\*)
      echo "Not a playlist name: $target (use kid, christmas or christmas/kid)" >&2
      exit 1 ;;
  esac
  folders="$(cd "$root" && ls -d */ 2>/dev/null | tr -d / | tr '\n' ' ')"
  case "$target" in
    */*)
      # season/playlist: the season folder must exist; the playlist
      # subfolder is optional (without it, the season's own videos play).
      season="${target%%/*}"
      if [ ! -d "$root/$season" ]; then
        echo "No folder $root/$season. Folders: $folders" >&2
        exit 1
      fi
      [ -d "$root/$target" ] || echo "Note: $season has no ${target#*/}/ subfolder, so this plays just $season's own videos." >&2
      ;;
    *)
      # A season (or, without seasons, a playlist) folder, a playlist folder
      # in some season, or a playlist named in the schedule. Anything else is
      # probably a typo.
      if [ ! -d "$root/$target" ] && ! ls -d "$root"/*/"$target"/ >/dev/null 2>&1 &&
        ! grep -q "playlist: '$target'" "$root/video_scheduler.js" 2>/dev/null; then
        echo "Note: no folder is called $target, so this plays just today's season's own videos. Folders: $folders" >&2
      fi
      ;;
  esac
  playlist_json="\"$target\""
  label="$target"
fi

if [ -n "$minutes" ]; then
  ends=$(( $(date +%s) + minutes * 60 ))
  write_override "$playlist_json" "$(( ends * 1000 ))" false
  echo "Showing $label until $(time_at "$ends"), then back to the schedule."
elif $until_cleared; then
  write_override "$playlist_json" null true
  echo "Showing $label until you run: show schedule"
else
  write_override "$playlist_json" null false
  echo "Showing $label until the schedule next changes."
fi
report
