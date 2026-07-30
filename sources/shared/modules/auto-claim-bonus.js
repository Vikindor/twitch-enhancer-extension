(function () {
  'use strict';

  function registerModule(definition) {
    window.__twitchEnhancerModuleDefinitions = window.__twitchEnhancerModuleDefinitions || [];
    window.__twitchEnhancerModuleDefinitions.push(definition);
  }

  registerModule({
    id: 'autoClaimBonus',
    create() {
      const DEFAULT_INTERVAL_SECONDS = 15;
      const MINIMUM_INTERVAL_SECONDS = 5;
      const PRIMARY_CLAIM_BUTTON_SELECTOR = [
        '.community-points-summary button[aria-label="Claim Bonus"]',
        '[data-test-selector="community-points-summary"] button[aria-label="Claim Bonus"]'
      ].join(',');
      const FALLBACK_CLAIM_BUTTON_SELECTOR = 'button[aria-label="Claim Bonus"]';

      let settings = {
        enabled: true,
        intervalSeconds: DEFAULT_INTERVAL_SECONDS
      };
      let intervalId = null;

      function normalizeIntervalSeconds(value) {
        return (
          typeof value === 'number' &&
          Number.isFinite(value) &&
          value >= MINIMUM_INTERVAL_SECONDS
            ? Math.round(value)
            : DEFAULT_INTERVAL_SECONDS
        );
      }

      function getIntervalMs() {
        return settings.intervalSeconds * 1000;
      }

      function findClaimButton() {
        return (
          document.querySelector(PRIMARY_CLAIM_BUTTON_SELECTOR) ||
          document.querySelector(FALLBACK_CLAIM_BUTTON_SELECTOR)
        );
      }

      function claimBonus() {
        if (!settings.enabled) {
          return;
        }

        const button = findClaimButton();
        if (!button || button.disabled) {
          return;
        }

        try {
          button.click();
        } catch (_) {}
      }

      function stopPolling() {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      }

      function startPolling() {
        if (!settings.enabled) {
          return;
        }

        claimBonus();
        intervalId = window.setInterval(claimBonus, getIntervalMs());
      }

      function restartPolling() {
        stopPolling();
        startPolling();
      }

      startPolling();

      return {
        updateSettings(nextSettings) {
          settings = {
            enabled:
              typeof nextSettings.enabled === 'boolean' ? nextSettings.enabled : true,
            intervalSeconds: normalizeIntervalSeconds(nextSettings.intervalSeconds)
          };

          restartPolling();
        }
      };
    }
  });
})();
