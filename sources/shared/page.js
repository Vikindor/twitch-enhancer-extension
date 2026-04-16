(function () {
  'use strict';

  const definitions = Array.isArray(window.__twitchEnhancerModuleDefinitions)
    ? window.__twitchEnhancerModuleDefinitions
    : [];

  const modules = new Map();
  let currentSettings = null;
  let muteRequestCounter = 0;
  const pendingMuteRequests = new Map();

  function postToContent(message) {
    window.postMessage(
      {
        source: 'twitch-enhancer-page',
        ...message
      },
      window.location.origin
    );
  }

  function requestTabMuted(muted) {
    return new Promise((resolve) => {
      const requestId = `mute-${Date.now()}-${++muteRequestCounter}`;
      pendingMuteRequests.set(requestId, resolve);
      postToContent({
        type: 'twitch-enhancer-set-tab-muted',
        requestId,
        muted
      });
    });
  }

  const context = {
    requestTabMuted,
    getSettings() {
      return currentSettings;
    }
  };

  for (const definition of definitions) {
    if (!definition || !definition.id || typeof definition.create !== 'function') {
      continue;
    }

    try {
      modules.set(definition.id, definition.create(context));
    } catch (error) {
      console.error(`Failed to initialize Twitch Enhancer module ${definition.id}`, error);
    }
  }

  function updateModuleSettings(settings) {
    currentSettings = settings;
    for (const [moduleId, moduleInstance] of modules.entries()) {
      try {
        if (moduleInstance && typeof moduleInstance.updateSettings === 'function') {
          moduleInstance.updateSettings(settings.modules[moduleId] || {});
        }
      } catch (error) {
        console.error(`Failed to update settings for Twitch Enhancer module ${moduleId}`, error);
      }
    }
  }

  async function runModuleCommand(moduleId, command) {
    const moduleInstance = modules.get(moduleId);
    if (!moduleInstance || typeof moduleInstance.handleCommand !== 'function') {
      return { ok: false, reason: 'module-command-not-supported' };
    }

    return moduleInstance.handleCommand(command);
  }

  window.addEventListener('message', async (event) => {
    if (event.source !== window || !event.data || event.data.source !== 'twitch-enhancer-content') {
      return;
    }

    const { data } = event;

    if (data.type === 'twitch-enhancer-init') {
      updateModuleSettings(data.settings || { modules: {} });
      return;
    }

    if (data.type === 'twitch-enhancer-set-tab-muted-result') {
      const resolve = pendingMuteRequests.get(data.requestId);
      if (resolve) {
        pendingMuteRequests.delete(data.requestId);
        resolve(Boolean(data.ok));
      }
      return;
    }

    if (data.type === 'twitch-enhancer-command') {
      try {
        const result = await runModuleCommand(data.moduleId, data.command);
        postToContent({
          type: 'twitch-enhancer-page-state-response',
          requestId: data.requestId,
          result
        });
      } catch (error) {
        postToContent({
          type: 'twitch-enhancer-page-state-response',
          requestId: data.requestId,
          result: {
            ok: false,
            reason: 'unexpected-error',
            message: String(error)
          }
        });
      }
    }
  });

  postToContent({ type: 'twitch-enhancer-page-ready' });
})();
