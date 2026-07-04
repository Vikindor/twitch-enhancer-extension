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
      function applySettings(settings) {
        const enabled = settings.enabled === true;

        for (const [id, attribute] of Object.entries(ANNOYANCE_ATTRIBUTES)) {
          document.documentElement.toggleAttribute(attribute, enabled && settings[id] !== false);
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
