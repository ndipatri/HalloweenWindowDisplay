ObjC.import('Cocoa');
ObjC.import('AVFoundation');
ObjC.import('AVKit');
ObjC.import('stdlib');

const HOME = ObjC.unwrap($.NSHomeDirectory());

const CONFIG = {
  // Each playlist is a folder in here, e.g. ~/video-scheduler/kid and
  // ~/video-scheduler/grownup. Keep it out of Desktop, Documents and
  // Downloads: macOS can silently block a background script from reading them.
  videoRoot: HOME + '/video-scheduler',

  // 24-hour HH:MM times. `playlist` is the folder to play during that period.
  // Periods can cross midnight. If periods overlap, the first one listed wins.
  schedule: [
    { start: '05:00', stop: '07:00', playlist: 'kid' },
    { start: '17:00', stop: '20:00', playlist: 'kid' },
    { start: '20:00', stop: '23:00', playlist: 'grownup' },
  ],

  videoExtensions: ['mp4', 'm4v', 'mov'],
  checkSeconds: 1,
};

// Written by the `show` command to override the schedule; checked every second.
const OVERRIDE_PATH = CONFIG.videoRoot + '/override.json';
// One line saying what's on screen and why; `show` prints it.
const STATUS_PATH = CONFIG.videoRoot + '/status';

const ITEM_FAILED = 2;
const PLAYER_FAILED = 2;
// Videos queued ahead of time, so one follows the next without a gap.
const QUEUE_AHEAD = 3;

function main() {
  const app = $.NSApplication.sharedApplication;
  app.setActivationPolicy($.NSApplicationActivationPolicyAccessory);

  const window = createBlackWindow();
  const view = createPlayerView();
  window.contentView.addSubview(view);
  $.NSCursor.hide;

  const schedule = validSchedule(CONFIG.schedule);
  log('Started. Videos: ' + CONFIG.videoRoot);

  const playlists = {};
  const overrideState = { warnedText: null };
  let activeName;
  let active = null;
  let status = null;

  while (true) {
    keepOnPortraitScreen(app, window);

    const choice = whatToShow(schedule, new Date(), overrideState);
    if (choice.status !== status) {
      status = choice.status;
      log('Now showing: ' + status);
      writeText(STATUS_PATH, status + '\n');
    }

    const name = choice.playlist;
    if (name !== activeName) {
      if (active) active.player.pause;
      activeName = name;
      if (name) {
        if (!playlists[name]) playlists[name] = createPlaylist(name);
        active = playlists[name];
        view.player = active.player;
      } else {
        active = null;
      }
    }

    if (active) {
      const hasVideo = keepPlaying(active);
      if (active.replacedPlayer) {
        active.replacedPlayer = false;
        view.player = active.player;
      }
      view.hidden = !hasVideo;
      if (hasVideo && active.player.rate === 0) active.player.play;
    } else {
      view.hidden = true;
    }

    handleEventsFor(app, CONFIG.checkSeconds);
  }
}

// ---------- Schedule ----------

function validSchedule(periods) {
  return periods.filter((period, i) => {
    const ok =
      isTime(period.start) &&
      isTime(period.stop) &&
      typeof period.playlist === 'string' &&
      period.playlist.length > 0 &&
      !period.playlist.includes('/');
    if (!ok) {
      log(
        'ERROR: Ignoring schedule entry ' + (i + 1) + ': ' + JSON.stringify(period) +
        ". Expected { start: 'HH:MM', stop: 'HH:MM', playlist: 'kid' }.",
      );
    }
    return ok;
  });
}

function isTime(value) {
  return typeof value === 'string' && /^([01]?\d|2[0-3]):[0-5]\d$/.test(value);
}

function activePlaylistName(schedule, now) {
  const current = now.getHours() * 60 + now.getMinutes();
  const period = schedule.find((p) => {
    const start = toMinutes(p.start);
    const stop = toMinutes(p.stop);
    return start <= stop
      ? current >= start && current < stop
      : current >= start || current < stop;
  });
  return period ? period.playlist : null;
}

function toMinutes(hhmm) {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return hours * 60 + minutes;
}

