(function () {
  'use strict';

  const api = globalThis.browser ?? globalThis.chrome;

  let bridgeReady = false;
  let requestCounter = 0;
  const pendingRequests = new Map();
  const bridgeWaiters = [];

  function injectPageScript() {
    if (document.getElementById('ttvq-page-script')) {
      return;
    }

    const script = document.createElement('script');
    script.id = 'ttvq-page-script';
    script.src = api.runtime.getURL('page.js');
    script.async = false;
    (document.head || document.documentElement).appendChild(script);
  }

  function setTabMuted(muted) {
    return new Promise((resolve) => {
      api.runtime.sendMessage(
        {
          type: 'set-tab-muted',
          muted
        },
        (response) => {
          const error = api.runtime.lastError;
          if (error || !response || !response.ok) {
            resolve(false);
            return;
          }

          resolve(true);
        }
      );
    });
  }

  function postToggleRequest(settings) {
    return new Promise((resolve) => {
      const requestId = `toggle-${Date.now()}-${++requestCounter}`;
      pendingRequests.set(requestId, resolve);

      window.postMessage(
        {
          source: 'ttvq-extension-content',
          type: 'ttvq-toggle-quality',
          requestId,
          settings
        },
        window.location.origin
      );
    });
  }

  window.addEventListener('message', async (event) => {
    if (event.source !== window || !event.data) {
      return;
    }

    const { data } = event;

    if (data.source !== 'ttvq-extension-page') {
      return;
    }

    if (data.type === 'ttvq-page-ready') {
      bridgeReady = true;
      while (bridgeWaiters.length) {
        const resolve = bridgeWaiters.shift();
        resolve();
      }
      return;
    }

    if (data.type === 'ttvq-set-tab-muted') {
      const ok = await setTabMuted(Boolean(data.muted));

      window.postMessage(
        {
          source: 'ttvq-extension-content',
          type: 'ttvq-set-tab-muted-result',
          requestId: data.requestId,
          ok
        },
        window.location.origin
      );
      return;
    }

    if (data.type === 'ttvq-toggle-quality-result') {
      const resolve = pendingRequests.get(data.requestId);
      if (resolve) {
        pendingRequests.delete(data.requestId);
        resolve(data.result || { ok: false, reason: 'no-result' });
      }
      return;
    }
  });

  function waitForBridgeReady(timeoutMs = 1500) {
    if (bridgeReady) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        const index = bridgeWaiters.indexOf(onReady);
        if (index >= 0) {
          bridgeWaiters.splice(index, 1);
        }
        resolve();
      }, timeoutMs);

      function onReady() {
        clearTimeout(timeoutId);
        resolve();
      }

      bridgeWaiters.push(onReady);
    });
  }

  injectPageScript();

  api.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== 'toggle-quality') {
      return false;
    }

    const settings = {
      preferredHigh:
        message.settings && typeof message.settings.preferredHigh === 'number'
          ? message.settings.preferredHigh
          : null,
      muteOnLow: Boolean(message.settings && message.settings.muteOnLow),
      muteTarget:
        message.settings && message.settings.muteTarget === 'video'
          ? 'video'
          : 'tab',
      persistSelection:
        message.settings && typeof message.settings.persistSelection === 'boolean'
          ? message.settings.persistSelection
          : true,
      forceUnmuteBothOnHigh:
        message.settings && typeof message.settings.forceUnmuteBothOnHigh === 'boolean'
          ? message.settings.forceUnmuteBothOnHigh
          : false
    };

    if (!bridgeReady) {
      injectPageScript();
    }

    waitForBridgeReady()
      .then(() => postToggleRequest(settings))
      .then((result) => sendResponse(result))
      .catch((error) => {
        sendResponse({
          ok: false,
          reason: 'unexpected-error',
          message: String(error)
        });
      });

    return true;
  });
})();

