(function () {
  'use strict';

  if (window.__twitchEnhancerGQL) {
    return;
  }

  const subscribers = new Set();
  const pendingNodes = [];
  let bootstrapFinished = false;

  function isGQLUrl(input) {
    const url =
      typeof input === 'string'
        ? input
        : input && typeof input.url === 'string'
          ? input.url
          : '';

    return url.includes('/gql');
  }

  function publishNode(node) {
    if (!bootstrapFinished) {
      pendingNodes.push(node);
    }
    for (const subscriber of subscribers) {
      try {
        subscriber(node);
      } catch (error) {
        console.error('Failed to process Twitch GQL payload', error);
      }
    }
  }

  function publish(payload) {
    const seen = new WeakSet();
    const pending = [payload];
    while (pending.length) {
      const node = pending.pop();
      if (!node || typeof node !== 'object' || seen.has(node)) {
        continue;
      }
      seen.add(node);
      publishNode(node);
      const children = Object.values(node);
      for (let index = children.length - 1; index >= 0; index--) {
        if (children[index] && typeof children[index] === 'object') {
          pending.push(children[index]);
        }
      }
    }
  }

  function subscribeNodes(subscriber) {
    if (typeof subscriber !== 'function') {
      return () => {};
    }

    subscribers.add(subscriber);

    if (!bootstrapFinished) {
      pendingNodes.forEach((node) => {
        try {
          subscriber(node);
        } catch (error) {
          console.error('Failed to process buffered Twitch GQL payload', error);
        }
      });
    }

    return () => subscribers.delete(subscriber);
  }

  function finishBootstrap() {
    bootstrapFinished = true;
    pendingNodes.length = 0;
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
    finishBootstrap,
    subscribeNodes
  };
})();