// When the schedule next shows something different from what it shows at
// `from`, to the minute. null if it never changes.
function nextScheduleChange(schedule, from) {
  const current = activePlaylistName(schedule, from);
  const t = new Date(from.getTime());
  t.setSeconds(0, 0);
  for (let i = 0; i < 24 * 60; i++) {
    t.setMinutes(t.getMinutes() + 1);
    if (activePlaylistName(schedule, t) !== current) return new Date(t.getTime());
  }
  return null;
}

// ---------- What to show: override or schedule ----------

// Returns { playlist, status }: the playlist to play (null = black) and a
// one-line description of what's showing and why.
function whatToShow(schedule, now, overrideState) {
  const override = currentOverride(schedule, now, overrideState);
  if (override) {
    return {
      playlist: override.playlist,
      status: describe(override.playlist) + ' (override ' + override.until + ')',
    };
  }
  const playlist = activePlaylistName(schedule, now);
  const change = nextScheduleChange(schedule, now);
  const until = change ? 'until ' + formatTime(change, now) : 'all day';
  return {
    playlist,
    status: playlist
      ? playlist + ' (scheduled ' + until + ')'
      : 'black (outside schedule ' + until + ')',
  };
}

function describe(playlist) {
  return playlist === null ? 'black' : playlist;
}

// Reads the override file. Ends an override whose time is up by deleting
// the file. Returns { playlist, until } while one is in force, else null.
function currentOverride(schedule, now, state) {
  const text = readText(OVERRIDE_PATH);
  if (text === null) return null;

  const parsed = parseOverride(text);
  if (!parsed.ok) {
    if (state.warnedText !== text) {
      state.warnedText = text;
      log('ERROR: Ignoring ' + OVERRIDE_PATH + ': ' + parsed.error);
    }
    return null;
  }

  const decision = decideOverride(parsed.value, schedule, now);
  if (!decision.active) {
    // Only delete it if `show` hasn't just replaced it with a new one.
    if (readText(OVERRIDE_PATH) === text) removeFile(OVERRIDE_PATH);
    log('Override of ' + describe(parsed.value.playlist) + ' ended: ' + decision.reason + '.');
    return null;
  }
  return {
    playlist: parsed.value.playlist,
    until: decision.endsAt
      ? (decision.atScheduleChange ? 'until the schedule changes at ' : 'until ') +
        formatTime(decision.endsAt, now)
      : 'until cleared',
  };
}

// Override file, as written by `show`:
//   { "playlist": "grownup" | null, "setAt": <ms>, "expires": <ms> | null,
//     "untilCleared": true | false }
// playlist null means black. With no `expires` and untilCleared false, the
// override lasts until the schedule next changes after `setAt`.
function parseOverride(text) {
  let o;
  try {
    o = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: 'not valid JSON' };
  }
  if (o === null || typeof o !== 'object') return { ok: false, error: 'not an object' };
  const playlistOk =
    o.playlist === null ||
    (typeof o.playlist === 'string' && o.playlist.length > 0 && !o.playlist.includes('/'));
  if (!playlistOk) return { ok: false, error: 'bad "playlist"' };
  if (typeof o.setAt !== 'number') return { ok: false, error: 'bad "setAt"' };
  if (o.expires !== null && o.expires !== undefined && typeof o.expires !== 'number') {
    return { ok: false, error: 'bad "expires"' };
  }
  return {
    ok: true,
    value: {
      playlist: o.playlist,
      setAt: o.setAt,
      expires: typeof o.expires === 'number' ? o.expires : null,
      untilCleared: o.untilCleared === true,
    },
  };
}

// { active: true, endsAt: Date | null, atScheduleChange } or
// { active: false, reason }.
function decideOverride(o, schedule, now) {
  if (o.untilCleared) return { active: true, endsAt: null, atScheduleChange: false };
  if (o.expires !== null) {
    return now.getTime() >= o.expires
      ? { active: false, reason: 'time is up' }
      : { active: true, endsAt: new Date(o.expires), atScheduleChange: false };
  }
  const change = nextScheduleChange(schedule, new Date(o.setAt));
  if (change === null) return { active: true, endsAt: null, atScheduleChange: false };
  return now.getTime() >= change.getTime()
    ? { active: false, reason: 'the schedule changed' }
    : { active: true, endsAt: change, atScheduleChange: true };
}

// "8:00 PM", or "Sat 8:00 PM" when it isn't today.
function formatTime(date, now) {
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (date.toDateString() === now.toDateString()) return time;
  return date.toLocaleDateString('en-US', { weekday: 'short' }) + ' ' + time;
}

