(function () {
  'use strict';

  function registerModule(definition) {
    window.__twitchEnhancerModuleDefinitions = window.__twitchEnhancerModuleDefinitions || [];
    window.__twitchEnhancerModuleDefinitions.push(definition);
  }

  const REPLY_SELECTOR = '.chat-line__message p[title]';
  const REPLY_USER_SELECTOR = ':scope > span[dir="auto"]';
  const REPLY_ICON_SELECTOR = ':scope > .tw-svg';
  const MARKER_ATTRIBUTE = 'data-twitch-enhancer-reply-preview';
  const POPUP_CLASS = 'twitch-enhancer-reply-preview-popup';
  const POPUP_TITLE_CLASS = `${POPUP_CLASS}__title`;
  const POPUP_TITLE_ID = 'twitch-enhancer-chat-reply-preview-title';
  const STYLE_ID = 'twitch-enhancer-chat-reply-preview-style';

  registerModule({
    id: 'chatReplyPreview',
    create() {
      let enabled = false;
      let observer = null;
      let popup = null;
      let popupAnchor = null;
      let scanFrameId = null;

      const pendingScanRoots = new Set();
      const markedElements = new Set();
      const originalAttributes = new WeakMap();

      function ensureStyle() {
        if (document.getElementById(STYLE_ID)) {
          return;
        }

        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
          [${MARKER_ATTRIBUTE}] {
            cursor: pointer !important;
            border-radius: 0.3rem;
          }

          [${MARKER_ATTRIBUTE}]:hover {
            background: rgba(255, 255, 255, 0.08);
          }

          .${POPUP_CLASS} {
            position: fixed;
            z-index: 999999;
            box-sizing: border-box;
            max-width: min(42rem, calc(100vw - 2rem));
            padding: 0.75rem 0.9rem;
            border: 1px solid rgba(255, 255, 255, 0.16);
            border-radius: 0.6rem;
            background: #18181b;
            color: #efeff1;
            box-shadow: 0 0.8rem 2rem rgba(0, 0, 0, 0.45);
            white-space: normal;
            overflow-wrap: anywhere;
          }

          .${POPUP_TITLE_CLASS} {
            margin-bottom: 0.35rem;
            color: #adadb8;
          }
        `;
        (document.head || document.documentElement).appendChild(style);
      }

      function getReplyUser(reply) {
        const user = reply
          ?.querySelector(REPLY_USER_SELECTOR)
          ?.textContent
          ?.trim();

        return user?.startsWith('@') ? user : null;
      }

      function isReplyPreview(element) {
        return (
          element instanceof HTMLParagraphElement &&
          element.matches(REPLY_SELECTOR) &&
          Boolean(element.title.trim()) &&
          Boolean(getReplyUser(element))
        );
      }

      function getReplyElement(element) {
        if (isReplyPreview(element)) {
          return element;
        }

        const reply = element?.querySelector?.(REPLY_SELECTOR);
        return isReplyPreview(reply) ? reply : null;
      }

      function getReplyClickTarget(reply) {
        const message = reply.closest('.chat-line__message');
        let candidate = reply.parentElement;

        while (candidate && candidate !== message) {
          if (candidate.querySelector(REPLY_ICON_SELECTOR)) {
            return candidate;
          }

          candidate = candidate.parentElement;
        }

        return reply;
      }

      function saveOriginalAttributes(element) {
        if (originalAttributes.has(element)) {
          return;
        }

        originalAttributes.set(element, {
          role: element.getAttribute('role'),
          ariaLabel: element.getAttribute('aria-label'),
          tabIndex: element.getAttribute('tabindex')
        });
      }

      function restoreAttribute(element, name, value) {
        if (value === null) {
          element.removeAttribute(name);
        } else {
          element.setAttribute(name, value);
        }
      }

      function markReplyPreview(reply) {
        if (!isReplyPreview(reply)) {
          return;
        }

        const clickTarget = getReplyClickTarget(reply);
        if (clickTarget.hasAttribute(MARKER_ATTRIBUTE)) {
          return;
        }

        saveOriginalAttributes(clickTarget);
        clickTarget.setAttribute(MARKER_ATTRIBUTE, 'true');
        clickTarget.setAttribute('tabindex', '0');
        clickTarget.setAttribute('role', 'button');
        clickTarget.setAttribute(
          'aria-label',
          `Show full replied message from ${getReplyUser(reply)}`
        );
        markedElements.add(clickTarget);
      }

      function scanRoot(root) {
        if (!(root instanceof Element || root instanceof Document)) {
          return;
        }

        if (root instanceof Element && root.matches(REPLY_SELECTOR)) {
          markReplyPreview(root);
        }

        root.querySelectorAll(REPLY_SELECTOR).forEach(markReplyPreview);
      }

      function pruneRemovedMarkers() {
        for (const element of markedElements) {
          if (!element.isConnected) {
            markedElements.delete(element);
          }
        }
      }

      function flushPendingScans() {
        scanFrameId = null;

        if (!enabled) {
          pendingScanRoots.clear();
          return;
        }

        for (const root of pendingScanRoots) {
          scanRoot(root);
        }

        pendingScanRoots.clear();
        pruneRemovedMarkers();

        if (popupAnchor && !popupAnchor.isConnected) {
          removePopup();
        }
      }

      function queueScan(root) {
        if (!enabled || !(root instanceof Element)) {
          return;
        }

        pendingScanRoots.add(root);
        if (scanFrameId === null) {
          scanFrameId = requestAnimationFrame(flushPendingScans);
        }
      }

      function unmarkReplyPreviews() {
        for (const element of markedElements) {
          if (element.isConnected) {
            const attributes = originalAttributes.get(element);
            element.removeAttribute(MARKER_ATTRIBUTE);

            if (attributes) {
              restoreAttribute(element, 'role', attributes.role);
              restoreAttribute(element, 'aria-label', attributes.ariaLabel);
              restoreAttribute(element, 'tabindex', attributes.tabIndex);
            }
          }
        }

        markedElements.clear();
      }

      function removePopup() {
        popup?.remove();
        popup = null;
        popupAnchor = null;
      }

      function positionPopup(anchor) {
        if (!popup) {
          return;
        }

        const anchorRect = anchor.getBoundingClientRect();
        const chatRect = anchor.closest('.chat-room__content')?.getBoundingClientRect();
        const margin = 8;
        const boundaryLeft = chatRect?.left ?? 0;
        const boundaryRight = chatRect?.right ?? window.innerWidth;
        const boundaryWidth = chatRect?.width ?? window.innerWidth;

        popup.style.maxWidth = `${Math.max(1, boundaryWidth - margin * 2)}px`;

        const popupRect = popup.getBoundingClientRect();
        const minimumLeft = boundaryLeft + margin;
        const maximumLeft = Math.max(
          minimumLeft,
          boundaryRight - popupRect.width - margin
        );
        const left = Math.min(
          Math.max(minimumLeft, anchorRect.left),
          maximumLeft
        );
        const top = Math.max(
          margin,
          anchorRect.top - popupRect.height - margin
        );

        popup.style.left = `${left}px`;
        popup.style.top = `${top}px`;
      }

      function applyChatTypography(element, chatLine) {
        const chatText =
          chatLine?.querySelector('[data-a-target="chat-message-text"]') ||
          chatLine;

        if (!chatText) {
          return;
        }

        const chatTextStyle = getComputedStyle(chatText);
        element.style.fontSize = chatTextStyle.fontSize;
        element.style.lineHeight = chatTextStyle.lineHeight;
      }

      function createPopup(reply) {
        const element = document.createElement('div');
        element.className = POPUP_CLASS;
        element.setAttribute('role', 'dialog');
        element.setAttribute('aria-modal', 'false');
        element.setAttribute('aria-labelledby', POPUP_TITLE_ID);

        const title = document.createElement('div');
        title.id = POPUP_TITLE_ID;
        title.className = POPUP_TITLE_CLASS;
        title.textContent = getReplyUser(reply);

        const body = document.createElement('div');
        body.textContent = reply.title.trim();

        element.append(title, body);
        return element;
      }

      function showPopup(anchor) {
        const reply = getReplyElement(anchor);
        if (!reply) {
          return;
        }

        removePopup();

        popup = createPopup(reply);
        popupAnchor = anchor;
        applyChatTypography(popup, anchor.closest('.chat-line__message'));
        document.body.appendChild(popup);
        positionPopup(anchor);
      }

      function handleClick(event) {
        if (!enabled || !(event.target instanceof Element)) {
          return;
        }

        if (popup?.contains(event.target)) {
          return;
        }

        const preview = event.target.closest(`[${MARKER_ATTRIBUTE}]`);
        if (!preview) {
          removePopup();
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        showPopup(preview);
      }

      function handleKeyDown(event) {
        if (event.key === 'Escape') {
          removePopup();
          return;
        }

        if (
          !enabled ||
          (event.key !== 'Enter' && event.key !== ' ') ||
          !(event.target instanceof Element)
        ) {
          return;
        }

        const preview = event.target.closest(`[${MARKER_ATTRIBUTE}]`);
        if (!preview) {
          return;
        }

        event.preventDefault();
        showPopup(preview);
      }

      function handleMutations(mutations) {
        for (const mutation of mutations) {
          mutation.addedNodes.forEach(queueScan);
        }
      }

      function startObserver() {
        if (observer) {
          return;
        }

        observer = new MutationObserver(handleMutations);
        observer.observe(document.documentElement, {
          childList: true,
          subtree: true
        });
      }

      function stopObserver() {
        observer?.disconnect();
        observer = null;

        if (scanFrameId !== null) {
          cancelAnimationFrame(scanFrameId);
          scanFrameId = null;
        }

        pendingScanRoots.clear();
      }

      function enable() {
        if (enabled) {
          return;
        }

        enabled = true;
        ensureStyle();
        scanRoot(document);
        startObserver();
      }

      function disable() {
        if (!enabled) {
          return;
        }

        enabled = false;
        stopObserver();
        removePopup();
        unmarkReplyPreviews();
      }

      document.addEventListener('click', handleClick, true);
      document.addEventListener('keydown', handleKeyDown, true);
      document.addEventListener('scroll', removePopup, true);
      window.addEventListener('resize', removePopup);

      return {
        updateSettings(settings) {
          if (settings.enabled !== false) {
            enable();
          } else {
            disable();
          }
        }
      };
    }
  });
})();
