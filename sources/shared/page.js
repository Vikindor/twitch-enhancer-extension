(function () {
  'use strict';

  let muteRequestCounter = 0;
  const pendingMuteRequests = new Map();

  function persistQuality(group, settings) {
    if (!settings.persistSelection) return;

    try {
      localStorage.setItem(
        'video-quality',
        JSON.stringify({ default: group })
      );
    } catch (e) {}
  }

  function persistMute(isMuted, settings) {
    if (!settings.persistSelection) return;

    try {
      localStorage.setItem(
        'video-muted',
        JSON.stringify({ default: isMuted })
      );
    } catch (e) {}
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
        } catch (e) {}
      }
    })(fiber);

    return found;
  }

  function extractHeight(quality) {
    const match = quality.name.match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  function requestTabMuted(muted) {
    return new Promise((resolve) => {
      const requestId = `mute-${Date.now()}-${++muteRequestCounter}`;
      pendingMuteRequests.set(requestId, resolve);

      window.postMessage(
        {
          source: 'ttvq-extension-page',
          type: 'ttvq-set-tab-muted',
          requestId,
          muted
        },
        window.location.origin
      );
    });
  }

  async function setMuteState(player, muted, settings) {
    if (!settings.muteOnLow) {
      return;
    }

    if (settings.muteTarget === 'tab') {
      const ok = await requestTabMuted(muted);
      if (ok) {
        persistMute(muted, settings);
      }
      return;
    }

    player.setMuted(muted);
    persistMute(muted, settings);
  }

  async function forceUnmuteEverywhere(player, settings) {
    const results = await Promise.allSettled([
      requestTabMuted(false),
      Promise.resolve().then(() => {
        player.setMuted(false);
        return true;
      })
    ]);

    const tabResult = results[0];
    const playerResult = results[1];
    const changedAnything =
      (tabResult.status === 'fulfilled' && tabResult.value) ||
      playerResult.status === 'fulfilled';

    if (changedAnything) {
      persistMute(false, settings);
    }
  }

  async function toggleQuality(settings) {
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
      preferredHigh = qualities.find((quality) =>
        extractHeight(quality) === settings.preferredHigh
      ) || null;
    }

    const highestAvailable = qualities.reduce((max, quality) =>
      quality.bitrate > max.bitrate ? quality : max
    );

    const high = preferredHigh || highestAvailable;
    const isCurrentlyLowest = current.group === lowest.group;

    if (isCurrentlyLowest) {
      player.setQuality(high);
      if (settings.forceUnmuteBothOnHigh) {
        await forceUnmuteEverywhere(player, settings);
      } else if (settings.muteOnLow) {
        await setMuteState(player, false, settings);
      }
      persistQuality(high.group, settings);
      return { ok: true, mode: 'high' };
    }

    player.setQuality(lowest);
    if (settings.muteOnLow) {
      await setMuteState(player, true, settings);
    }
    persistQuality(lowest.group, settings);
    return { ok: true, mode: 'low' };
  }

  window.addEventListener('message', async (event) => {
    if (event.source !== window || !event.data) {
      return;
    }

    const { data } = event;

    if (data.source === 'ttvq-extension-content' && data.type === 'ttvq-set-tab-muted-result') {
      const resolve = pendingMuteRequests.get(data.requestId);
      if (resolve) {
        pendingMuteRequests.delete(data.requestId);
        resolve(Boolean(data.ok));
      }
      return;
    }

    if (data.source !== 'ttvq-extension-content' || data.type !== 'ttvq-toggle-quality') {
      return;
    }

    const settings = {
      preferredHigh:
        data.settings && typeof data.settings.preferredHigh === 'number'
          ? data.settings.preferredHigh
          : null,
      muteOnLow: Boolean(data.settings && data.settings.muteOnLow),
      muteTarget:
        data.settings && data.settings.muteTarget === 'video'
          ? 'video'
          : 'tab',
      persistSelection:
        data.settings && typeof data.settings.persistSelection === 'boolean'
          ? data.settings.persistSelection
          : true,
      forceUnmuteBothOnHigh:
        data.settings && typeof data.settings.forceUnmuteBothOnHigh === 'boolean'
          ? data.settings.forceUnmuteBothOnHigh
          : false
    };

    try {
      const result = await toggleQuality(settings);
      window.postMessage(
        {
          source: 'ttvq-extension-page',
          type: 'ttvq-toggle-quality-result',
          requestId: data.requestId,
          result
        },
        window.location.origin
      );
    } catch (error) {
      window.postMessage(
        {
          source: 'ttvq-extension-page',
          type: 'ttvq-toggle-quality-result',
          requestId: data.requestId,
          result: {
            ok: false,
            reason: 'unexpected-error',
            message: String(error)
          }
        },
        window.location.origin
      );
    }
  });

  window.postMessage(
    {
      source: 'ttvq-extension-page',
      type: 'ttvq-page-ready'
    },
    window.location.origin
  );
})();