// ---------- Playlists ----------

function createPlaylist(name) {
  return {
    name,
    folder: CONFIG.videoRoot + '/' + name,
    player: newQueuePlayer(),
    replacedPlayer: false,
    lastQueued: null,
    nowPlaying: null,
    warnings: {},
  };
}

function newQueuePlayer() {
  return $.NSClassFromString('AVQueuePlayer').alloc.init;
}

// Keeps the playlist's queue topped up, cycling through its folder in name
// order. Re-reads the folder each time, so added or removed videos are picked
// up without a restart. Returns whether there is anything to show.
function keepPlaying(playlist) {
  if (playlist.player.status === PLAYER_FAILED) {
    log(
      'ERROR: The ' + playlist.name + ' player stopped working (' +
      errorText(playlist.player.error) + '). Starting a new one.',
    );
    playlist.player = newQueuePlayer();
    playlist.replacedPlayer = true;
    playlist.nowPlaying = null;
  }

  const current = playlist.player.currentItem;
  if (!current.isNil() && current.status === ITEM_FAILED) {
    warnOnce(
      playlist,
      'bad:' + fileName(current),
      'ERROR: Skipping ' + fileName(current) + ' in ' + playlist.name + ': ' +
        errorText(current.error),
    );
    playlist.player.advanceToNextItem;
  }

  const playing = playlist.player.currentItem;
  const playingName = playing.isNil() ? null : fileName(playing);
  if (playingName && playingName !== playlist.nowPlaying) {
    log(playlist.name + ': playing ' + playingName);
  }
  playlist.nowPlaying = playingName;

  let queued = playlist.player.items.count;
  if (queued >= QUEUE_AHEAD) return true;

  const files = listVideos(playlist.folder);
  if (files === null) {
    warnOnce(
      playlist,
      'missing',
      'ERROR: Cannot read the folder ' + playlist.folder +
        '. Create it, and keep it out of Desktop, Documents and Downloads.',
    );
    return queued > 0;
  }
  clearWarning(playlist, 'missing');
  if (files.length === 0) {
    warnOnce(
      playlist,
      'empty',
      'No videos in ' + playlist.folder + ' yet. Showing black until one is added.',
    );
    return queued > 0;
  }
  clearWarning(playlist, 'empty');

  while (queued < QUEUE_AHEAD) {
    const file = nextFile(files, playlist.lastQueued);
    const url = $.NSURL.fileURLWithPath(playlist.folder + '/' + file);
    const item = $.NSClassFromString('AVPlayerItem').playerItemWithURL(url);
    appendToQueue(playlist.player, item);
    playlist.lastQueued = file;
    queued++;
  }
  return true;
}

// Adds an item to the end of the player's queue.
// Don't use insertItem:afterItem: with null to mean "at the end": the
// JavaScript bridge passes null as an NSNull object, not nil, and
// AVFoundation crashes on it ("-[NSNull _nameForLogging]: unrecognized
// selector"). Insert after the actual last item, or, when the queue is empty,
// make the item the current one.
function appendToQueue(player, item) {
  const items = player.items;
  if (items.count === 0) {
    player.replaceCurrentItemWithPlayerItem(item);
  } else {
    player.insertItemAfterItem(item, items.lastObject);
  }
}

function listVideos(folder) {
  const contents = $.NSFileManager.defaultManager.contentsOfDirectoryAtPathError(
    folder,
    null,
  );
  if (contents.isNil()) return null;
  return ObjC.deepUnwrap(contents).filter(isVideoFile).sort(compareNames);
}

function isVideoFile(name) {
  if (name.startsWith('.') || !name.includes('.')) return false;
  const extension = name.split('.').pop().toLowerCase();
  return CONFIG.videoExtensions.includes(extension);
}

