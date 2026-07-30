(function () {
  'use strict';

  if (window.__twitchEnhancerGQL) {
    return;
  }

  const subscribers = new Set();
  const pendingPayloads = [];
  let clearPendingPayloadsQueued = false;

  function isGQLUrl(input) {
    const url =
      typeof input === 'string'
        ? input
        : input && typeof input.url === 'string'
          ? input.url
          : '';

    return url.includes('/gql');
  }

  function publish(payload) {
    if (!subscribers.size) {
      pendingPayloads.push(payload);
      return;
    }

    for (const subscriber of subscribers) {
      try {
        subscriber(payload);
      } catch (error) {
        console.error('Failed to process Twitch GQL payload', error);
      }
    }
  }

  function subscribe(subscriber) {
    if (typeof subscriber !== 'function') {
      return () => {};
    }

    subscribers.add(subscriber);

    pendingPayloads.forEach((payload) => {
      try {
        subscriber(payload);
      } catch (error) {
        console.error('Failed to process buffered Twitch GQL payload', error);
      }
    });

    if (pendingPayloads.length && !clearPendingPayloadsQueued) {
      clearPendingPayloadsQueued = true;
      queueMicrotask(() => {
        pendingPayloads.length = 0;
        clearPendingPayloadsQueued = false;
      });
    }

    return () => subscribers.delete(subscriber);
  }

  const originalFetch = window.fetch;
  window.fetch = function (...args) {
    const promise = originalFetch.apply(this, args);

    if (isGQLUrl(args[0])) {
      promise
        .then((response) => response.clone().json())
        .then(publish)
        .catch(() => {});
    }

    return promise;
  };

  const xhrMetadata = new WeakMap();
  const xhrPrototype = window.XMLHttpRequest.prototype;
  const originalOpen = xhrPrototype.open;

  xhrPrototype.open = function (method, url, ...rest) {
    let metadata = xhrMetadata.get(this);
    if (!metadata) {
      metadata = { isGQL: false };
      xhrMetadata.set(this, metadata);

      this.addEventListener('load', () => {
        if (!metadata.isGQL) {
          return;
        }

        try {
          const contentType = (this.getResponseHeader('content-type') || '').toLowerCase();
          if (contentType.includes('application/json')) {
            publish(JSON.parse(this.responseText));
          }
        } catch (_) {}
      });
    }

    metadata.isGQL = isGQLUrl(String(url || ''));
    return originalOpen.call(this, method, url, ...rest);
  };

  window.__twitchEnhancerGQL = {
    subscribe
  };
})();
