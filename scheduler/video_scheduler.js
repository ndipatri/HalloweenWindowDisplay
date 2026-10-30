ObjC.import('Cocoa');
ObjC.import('AVFoundation');
ObjC.import('AVKit');
ObjC.import('stdlib');

const HOME = ObjC.unwrap($.NSHomeDirectory());

const CONFIG = {
  // Keep the video out of Desktop, Documents and Downloads. macOS can silently
  // block a background script from reading those folders.
  videoPath: HOME + '/video-scheduler/current.mp4',
  schedule: [
    { start: '05:00', stop: '07:00' },
    { start: '17:00', stop: '23:00' },
  ],
  checkSeconds: 5,
};

const PLAYER_ITEM_FAILED = 2;

function main() {
  const app = $.NSApplication.sharedApplication;
  app.setActivationPolicy($.NSApplicationActivationPolicyAccessory);

  const window = createBlackWindow();
  $.NSCursor.hide;
  log('Started. Video: ' + CONFIG.videoPath);

  let video = null;
  let warnedMissing = false;
  let playing = null;

  while (true) {
    keepOnPortraitScreen(app, window);

    if (!video) {
      if (isReadable(CONFIG.videoPath)) {
        video = createLoopingPlayer(CONFIG.videoPath);
        window.contentView.addSubview(video.view);
        playing = null;
        log('Video loaded.');
      } else if (!warnedMissing) {
        warnedMissing = true;
        log(
          'ERROR: Cannot read ' + CONFIG.videoPath +
          '. Check the file exists there. Showing black until it does.',
        );
      }
    }

    if (video) {
      const shouldPlay = isWithinPlayWindow(new Date());
      if (shouldPlay !== playing) {
        playing = shouldPlay;
        video.view.hidden = !shouldPlay;
        shouldPlay ? video.player.play : video.player.pause;
        log(shouldPlay ? 'Playing.' : 'Paused (outside schedule).');
      }
      reportPlaybackFailure(video);
    }

    handleEventsFor(app, CONFIG.checkSeconds);
  }
}

function log(message) {
  // osascript sends console.log to stderr, which the launch agent saves to a file.
  console.log(new Date().toLocaleString() + '  ' + message);
}

function isReadable(path) {
  return $.NSFileManager.defaultManager.isReadableFileAtPath(path);
}

function reportPlaybackFailure(video) {
  if (video.failed) return;
  const item = video.player.currentItem;
  if (item.isNil() || item.status !== PLAYER_ITEM_FAILED) return;
  video.failed = true;
  const reason = item.error.isNil()
    ? 'unknown reason'
    : ObjC.unwrap(item.error.localizedDescription);
  log('ERROR: The video file could not be played: ' + reason);
}

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

function keepOnPortraitScreen(app, window) {
  const screen = portraitScreen();
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

function createLoopingPlayer(path) {
  const url = $.NSURL.fileURLWithPath(path);
  const item = $.NSClassFromString('AVPlayerItem').playerItemWithURL(url);
  const player = $.NSClassFromString('AVQueuePlayer').alloc.init;
  const looper = $.NSClassFromString('AVPlayerLooper')
    .playerLooperWithPlayerTemplateItem(player, item);

  const view = $.NSClassFromString('AVPlayerView').alloc.initWithFrame(
    $.NSMakeRect(0, 0, 1080, 1920),
  );
  view.autoresizingMask = $.NSViewWidthSizable | $.NSViewHeightSizable;
  view.player = player;
  view.controlsStyle = 0;
  view.videoGravity = 'AVLayerVideoGravityResizeAspect';
  view.hidden = true;

  return { player, looper, view, failed: false };
}

function isWithinPlayWindow(now) {
  const current = now.getHours() * 60 + now.getMinutes();
  return CONFIG.schedule.some((period) => {
    const start = toMinutes(period.start);
    const stop = toMinutes(period.stop);
    return start <= stop
      ? current >= start && current < stop
      : current >= start || current < stop;
  });
}

function toMinutes(hhmm) {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return hours * 60 + minutes;
}

main();