// Name order, with numbers compared as numbers: 2-ghost.mp4 before 10-hand.mp4.
function compareNames(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

// The file after `last` in name order, wrapping round to the first.
function nextFile(files, last) {
  if (last === null) return files[0];
  return files.find((file) => compareNames(file, last) > 0) || files[0];
}

function fileName(item) {
  return ObjC.unwrap(item.asset.URL.lastPathComponent);
}

function errorText(error) {
  return error.isNil() ? 'unknown reason' : ObjC.unwrap(error.localizedDescription);
}

// ---------- Files ----------

function readText(path) {
  const text = $.NSString.stringWithContentsOfFileEncodingError(
    path,
    $.NSUTF8StringEncoding,
    null,
  );
  return text.isNil() ? null : ObjC.unwrap(text);
}

function writeText(path, text) {
  $(text).writeToFileAtomicallyEncodingError(path, true, $.NSUTF8StringEncoding, null);
}

function removeFile(path) {
  $.NSFileManager.defaultManager.removeItemAtPathError(path, null);
}

// ---------- Logging ----------

function log(message) {
  // osascript sends console.log to stderr, which the launch agent saves to a file.
  console.log(new Date().toLocaleString() + '  ' + message);
}

function warnOnce(playlist, key, message) {
  if (playlist.warnings[key]) return;
  playlist.warnings[key] = true;
  log(message);
}

function clearWarning(playlist, key) {
  delete playlist.warnings[key];
}

// ---------- Window and display ----------

function handleEventsFor(app, seconds) {
  const until = $.NSDate.dateWithTimeIntervalSinceNow(seconds);
  while (true) {
    const event = app.nextEventMatchingMaskUntilDateInModeDequeue(
      -1,
      until,
      $.NSDefaultRunLoopMode,
      true,
    );
    if (event.isNil()) return;
    if (isControlC(event)) {
      log('Quit with Control-C.');
      $.exit(0);
    }
    app.sendEvent(event);
  }
}

function isControlC(event) {
  const keyDown = 10;
  const controlFlag = 1 << 18;
  return (
    event.type == keyDown &&
    (event.modifierFlags & controlFlag) !== 0 &&
    ObjC.unwrap(event.charactersIgnoringModifiers) === 'c'
  );
}

let portraitMissing = null;

function keepOnPortraitScreen(app, window) {
  const screen = portraitScreen();
  if (portraitMissing !== !screen) {
    portraitMissing = !screen;
    log(
      screen
        ? 'Using the portrait display.'
        : 'No portrait display found: is the TV connected, and rotated to ' +
            'portrait in System Settings > Displays?',
    );
  }
  if (!screen) {
    if (window.isVisible) window.orderOut(null);
    return;
  }
  if (!window.isVisible || !sameRect(window.frame, screen.frame)) {
    window.setFrameDisplay(screen.frame, true);
    window.makeKeyAndOrderFront(null);
    app.activateIgnoringOtherApps(true);
  }
}

function portraitScreen() {
  const screens = $.NSScreen.screens;
  for (let i = 0; i < screens.count; i++) {
    const screen = screens.objectAtIndex(i);
    const size = screen.frame.size;
    if (size.height > size.width) return screen;
  }
  return null;
}

function sameRect(a, b) {
  return (
    a.origin.x === b.origin.x &&
    a.origin.y === b.origin.y &&
    a.size.width === b.size.width &&
    a.size.height === b.size.height
  );
}

function createBlackWindow() {
  ObjC.registerSubclass({
    name: 'SchedulerWindow',
    superclass: 'NSWindow',
    methods: {
      canBecomeKeyWindow: {
        types: ['bool', []],
        implementation: () => true,
      },
    },
  });
  const window = $.SchedulerWindow.alloc.initWithContentRectStyleMaskBackingDefer(
    $.NSMakeRect(0, 0, 1080, 1920),
    $.NSWindowStyleMaskBorderless,
    $.NSBackingStoreBuffered,
    false,
  );
  window.backgroundColor = $.NSColor.blackColor;
  window.level = 1000;
  window.collectionBehavior =
    $.NSWindowCollectionBehaviorCanJoinAllSpaces |
    $.NSWindowCollectionBehaviorStationary |
    $.NSWindowCollectionBehaviorFullScreenAuxiliary;
  window.releasedWhenClosed = false;
  return window;
}

function createPlayerView() {
  const view = $.NSClassFromString('AVPlayerView').alloc.initWithFrame(
    $.NSMakeRect(0, 0, 1080, 1920),
  );
  view.autoresizingMask = $.NSViewWidthSizable | $.NSViewHeightSizable;
  view.controlsStyle = 0;
  view.videoGravity = 'AVLayerVideoGravityResizeAspect';
  view.hidden = true;
  return view;
}

main();
