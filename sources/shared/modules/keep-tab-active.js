(function () {
  'use strict';

  function registerModule(definition) {
    window.__twitchEnhancerModuleDefinitions = window.__twitchEnhancerModuleDefinitions || [];
    window.__twitchEnhancerModuleDefinitions.push(definition);
  }

  const DEFAULT_SETTINGS = {
    enabled: true,
    autoRecoverOverlays: true,
    requestWakeLock: false
  };

  const USER_GESTURE_WINDOW_MS = 1200;
  const ACTIVITY_PULSE_INTERVAL_MS = 30000;
  const OVERLAY_ACTION_COOLDOWN_MS = 3000;

  const USER_GESTURE_EVENTS = [
    'pointerdown',
    'mousedown',
    'mouseup',
    'touchstart',
    'keydown',
    'click',
    'keypress'
  ];
  const BLOCKED_LIFECYCLE_EVENTS = [
    'visibilitychange',
    'webkitvisibilitychange',
    'freeze',
    'pagehide'
  ];

  const PLAYER_VISIBILITY_SELECTOR =
    '[data-a-target="player-overlay"],[data-a-target="player-container"]';
  const START_WATCHING_BUTTON_SELECTOR =
    '[data-a-target="content-classification-gate-overlay-start-watching-button"]';
  const PLAYER_CONTENT_GATE_SELECTOR =
    '[data-a-target="player-overlay-content-gate"]';

  registerModule({
    id: 'keepTabActive',
    create() {
      let settings = { ...DEFAULT_SETTINGS };
      let activated = false;
      let lastUserGesture = 0;
      let lastStartWatchingClick = 0;
      let lastOverlayHandled = 0;

      let mediaObserver = null;
      let startWatchingObserver = null;
      let streamRecoveryObserver = null;
      let activityPulseIntervalId = null;

      let originalPause = null;
      let originalPlay = null;

      function normalizeSettings(nextSettings) {
        return {
          enabled:
            typeof nextSettings.enabled === 'boolean'
              ? nextSettings.enabled
              : DEFAULT_SETTINGS.enabled,
          autoRecoverOverlays:
            typeof nextSettings.autoRecoverOverlays === 'boolean'
              ? nextSettings.autoRecoverOverlays
              : DEFAULT_SETTINGS.autoRecoverOverlays,
          requestWakeLock:
            typeof nextSettings.requestWakeLock === 'boolean'
              ? nextSettings.requestWakeLock
              : DEFAULT_SETTINGS.requestWakeLock
        };
      }

      function markUserGesture() {
        lastUserGesture = Date.now();
      }

      function bindGestureTracking() {
        USER_GESTURE_EVENTS.forEach((eventName) => {
          window.addEventListener(eventName, markUserGesture, {
            capture: true,
            passive: true
          });
        });
      }

      function installGestureTracking() {
        if (document.readyState === 'loading') {
          window.addEventListener('DOMContentLoaded', bindGestureTracking, {
            once: true
          });
        } else {
          bindGestureTracking();
        }
      }

      function defineConstantProperty(prototype, property, value) {
        try {
          const descriptor = Object.getOwnPropertyDescriptor(
            prototype,
            property
          );
          if (
            descriptor &&
            descriptor.get &&
            String(descriptor.get).includes('teKeepActive')
          ) {
            return;
          }

          Object.defineProperty(prototype, property, {
            configurable: true,
            enumerable: true,
            get: function teKeepActive() {
              return value;
            }
          });
        } catch (_) {}
      }

      function spoofDocumentActivity() {
        const documentPrototype =
          (window.Document && window.Document.prototype) ||
          Document.prototype;

        defineConstantProperty(documentPrototype, 'hidden', false);
        defineConstantProperty(documentPrototype, 'webkitHidden', false);
        defineConstantProperty(documentPrototype, 'visibilityState', 'visible');

        try {
          Object.defineProperty(documentPrototype, 'hasFocus', {
            configurable: true,
            value() {
              return true;
            }
          });
        } catch (_) {}
      }

      function stopEventImmediately(event) {
        event.stopImmediatePropagation();
      }

      function addSilentEventBlocker(target, eventName) {
        try {
          target.addEventListener(eventName, stopEventImmediately, true);
        } catch (_) {}
      }

      function blockBackgroundLifecycleEvents() {
        BLOCKED_LIFECYCLE_EVENTS.forEach((eventName) => {
          addSilentEventBlocker(document, eventName);
        });
        addSilentEventBlocker(window, 'blur');
      }

      function shouldAllowProgrammaticPause() {
        return Date.now() - lastUserGesture <= USER_GESTURE_WINDOW_MS;
      }

      function resumeIfPaused(video) {
        try {
          if (video && video.paused && video.readyState > 2) {
            const playPromise = originalPlay.call(video);
            if (playPromise && typeof playPromise.catch === 'function') {
              playPromise.catch(() => {});
            }
          }
        } catch (_) {}
      }

      function handleAddedMedia(mutations) {
        for (const mutation of mutations) {
          mutation.addedNodes &&
            mutation.addedNodes.forEach((node) => {
              if (node && node.nodeType === 1) {
                if (node.tagName === 'VIDEO') {
                  resumeIfPaused(node);
                }
                node.querySelectorAll?.('video')?.forEach(resumeIfPaused);
              }
            });
        }
      }

      function handleMediaPause(event) {
        const element = event.target;
        if (
          element instanceof window.HTMLMediaElement &&
          !shouldAllowProgrammaticPause()
        ) {
          try {
            event.stopImmediatePropagation();
          } catch (_) {}
          resumeIfPaused(element);
        }
      }

      function installMediaPlaybackGuard() {
        const mediaPrototype = (
          window.HTMLMediaElement || HTMLMediaElement
        ).prototype;
        originalPause = mediaPrototype.pause;
        originalPlay = mediaPrototype.play;

        Object.defineProperty(mediaPrototype, 'pause', {
          configurable: true,
          value: function teGuardedPause() {
            if (shouldAllowProgrammaticPause()) {
              return originalPause.apply(this, arguments);
            }

            try {
              const playPromise = originalPlay.apply(this, []);
              if (playPromise && typeof playPromise.catch === 'function') {
                playPromise.catch(() => {});
              }
            } catch (_) {}
          }
        });

        mediaObserver = new window.MutationObserver(handleAddedMedia);
        mediaObserver.observe(document.documentElement, {
          childList: true,
          subtree: true
        });

        document.addEventListener('pause', handleMediaPause, true);
      }

      function installIntersectionObserverProxy() {
        const NativeIntersectionObserver = window.IntersectionObserver;
        if (typeof NativeIntersectionObserver !== 'function') {
          return;
        }

        const IntersectionObserverProxy = function (callback, options) {
          const wrappedCallback = function (entries, observer) {
            const patchedEntries = entries.map((entry) => {
              const target = entry.target;
              const isVideoish =
                target.tagName === 'VIDEO' ||
                target.closest?.(PLAYER_VISIBILITY_SELECTOR);

              if (!isVideoish) {
                return entry;
              }

              const rect =
                target.getBoundingClientRect?.() || entry.boundingClientRect;
              return Object.assign({}, entry, {
                isIntersecting: true,
                intersectionRatio: 1,
                boundingClientRect: rect,
                intersectionRect: rect,
                rootBounds: entry.rootBounds
              });
            });

            try {
              return callback(patchedEntries, observer);
            } catch (_) {
              return undefined;
            }
          };

          return new NativeIntersectionObserver(wrappedCallback, options);
        };

        IntersectionObserverProxy.prototype =
          NativeIntersectionObserver.prototype;
        window.IntersectionObserver = IntersectionObserverProxy;
      }

      function dispatchActivityPulse() {
        try {
          window.dispatchEvent(
            new window.MouseEvent('mousemove', { bubbles: true })
          );
        } catch (_) {}
      }

      function startActivityPulse() {
        activityPulseIntervalId = window.setInterval(
          dispatchActivityPulse,
          ACTIVITY_PULSE_INTERVAL_MS
        );
      }

      function requestScreenWakeLock() {
        if (!settings.requestWakeLock) {
          return;
        }

        try {
          window.navigator.wakeLock?.request?.('screen').catch(() => {});
        } catch (_) {}
      }

      function tryClickStartWatching() {
        const now = Date.now();
        if (
          now - lastStartWatchingClick <
          OVERLAY_ACTION_COOLDOWN_MS
        ) {
          return;
        }

        const button = document.querySelector(
          START_WATCHING_BUTTON_SELECTOR
        );

        if (button && !button.disabled) {
          lastStartWatchingClick = now;
          button.click();
        }
      }

      function tryRecoverStream() {
        const overlay = document.querySelector(PLAYER_CONTENT_GATE_SELECTOR);
        if (!overlay) {
          return;
        }

        const now = Date.now();
        if (now - lastOverlayHandled < OVERLAY_ACTION_COOLDOWN_MS) {
          return;
        }

        const button = overlay.querySelector('button:not([disabled])');
        if (button) {
          lastOverlayHandled = now;
          button.click();
        }
      }

      function installOverlayRecovery() {
        startWatchingObserver = new window.MutationObserver(
          tryClickStartWatching
        );
        startWatchingObserver.observe(document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true
        });

        streamRecoveryObserver = new window.MutationObserver(tryRecoverStream);
        streamRecoveryObserver.observe(document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true
        });
      }

      function activate() {
        if (activated) {
          return;
        }
        activated = true;

        installGestureTracking();
        spoofDocumentActivity();
        blockBackgroundLifecycleEvents();
        installMediaPlaybackGuard();
        installIntersectionObserverProxy();
        startActivityPulse();
        requestScreenWakeLock();

        if (settings.autoRecoverOverlays) {
          installOverlayRecovery();
        }
      }

      return {
        updateSettings(nextSettings) {
          settings = normalizeSettings(nextSettings);

          if (settings.enabled) {
            activate();
          }
        }
      };
    }
  });
})();
