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
    saveYourStreakLeftPanel: 'data-twitch-enhancer-block-save-your-streak-left-panel',
    chatLeaderboardAndGoals: 'data-twitch-enhancer-block-chat-leaderboard-and-goals',
    stickyCommunityHighlight: 'data-twitch-enhancer-block-sticky-community-highlight',
    chatBitsBalance: 'data-twitch-enhancer-block-chat-bits-balance',
    allPlayerExtensions: 'data-twitch-enhancer-block-all-player-extensions',
    extensionsDockButtons: 'data-twitch-enhancer-block-extensions-dock-buttons',
    primeBenefitsExtension: 'data-twitch-enhancer-block-prime-benefits-extension',
    underPlayerBitsButton: 'data-twitch-enhancer-block-under-player-bits-button',
    giftSubsButton: 'data-twitch-enhancer-block-gift-subs-button',
    subscribeButton: 'data-twitch-enhancer-block-subscribe-button',
    continueSubButton: 'data-twitch-enhancer-block-continue-sub-button',
    subscriptionOfferBanner: 'data-twitch-enhancer-block-subscription-offer-banner'
  };

  registerModule({
    id: 'blockAnnoyances',
    create() {
      const CAROUSEL_SELECTOR =
        '[data-a-target="front-page-carousel"], [data-a-player-type="frontpage"]';
      const FRONTPAGE_PLAYER_SELECTOR = '[data-a-player-type="frontpage"]';
      const PLAY_PAUSE_BUTTON_SELECTOR =
        '[data-a-target="player-play-pause-button"]';
      const CAROUSEL_PLAY_BUTTON_SELECTOR =
        '[data-a-target="front-page-carousel"] ' + PLAY_PAUSE_BUTTON_SELECTOR;
      const CAROUSEL_VIDEO_SELECTOR =
        '[data-a-target="front-page-carousel"] video, ' +
        '[data-a-player-type="frontpage"] video';
      const PHONE_PROMPT_BUTTON_SELECTOR =
        '[data-a-target="account-checkup-no-phone-warning-modal"] ' +
        '[data-a-target="account-checkup-generic-modal-secondary-button"]';
      const PLAYER_STOP_GUARD_MS = 1000;
      const originalPlay = HTMLMediaElement.prototype.play;
      const stoppingPlayers = new WeakSet();
      const dismissedPhonePromptButtons = new WeakSet();

      const behavior = {
        dismissPhoneNumberPromptEnabled: false,
        autoPausePromotedStreamsEnabled: false,
        promotedStreamsManuallyEnabled: false
      };

      function isCarouselMedia(media) {
        return Boolean(
          media &&
            typeof media.closest === 'function' &&
            media.closest(CAROUSEL_SELECTOR)
        );
      }

      function shouldPausePlayback(media) {
        return (
          behavior.autoPausePromotedStreamsEnabled &&
          isCarouselMedia(media) &&
          !behavior.promotedStreamsManuallyEnabled
        );
      }

      function disableNativeAutoplay(media) {
        if (
          !behavior.autoPausePromotedStreamsEnabled ||
          !isCarouselMedia(media)
        ) {
          return;
        }

        media.autoplay = false;
        media.removeAttribute('autoplay');
      }

      function disableCarouselAutoplay(root) {
        if (!behavior.autoPausePromotedStreamsEnabled || !root) {
          return;
        }

        if (root instanceof HTMLVideoElement) {
          disableNativeAutoplay(root);
        }

        if (typeof root.querySelectorAll === 'function') {
          root.querySelectorAll('video').forEach(disableNativeAutoplay);
        }
      }

      function dismissPhoneNumberPrompt(root) {
        if (
          !behavior.dismissPhoneNumberPromptEnabled ||
          !(root instanceof Element)
        ) {
          return;
        }

        const button = root.matches(PHONE_PROMPT_BUTTON_SELECTOR)
          ? root
          : root.querySelector(PHONE_PROMPT_BUTTON_SELECTOR);

        if (!button || dismissedPhonePromptButtons.has(button)) {
          return;
        }

        dismissedPhonePromptButtons.add(button);
        button.click();
      }

      function pauseCarouselPlayer(media) {
        if (!shouldPausePlayback(media)) {
          return false;
        }

        const player =
          media.closest(FRONTPAGE_PLAYER_SELECTOR) ||
          media.closest('[data-a-target="front-page-carousel"]');
        const pauseButton = player?.querySelector(PLAY_PAUSE_BUTTON_SELECTOR);

        if (!player || !pauseButton || stoppingPlayers.has(player)) {
          return false;
        }

        stoppingPlayers.add(player);
        pauseButton.click();
        setTimeout(() => {
          stoppingPlayers.delete(player);
        }, PLAYER_STOP_GUARD_MS);
        return true;
      }

      function handlePointerDown(event) {
        if (
          !behavior.autoPausePromotedStreamsEnabled ||
          !event.isTrusted ||
          !(event.target instanceof Element)
        ) {
          return;
        }

        const playButton = event.target.closest(CAROUSEL_PLAY_BUTTON_SELECTOR);
        const video = playButton
          ?.closest(FRONTPAGE_PLAYER_SELECTOR)
          ?.querySelector('video');

        if (video?.paused) {
          behavior.promotedStreamsManuallyEnabled = true;
        }
      }

      function handleKeyDown(event) {
        const key = event.key.toLowerCase();
        if (
          !behavior.autoPausePromotedStreamsEnabled ||
          !event.isTrusted ||
          (key !== 'k' && key !== ' ')
        ) {
          return;
        }

        const video = document.querySelector(
          '[data-a-target="front-page-carousel"] ' +
            FRONTPAGE_PLAYER_SELECTOR +
            ' video'
        );

        if (video?.paused) {
          behavior.promotedStreamsManuallyEnabled = true;
        }
      }

      function handlePlaying(event) {
        pauseCarouselPlayer(event.target);
      }

      function handleMutations(mutations) {
        for (const mutation of mutations) {
          if (mutation.type === 'attributes') {
            if (behavior.autoPausePromotedStreamsEnabled) {
              disableNativeAutoplay(mutation.target);
            }
            continue;
          }

          mutation.addedNodes.forEach((node) => {
            disableCarouselAutoplay(node);
            dismissPhoneNumberPrompt(node);
          });
        }
      }

      function installMediaPlaybackGuard() {
        HTMLMediaElement.prototype.play = function (...args) {
          if (shouldPausePlayback(this)) {
            disableNativeAutoplay(this);
          }

          return originalPlay.apply(this, args);
        };

        document.addEventListener('playing', handlePlaying, true);
      }

      function installManualPlaybackTracking() {
        document.addEventListener('pointerdown', handlePointerDown, true);
        document.addEventListener('keydown', handleKeyDown, true);
      }

      function startPageObserver() {
        const observer = new MutationObserver(handleMutations);
        observer.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ['autoplay'],
          childList: true,
          subtree: true
        });
      }

      function updateBehaviorSettings(settings) {
        const enabled = settings.enabled === true;
        behavior.dismissPhoneNumberPromptEnabled =
          enabled && settings.dismissPhoneNumberPrompt !== false;
        behavior.autoPausePromotedStreamsEnabled =
          enabled && settings.autoPausePromotedStreams !== false;
      }

      function applyAnnoyanceAttributes(settings) {
        const enabled = settings.enabled === true;

        for (const [id, attribute] of Object.entries(ANNOYANCE_ATTRIBUTES)) {
          document.documentElement.toggleAttribute(
            attribute,
            enabled && settings[id] !== false
          );
        }
      }

      function applyEnabledActions() {
        if (behavior.dismissPhoneNumberPromptEnabled) {
          dismissPhoneNumberPrompt(document.documentElement);
        }

        if (!behavior.autoPausePromotedStreamsEnabled) {
          return;
        }

        disableCarouselAutoplay(document);
        document.querySelectorAll(CAROUSEL_VIDEO_SELECTOR).forEach((video) => {
          if (!video.paused && !behavior.promotedStreamsManuallyEnabled) {
            pauseCarouselPlayer(video);
          }
        });
      }

      function applySettings(settings) {
        updateBehaviorSettings(settings);
        applyAnnoyanceAttributes(settings);
        applyEnabledActions();
      }

      installMediaPlaybackGuard();
      installManualPlaybackTracking();
      startPageObserver();

      return {
        updateSettings(settings) {
          applySettings(settings || {});
        }
      };
    }
  });
})();
