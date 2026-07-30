(function () {
  'use strict';

  function registerModule(definition) {
    window.__twitchEnhancerModuleDefinitions = window.__twitchEnhancerModuleDefinitions || [];
    window.__twitchEnhancerModuleDefinitions.push(definition);
  }

  const DEFAULT_SETTINGS = {
    enabled: true,
    muteOnLow: true,
    muteTarget: 'tab',
    persistSelection: true,
    forceUnmuteBothOnHigh: true,
    preferredHigh: null,
    preferHighestBitrateMatch: true
  };

  const QUALITY_STORAGE_KEYS = {
    highestAvailable: 'video-quality-highest-available',
    bitrate: 'quality-bitrate',
    quality: 'video-quality',
    muted: 'video-muted'
  };

  const PLAYER_SELECTOR = '[data-a-target="video-player"]';
  const REACT_FIBER_PREFIX = '__reactFiber';
  const MAXIMUM_FIBER_SEARCH_DEPTH = 6;

  registerModule({
    id: 'toggleVideoQuality',
    create(context) {
      let settings = { ...DEFAULT_SETTINGS };

      function normalizeSettings(nextSettings) {
        return {
          enabled:
            typeof nextSettings.enabled === 'boolean'
              ? nextSettings.enabled
              : DEFAULT_SETTINGS.enabled,
          muteOnLow:
            typeof nextSettings.muteOnLow === 'boolean'
              ? nextSettings.muteOnLow
              : DEFAULT_SETTINGS.muteOnLow,
          muteTarget:
            nextSettings.muteTarget === 'video'
              ? 'video'
              : DEFAULT_SETTINGS.muteTarget,
          persistSelection:
            typeof nextSettings.persistSelection === 'boolean'
              ? nextSettings.persistSelection
              : DEFAULT_SETTINGS.persistSelection,
          forceUnmuteBothOnHigh:
            typeof nextSettings.forceUnmuteBothOnHigh === 'boolean'
              ? nextSettings.forceUnmuteBothOnHigh
              : DEFAULT_SETTINGS.forceUnmuteBothOnHigh,
          preferredHigh:
            typeof nextSettings.preferredHigh === 'number' &&
            Number.isFinite(nextSettings.preferredHigh)
              ? nextSettings.preferredHigh
              : DEFAULT_SETTINGS.preferredHigh,
          preferHighestBitrateMatch:
            typeof nextSettings.preferHighestBitrateMatch === 'boolean'
              ? nextSettings.preferHighestBitrateMatch
              : DEFAULT_SETTINGS.preferHighestBitrateMatch
        };
      }

      function persistQuality(quality) {
        if (
          !settings.persistSelection ||
          !quality ||
          !quality.group
        ) {
          return;
        }

        try {
          localStorage.setItem(QUALITY_STORAGE_KEYS.highestAvailable, 'false');

          const bitrate = Number(quality.bitrate);
          if (Number.isFinite(bitrate) && bitrate > 0) {
            localStorage.setItem(
              QUALITY_STORAGE_KEYS.bitrate,
              String(bitrate)
            );
          }

          localStorage.setItem(
            QUALITY_STORAGE_KEYS.quality,
            JSON.stringify({ default: quality.group })
          );
        } catch (_) {}
      }

      function persistMute(muted) {
        if (!settings.persistSelection) {
          return;
        }

        try {
          localStorage.setItem(
            QUALITY_STORAGE_KEYS.muted,
            JSON.stringify({ default: muted })
          );
        } catch (_) {}
      }

      function getTwitchPlayer() {
        const playerNode = document.querySelector(PLAYER_SELECTOR);
        if (!playerNode) {
          return null;
        }

        const fiberKey = Object.keys(playerNode).find((key) =>
          key.startsWith(REACT_FIBER_PREFIX)
        );
        if (!fiberKey) {
          return null;
        }

        const fiber = playerNode[fiberKey];
        let foundPlayer = null;

        function findPlayerApi(
          object,
          depth = 0,
          seen = new WeakSet()
        ) {
          if (!object || typeof object !== 'object' || seen.has(object)) {
            return;
          }
          seen.add(object);

          if (
            typeof object.setQuality === 'function' &&
            typeof object.getQualities === 'function' &&
            typeof object.getQuality === 'function'
          ) {
            foundPlayer = object;
            return;
          }

          if (depth > MAXIMUM_FIBER_SEARCH_DEPTH) {
            return;
          }

          for (const key in object) {
            try {
              findPlayerApi(object[key], depth + 1, seen);
            } catch (_) {}
          }
        }

        findPlayerApi(fiber);
        return foundPlayer;
      }

      function extractHeight(quality) {
        const match = quality.name.match(/^(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      }

      function getLowestBitrateQuality(qualities) {
        return qualities.reduce((lowest, quality) =>
          quality.bitrate < lowest.bitrate ? quality : lowest
        );
      }

      function getHighestBitrateQuality(qualities) {
        return qualities.reduce((highest, quality) =>
          quality.bitrate > highest.bitrate ? quality : highest
        );
      }

      function getPreferredHighQuality(qualities) {
        if (settings.preferredHigh === null) {
          return null;
        }

        const preferredMatches = qualities.filter(
          (quality) => extractHeight(quality) === settings.preferredHigh
        );

        if (!preferredMatches.length) {
          return null;
        }

        return settings.preferHighestBitrateMatch
          ? getHighestBitrateQuality(preferredMatches)
          : preferredMatches[0];
      }

      function getHighQuality(qualities) {
        return (
          getPreferredHighQuality(qualities) ||
          getHighestBitrateQuality(qualities)
        );
      }

      async function muteConfiguredTarget(player) {
        if (!settings.muteOnLow) {
          return;
        }

        if (settings.muteTarget === 'tab') {
          // Browser tab muting survives page reloads on its own. Do not write
          // Twitch's video-muted preference here, or the player is muted too.
          await context.requestTabMuted(true);
          return;
        }

        player.setMuted(true);
        persistMute(true);
      }

      async function unmuteTabAndPlayer(player) {
        const results = await Promise.allSettled([
          context.requestTabMuted(false),
          Promise.resolve().then(() => {
            player.setMuted(false);
            return true;
          })
        ]);

        const tabWasUnmuted =
          results[0].status === 'fulfilled' && results[0].value;
        const playerWasUnmuted = results[1].status === 'fulfilled';

        if (tabWasUnmuted || playerWasUnmuted) {
          persistMute(false);
        }
      }

      async function switchToHighQuality(player, quality) {
        player.setQuality(quality);

        if (settings.forceUnmuteBothOnHigh) {
          await unmuteTabAndPlayer(player);
        }

        persistQuality(quality);
        return { ok: true, mode: 'high' };
      }

      async function switchToLowQuality(player, quality) {
        player.setQuality(quality);
        await muteConfiguredTarget(player);
        persistQuality(quality);
        return { ok: true, mode: 'low' };
      }

      async function toggleQuality() {
        if (!settings.enabled) {
          return { ok: false, reason: 'module-disabled' };
        }

        const player = getTwitchPlayer();
        if (!player) {
          return { ok: false, reason: 'player-not-found' };
        }

        const qualities = player.getQualities();
        if (!qualities || !qualities.length) {
          return { ok: false, reason: 'qualities-not-found' };
        }

        const currentQuality = player.getQuality();
        if (!currentQuality || !currentQuality.group) {
          return { ok: false, reason: 'current-quality-not-found' };
        }

        const lowQuality = getLowestBitrateQuality(qualities);
        const highQuality = getHighQuality(qualities);
        const isCurrentlyLow = currentQuality.group === lowQuality.group;

        return isCurrentlyLow
          ? switchToHighQuality(player, highQuality)
          : switchToLowQuality(player, lowQuality);
      }

      return {
        updateSettings(nextSettings) {
          settings = normalizeSettings(nextSettings);
        },
        handleCommand(command) {
          if (command !== 'toggle') {
            return Promise.resolve({
              ok: false,
              reason: 'unknown-command'
            });
          }

          return toggleQuality();
        }
      };
    }
  });
})();
