(function () {
  'use strict';

  function registerModule(definition) {
    window.__twitchEnhancerModuleDefinitions = window.__twitchEnhancerModuleDefinitions || [];
    window.__twitchEnhancerModuleDefinitions.push(definition);
  }

  registerModule({
    id: 'keepTabActive',
    create() {
      let settings = {
        enabled: true,
        requestWakeLock: false,
        autoRecoverOverlays: true
      };
      let activated = false;

      function activate() {
        if (activated) {
          return;
        }
        activated = true;

        const uw = window;
        let lastUserGesture = 0;
        const userGestureWindowMs = 1200;
        const markGesture = () => {
          lastUserGesture = Date.now();
        };
        const gestureEvents = ['pointerdown', 'mousedown', 'mouseup', 'touchstart', 'keydown', 'click', 'keypress'];

        const bindGestureTracking = () => {
          gestureEvents.forEach((eventName) => {
            uw.addEventListener(eventName, markGesture, { capture: true, passive: true });
          });
        };

        if (uw.document.readyState === 'loading') {
          uw.addEventListener('DOMContentLoaded', bindGestureTracking, { once: true });
        } else {
          bindGestureTracking();
        }

        const defineConstProp = (proto, prop, val) => {
          try {
            const descriptor = Object.getOwnPropertyDescriptor(proto, prop);
            if (descriptor && descriptor.get && String(descriptor.get).includes('teKeepActive')) return;
            Object.defineProperty(proto, prop, {
              configurable: true,
              enumerable: true,
              get: function teKeepActive() { return val; }
            });
          } catch (_) {}
        };

        const DocProto = (uw.Document && uw.Document.prototype) || Document.prototype;
        defineConstProp(DocProto, 'hidden', false);
        defineConstProp(DocProto, 'webkitHidden', false);
        defineConstProp(DocProto, 'visibilityState', 'visible');
        try {
          Object.defineProperty(DocProto, 'hasFocus', {
            configurable: true,
            value: function () {
              return true;
            }
          });
        } catch (_) {}

        const stopOn = new Set(['visibilitychange', 'webkitvisibilitychange', 'freeze', 'pagehide']);
        const addSilent = (target, type) => {
          try {
            target.addEventListener(type, (event) => {
              event.stopImmediatePropagation();
            }, true);
          } catch (_) {}
        };

        stopOn.forEach((type) => addSilent(uw.document, type));
        addSilent(uw, 'blur');

        const mediaPrototype = (uw.HTMLMediaElement || HTMLMediaElement).prototype;
        const originalPause = mediaPrototype.pause;
        const originalPlay = mediaPrototype.play;

        const shouldAllowProgrammaticPause = () =>
          (Date.now() - lastUserGesture) <= userGestureWindowMs;

        Object.defineProperty(mediaPrototype, 'pause', {
          configurable: true,
          value: function teGuardedPause() {
            if (shouldAllowProgrammaticPause()) {
              return originalPause.apply(this, arguments);
            }
            try {
              const playPromise = originalPlay.apply(this, []);
              if (playPromise && typeof playPromise.catch === 'function') playPromise.catch(() => {});
            } catch (_) {}
          }
        });

        const resumeIfPaused = (video) => {
          try {
            if (video && video.paused && video.readyState > 2) {
              const playPromise = originalPlay.call(video);
              if (playPromise && typeof playPromise.catch === 'function') playPromise.catch(() => {});
            }
          } catch (_) {}
        };

        new uw.MutationObserver((mutations) => {
          for (const mutation of mutations) {
            mutation.addedNodes && mutation.addedNodes.forEach((node) => {
              if (node && node.nodeType === 1) {
                if (node.tagName === 'VIDEO') resumeIfPaused(node);
                node.querySelectorAll?.('video')?.forEach(resumeIfPaused);
              }
            });
          }
        }).observe(uw.document.documentElement, { childList: true, subtree: true });

        uw.document.addEventListener('pause', (event) => {
          const element = event.target;
          if (element instanceof uw.HTMLMediaElement && !shouldAllowProgrammaticPause()) {
            try {
              event.stopImmediatePropagation();
            } catch (_) {}
            resumeIfPaused(element);
          }
        }, true);

        const NativeIntersectionObserver = uw.IntersectionObserver;
        if (typeof NativeIntersectionObserver === 'function') {
          const IOProxy = function (callback, options) {
            const wrapped = function (entries, observer) {
              const patched = entries.map((entry) => {
                const target = entry.target;
                const isVideoish =
                  target.tagName === 'VIDEO' ||
                  target.closest?.('[data-a-target="player-overlay"],[data-a-target="player-container"]');
                if (isVideoish) {
                  const rect = target.getBoundingClientRect?.() || entry.boundingClientRect;
                  return Object.assign({}, entry, {
                    isIntersecting: true,
                    intersectionRatio: 1,
                    boundingClientRect: rect,
                    intersectionRect: rect,
                    rootBounds: entry.rootBounds
                  });
                }
                return entry;
              });
              try {
                return callback(patched, observer);
              } catch (_) {
                return undefined;
              }
            };
            return new NativeIntersectionObserver(wrapped, options);
          };
          IOProxy.prototype = NativeIntersectionObserver.prototype;
          uw.IntersectionObserver = IOProxy;
        }

        uw.setInterval(() => {
          try {
            uw.dispatchEvent(new uw.MouseEvent('mousemove', { bubbles: true }));
          } catch (_) {}
        }, 30000);

        if (settings.requestWakeLock) {
          try {
            uw.navigator.wakeLock?.request?.('screen').catch(() => {});
          } catch (_) {}
        }

        if (!settings.autoRecoverOverlays) {
          return;
        }

        let lastStartWatchingClick = 0;
        const tryClickStartWatching = () => {
          const now = Date.now();
          if (now - lastStartWatchingClick < 3000) return;

          const button = uw.document.querySelector(
            '[data-a-target="content-classification-gate-overlay-start-watching-button"]'
          );

          if (button && !button.disabled) {
            lastStartWatchingClick = now;
            button.click();
          }
        };

        new uw.MutationObserver(tryClickStartWatching).observe(uw.document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true
        });

        let lastOverlayHandled = 0;
        const tryRecoverStream = () => {
          const overlay = uw.document.querySelector('[data-a-target="player-overlay-content-gate"]');
          if (!overlay) return;

          const now = Date.now();
          if (now - lastOverlayHandled < 3000) return;

          const button = overlay.querySelector('button:not([disabled])');
          if (button) {
            lastOverlayHandled = now;
            button.click();
          }
        };

        new uw.MutationObserver(tryRecoverStream).observe(uw.document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true
        });
      }

      return {
        updateSettings(nextSettings) {
          settings = {
            enabled: typeof nextSettings.enabled === 'boolean' ? nextSettings.enabled : true,
            requestWakeLock:
              typeof nextSettings.requestWakeLock === 'boolean' ? nextSettings.requestWakeLock : false,
            autoRecoverOverlays:
              typeof nextSettings.autoRecoverOverlays === 'boolean' ? nextSettings.autoRecoverOverlays : true
          };

          if (settings.enabled) {
            activate();
          }
        }
      };
    }
  });
})();

