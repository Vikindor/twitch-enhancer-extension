(function () {
  'use strict';

  const definitions = Array.isArray(window.__twitchEnhancerModuleDefinitions)
    ? window.__twitchEnhancerModuleDefinitions
    : [];

  const CONTENT_MESSAGE_SOURCE = 'twitch-enhancer-content';
  const PAGE_MESSAGE_SOURCE = 'twitch-enhancer-page';
  const MESSAGE_TYPES = {
    command: 'twitch-enhancer-command',
    init: 'twitch-enhancer-init',
    pageReady: 'twitch-enhancer-page-ready',
    pageStateResponse: 'twitch-enhancer-page-state-response',
    setTabMuted: 'twitch-enhancer-set-tab-muted',
    setTabMutedResult: 'twitch-enhancer-set-tab-muted-result'
  };

  const modules = new Map();
  let currentSettings = null;
  let muteRequestCounter = 0;
  const pendingMuteRequests = new Map();

  function postToContent(message) {
    window.postMessage(
      {
        source: PAGE_MESSAGE_SOURCE,
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
        type: MESSAGE_TYPES.setTabMuted,
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

  if (typeof window.__twitchEnhancerGQL?.finishBootstrap === 'function') {
    window.__twitchEnhancerGQL.finishBootstrap();
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

  function postCommandResult(requestId, result) {
    postToContent({
      type: MESSAGE_TYPES.pageStateResponse,
      requestId,
      result
    });
  }

  async function handleContentMessage(event) {
    if (
      event.source !== window ||
      !event.data ||
      event.data.source !== CONTENT_MESSAGE_SOURCE
    ) {
      return;
    }

    const { data } = event;

    if (data.type === MESSAGE_TYPES.init) {
      updateModuleSettings(data.settings || { modules: {} });
      return;
    }

    if (data.type === MESSAGE_TYPES.setTabMutedResult) {
      const resolve = pendingMuteRequests.get(data.requestId);
      if (resolve) {
        pendingMuteRequests.delete(data.requestId);
        resolve(Boolean(data.ok));
      }
      return;
    }

    if (data.type === MESSAGE_TYPES.command) {
      try {
        const result = await runModuleCommand(data.moduleId, data.command);
        postCommandResult(data.requestId, result);
      } catch (error) {
        postCommandResult(data.requestId, {
          ok: false,
          reason: 'unexpected-error',
          message: String(error)
        });
      }
    }
  }

  window.addEventListener('message', handleContentMessage);
  postToContent({ type: MESSAGE_TYPES.pageReady });
})();
