(function () {
  'use strict';

  function registerModule(definition) {
    window.__twitchEnhancerModuleDefinitions = window.__twitchEnhancerModuleDefinitions || [];
    window.__twitchEnhancerModuleDefinitions.push(definition);
  }

  registerModule({
    id: 'toggleVideoQuality',
    create(context) {
      let settings = {
        enabled: true,
        preferredHigh: 1080,
        preferHighestBitrateMatch: true,
        muteOnLow: true,
        muteTarget: 'tab',
        persistSelection: true,
        forceUnmuteBothOnHigh: true
      };

      function persistQuality(group) {
        if (!settings.persistSelection) return;

        try {
          localStorage.setItem('video-quality', JSON.stringify({ default: group }));
        } catch (_) {}
      }

      function persistMute(isMuted) {
        if (!settings.persistSelection) return;

        try {
          localStorage.setItem('video-muted', JSON.stringify({ default: isMuted }));
        } catch (_) {}
      }

      function getTwitchPlayer() {
        const node = document.querySelector('[data-a-target="video-player"]');
        if (!node) return null;

        const fiberKey = Object.keys(node).find((key) => key.startsWith('__reactFiber'));
        if (!fiberKey) return null;

        const fiber = node[fiberKey];
        let found = null;

        (function find(obj, depth = 0, maxDepth = 6, seen = new WeakSet()) {
          if (!obj || typeof obj !== 'object') return;
          if (seen.has(obj)) return;
          seen.add(obj);

          if (
            typeof obj.setQuality === 'function' &&
            typeof obj.getQualities === 'function' &&
            typeof obj.getQuality === 'function'
          ) {
            found = obj;
            return;
          }

          if (depth > maxDepth) return;

          for (const key in obj) {
            try {
              find(obj[key], depth + 1, maxDepth, seen);
            } catch (_) {}
          }
        })(fiber);

        return found;
      }

      function extractHeight(quality) {
        const match = quality.name.match(/^(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      }

      function getHighestBitrateQuality(qualities) {
        return qualities.reduce((max, quality) =>
          quality.bitrate > max.bitrate ? quality : max
        );
      }

      async function setMuteState(player, muted) {
        if (!settings.muteOnLow) {
          return;
        }

        if (settings.muteTarget === 'tab') {
          const ok = await context.requestTabMuted(muted);
          if (ok) {
            persistMute(muted);
          }
          return;
        }

        player.setMuted(muted);
        persistMute(muted);
      }

      async function forceUnmuteEverywhere(player) {
        const results = await Promise.allSettled([
          context.requestTabMuted(false),
          Promise.resolve().then(() => {
            player.setMuted(false);
            return true;
          })
        ]);

        const changedAnything =
          (results[0].status === 'fulfilled' && results[0].value) ||
          results[1].status === 'fulfilled';

        if (changedAnything) {
          persistMute(false);
        }
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

        const current = player.getQuality();
        if (!current || !current.group) {
          return { ok: false, reason: 'current-quality-not-found' };
        }

        const lowest = qualities.reduce((min, quality) =>
          quality.bitrate < min.bitrate ? quality : min
        );

        let preferredHigh = null;
        if (settings.preferredHigh != null) {
          const preferredMatches = qualities.filter(
            (quality) => extractHeight(quality) === settings.preferredHigh
          );

          if (preferredMatches.length) {
            preferredHigh = settings.preferHighestBitrateMatch
              ? getHighestBitrateQuality(preferredMatches)
              : preferredMatches[0];
          }
        }

        const highestAvailable = getHighestBitrateQuality(qualities);

        const high = preferredHigh || highestAvailable;
        const isCurrentlyLowest = current.group === lowest.group;

        if (isCurrentlyLowest) {
          player.setQuality(high);
          if (settings.forceUnmuteBothOnHigh) {
            await forceUnmuteEverywhere(player);
          } else if (settings.muteOnLow) {
            await setMuteState(player, false);
          }
          persistQuality(high.group);
          return { ok: true, mode: 'high' };
        }

        player.setQuality(lowest);
        if (settings.muteOnLow) {
          await setMuteState(player, true);
        }
        persistQuality(lowest.group);
        return { ok: true, mode: 'low' };
      }

      return {
        updateSettings(nextSettings) {
          settings = {
            enabled: typeof nextSettings.enabled === 'boolean' ? nextSettings.enabled : true,
            preferredHigh:
              typeof nextSettings.preferredHigh === 'number' && Number.isFinite(nextSettings.preferredHigh)
                ? nextSettings.preferredHigh
                : null,
            preferHighestBitrateMatch:
              typeof nextSettings.preferHighestBitrateMatch === 'boolean'
                ? nextSettings.preferHighestBitrateMatch
                : true,
            muteOnLow: typeof nextSettings.muteOnLow === 'boolean' ? nextSettings.muteOnLow : true,
            muteTarget: nextSettings.muteTarget === 'video' ? 'video' : 'tab',
            persistSelection:
              typeof nextSettings.persistSelection === 'boolean' ? nextSettings.persistSelection : true,
            forceUnmuteBothOnHigh:
              typeof nextSettings.forceUnmuteBothOnHigh === 'boolean'
                ? nextSettings.forceUnmuteBothOnHigh
                : false
          };
        },
        handleCommand(command) {
          if (command !== 'toggle') {
            return Promise.resolve({ ok: false, reason: 'unknown-command' });
          }

          return toggleQuality();
        }
      };
    }
  });
})();

