#!/bin/bash
# Updates the video folders in ~/video-scheduler from this repo's
# playlists/ folder. Installed as ~/video-scheduler/sync.
#
#   sync            pull the latest from GitHub, then copy the videos
#   sync --no-pull  copy the videos from the repo as it is
#
# For each folder under playlists/ (halloween, halloween/grownup, ...):
#   - videos that are new or changed in the repo are copied in
#   - videos that are no longer in the repo are moved to
#     ~/video-scheduler/.removed/<folder>/, never deleted
# Inside a folder the repo has, a subfolder it no longer has is set aside
# too. Top-level folders that aren't in the repo are left alone.
#
# The running scheduler picks the changes up by itself; no restart needed.
# If GitHub can't be reached, it copies from the repo as it already is.
set -uo pipefail

repo="${VIDEO_SCHEDULER_REPO:-__REPO__}"
root="${VIDEO_SCHEDULER_ROOT:-$HOME/video-scheduler}"
src="$repo/playlists"
pull_timeout="${VIDEO_SCHEDULER_PULL_TIMEOUT:-60}"

log() { echo "$(date '+%m/%d/%Y, %-I:%M:%S %p')  sync: $*"; }

is_video() {
  case "$1" in
    .*) return 1 ;;
    *.mp4 | *.MP4 | *.m4v | *.M4V | *.mov | *.MOV) return 0 ;;
    *) return 1 ;;
  esac
}

pull() {
  if ! git -C "$repo" rev-parse --git-dir >/dev/null 2>&1; then
    log "ERROR: $repo isn't a git checkout, so can't pull. Using the videos as they are."
    return
  fi
  local errors pid watchdog status
  errors="$(mktemp)"
  # Never wait on a password prompt; give up on a stalled transfer.
  GIT_TERMINAL_PROMPT=0 GIT_HTTP_LOW_SPEED_LIMIT=1000 GIT_HTTP_LOW_SPEED_TIME=20 \
    git -C "$repo" pull --ff-only --quiet 2>"$errors" &
  pid=$!
  (sleep "$pull_timeout" && kill "$pid" 2>/dev/null) &
  watchdog=$!
  wait "$pid"
  status=$?
  kill "$watchdog" 2>/dev/null
  wait "$watchdog" 2>/dev/null

  local reason
  reason="$(tail -n 1 "$errors" | sed 's/^fatal: //')"
  if [ "$status" -eq 0 ]; then
    log "Pulled the latest from GitHub ($(git -C "$repo" log -1 --format=%h))."
  else
    [ -n "$reason" ] || reason="no answer within $pull_timeout seconds"
    log "Couldn't pull from GitHub ($reason). Using the videos already in the repo."
  fi
  rm -f "$errors"
}

copy_videos() {
  if [ ! -d "$src" ]; then
    log "No playlists/ folder in $repo yet; nothing to copy."
    return
  fi
  local copied=0 set_aside=0 dir name dest file base
  # Every folder under playlists/, at any depth: halloween, halloween/grownup...
  while IFS= read -r name; do
    dir="$src/$name/"
    dest="$root/$name"
    mkdir -p "$dest"

    for file in "$dir"*; do
      base="$(basename "$file")"
      [ -f "$file" ] && is_video "$base" || continue
      cmp -s "$file" "$dest/$base" && continue
      # Copy under a hidden name, then rename into place in one step, so the
      # scheduler never sees (or plays) a half-copied file.
      if cp "$file" "$dest/.$base.syncing" && mv -f "$dest/.$base.syncing" "$dest/$base"; then
        log "Copied $name/$base"
        copied=$((copied + 1))
      else
        rm -f "$dest/.$base.syncing"
        log "ERROR: Couldn't copy $name/$base"
      fi
    done

    for file in "$dest"/*; do
      base="$(basename "$file")"
      [ -f "$file" ] && is_video "$base" || continue
      [ -e "$dir$base" ] && continue
      mkdir -p "$root/.removed/$name"
      mv -f "$file" "$root/.removed/$name/$base"
      log "Moved $name/$base to .removed/$name/ (no longer in the repo)"
      set_aside=$((set_aside + 1))
    done
  done < <(cd "$src" && find . -mindepth 1 -type d ! -path '*/.*' | sed 's|^\./||' | sort)

  # Inside a top-level folder the repo has (a season), a subfolder the repo
  # no longer has is set aside too, e.g. halloween/grownup deleted from the
  # repo. Top-level folders the repo doesn't have are left alone.
  local top
  while IFS= read -r name; do
    top="${name%%/*}"
    [ -d "$src/$top" ] && [ ! -d "$src/$name" ] || continue
    for file in "$root/$name"/*; do
      base="$(basename "$file")"
      [ -f "$file" ] && is_video "$base" || continue
      mkdir -p "$root/.removed/$name"
      mv -f "$file" "$root/.removed/$name/$base"
      log "Moved $name/$base to .removed/$name/ (folder no longer in the repo)"
      set_aside=$((set_aside + 1))
    done
  done < <(cd "$root" && find . -mindepth 2 -type d ! -path '*/.*' | sed 's|^\./||' | sort)

  log "Done: $copied copied, $set_aside moved aside."
}

case "${1:-}" in
  "") pull; copy_videos ;;
  --no-pull) copy_videos ;;
  -h | --help) sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//' ;;
  *) echo "Usage: sync [--no-pull]" >&2; exit 1 ;;
esac
