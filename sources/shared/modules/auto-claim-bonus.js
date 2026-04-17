(function () {
  'use strict';

  function registerModule(definition) {
    window.__twitchEnhancerModuleDefinitions = window.__twitchEnhancerModuleDefinitions || [];
    window.__twitchEnhancerModuleDefinitions.push(definition);
  }

  registerModule({
    id: 'autoClaimBonus',
    create() {
      let settings = {
        enabled: true,
        intervalSeconds: 15
      };
      let intervalId = null;

      function getIntervalMs() {
        const seconds =
          typeof settings.intervalSeconds === 'number' &&
          Number.isFinite(settings.intervalSeconds) &&
          settings.intervalSeconds >= 5
            ? Math.round(settings.intervalSeconds)
            : 15;

        return seconds * 1000;
      }

      function findClaimButton() {
        return (
          document.querySelector(
            '.community-points-summary button[aria-label="Claim Bonus"], [data-test-selector="community-points-summary"] button[aria-label="Claim Bonus"]'
          ) ||
          document.querySelector('button[aria-label="Claim Bonus"]')
        );
      }

      function tryClaimBonus() {
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

      function restartPolling() {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }

        if (!settings.enabled) {
          return;
        }

        tryClaimBonus();
        intervalId = window.setInterval(tryClaimBonus, getIntervalMs());
      }

      restartPolling();

      return {
        updateSettings(nextSettings) {
          settings = {
            enabled: typeof nextSettings.enabled === 'boolean' ? nextSettings.enabled : true,
            intervalSeconds:
              typeof nextSettings.intervalSeconds === 'number' &&
              Number.isFinite(nextSettings.intervalSeconds) &&
              nextSettings.intervalSeconds >= 5
                ? Math.round(nextSettings.intervalSeconds)
                : 15
          };

          restartPolling();
        }
      };
    }
  });
})();
