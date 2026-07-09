(function () {
  'use strict';

  function registerModule(definition) {
    window.__twitchEnhancerModuleDefinitions = window.__twitchEnhancerModuleDefinitions || [];
    window.__twitchEnhancerModuleDefinitions.push(definition);
  }

  const ANNOYANCE_ATTRIBUTES = {
    consentBanner: 'data-twitch-enhancer-block-consent-banner',
    newsFromLuna: 'data-twitch-enhancer-block-news-from-luna',
    bitsButton: 'data-twitch-enhancer-block-bits-button',
    goAdFreeButton: 'data-twitch-enhancer-block-go-ad-free-button',
    storiesLeftPanel: 'data-twitch-enhancer-block-stories-left-panel',
    chatLeaderboardAndGoals: 'data-twitch-enhancer-block-chat-leaderboard-and-goals',
    allPlayerExtensions: 'data-twitch-enhancer-block-all-player-extensions',
    extensionsDockButtons: 'data-twitch-enhancer-block-extensions-dock-buttons',
    primeBenefitsExtension: 'data-twitch-enhancer-block-prime-benefits-extension',
    underPlayerBitsButton: 'data-twitch-enhancer-block-under-player-bits-button',
    giftSubsButton: 'data-twitch-enhancer-block-gift-subs-button',
    subscribeButton: 'data-twitch-enhancer-block-subscribe-button',
    continueSubButton: 'data-twitch-enhancer-block-continue-sub-button'
  };

  registerModule({
    id: 'blockAnnoyances',
    create() {
      const originalPlay = HTMLMediaElement.prototype.play;
      const stoppingPlayers = new WeakSet();
      let autoPausePromotedStreamsEnabled = false;
      let promotedStreamsManuallyEnabled = false;

      function isCarouselMedia(media) {
        return Boolean(
          media &&
          typeof media.closest === 'function' &&
          media.closest(
            '[data-a-target="front-page-carousel"], [data-a-player-type="frontpage"]'
          )
        );
      }

      function shouldBlockPlayback(media) {
        return (
          autoPausePromotedStreamsEnabled &&
          isCarouselMedia(media) &&
          !promotedStreamsManuallyEnabled
        );
      }

      function disableNativeAutoplay(media) {
        if (!autoPausePromotedStreamsEnabled || !isCarouselMedia(media)) return;

        media.autoplay = false;
        media.removeAttribute('autoplay');
      }

      function scanForCarouselVideos(root) {
        if (!autoPausePromotedStreamsEnabled || !root) return;

        if (root instanceof HTMLVideoElement) {
          disableNativeAutoplay(root);
        }

        if (typeof root.querySelectorAll === 'function') {
          root.querySelectorAll('video').forEach(disableNativeAutoplay);
        }
      }

      function stopCarouselPlayer(media) {
        if (!shouldBlockPlayback(media)) return false;

        const player =
          media.closest('[data-a-player-type="frontpage"]') ||
          media.closest('[data-a-target="front-page-carousel"]');
        const pauseButton = player?.querySelector(
          '[data-a-target="player-play-pause-button"]'
        );

        if (!player || !pauseButton || stoppingPlayers.has(player)) {
          return false;
        }

        stoppingPlayers.add(player);
        pauseButton.click();
        setTimeout(() => stoppingPlayers.delete(player), 1000);
        return true;
      }

      HTMLMediaElement.prototype.play = function (...args) {
        if (shouldBlockPlayback(this)) {
          disableNativeAutoplay(this);
        }

        return originalPlay.apply(this, args);
      };

      document.addEventListener('pointerdown', (event) => {
        if (!autoPausePromotedStreamsEnabled || !event.isTrusted) return;
        if (!(event.target instanceof Element)) return;

        const playButton = event.target.closest(
          '[data-a-target="front-page-carousel"] ' +
          '[data-a-target="player-play-pause-button"]'
        );
        const video = playButton
          ?.closest('[data-a-player-type="frontpage"]')
          ?.querySelector('video');

        if (video?.paused) {
          promotedStreamsManuallyEnabled = true;
        }
      }, true);

      document.addEventListener('keydown', (event) => {
        const key = event.key.toLowerCase();
        if (!autoPausePromotedStreamsEnabled || !event.isTrusted) return;
        if (key !== 'k' && key !== ' ') return;

        const video = document.querySelector(
          '[data-a-target="front-page-carousel"] [data-a-player-type="frontpage"] video'
        );

        if (video?.paused) {
          promotedStreamsManuallyEnabled = true;
        }
      }, true);

      document.addEventListener('playing', (event) => {
        const media = event.target;
        stopCarouselPlayer(media);
      }, true);

      const autoplayObserver = new MutationObserver((mutations) => {
        if (!autoPausePromotedStreamsEnabled) return;

        for (const mutation of mutations) {
          if (mutation.type === 'attributes') {
            disableNativeAutoplay(mutation.target);
            continue;
          }

          mutation.addedNodes.forEach(scanForCarouselVideos);
        }
      });

      autoplayObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['autoplay'],
        childList: true,
        subtree: true
      });

      function applySettings(settings) {
        const enabled = settings.enabled === true;
        autoPausePromotedStreamsEnabled =
          enabled && settings.autoPausePromotedStreams !== false;

        for (const [id, attribute] of Object.entries(ANNOYANCE_ATTRIBUTES)) {
          document.documentElement.toggleAttribute(attribute, enabled && settings[id] !== false);
        }

        if (autoPausePromotedStreamsEnabled) {
          scanForCarouselVideos(document);
          document
            .querySelectorAll(
              '[data-a-target="front-page-carousel"] video, [data-a-player-type="frontpage"] video'
            )
            .forEach((video) => {
              if (!video.paused && !promotedStreamsManuallyEnabled) {
                stopCarouselPlayer(video);
              }
            });
        }
      }

      return {
        updateSettings(settings) {
          applySettings(settings || {});
        }
      };
    }
  });
})();
