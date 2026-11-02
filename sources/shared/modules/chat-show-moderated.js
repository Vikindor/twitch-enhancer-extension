(function () {
  'use strict';

  function registerModule(definition) {
    window.__twitchEnhancerModuleDefinitions = window.__twitchEnhancerModuleDefinitions || [];
    window.__twitchEnhancerModuleDefinitions.push(definition);
  }

  const MESSAGE_SELECTOR = '.chat-line__message';
  const PLACEHOLDER_SELECTOR = '[data-a-target="chat-deleted-message-placeholder"]';
  const MARKER_ATTRIBUTE = 'data-twitch-enhancer-chat-show-moderated';
  const POPUP_CLASS = 'twitch-enhancer-chat-show-moderated-popup';
  const STYLE_ID = 'twitch-enhancer-chat-show-moderated-style';

  registerModule({
    id: 'chatShowModerated',
    create() {
      let enabled = false;
      let observer = null;
      let popup = null;
      let popupAnchor = null;
      let scanFrameId = null;
      const pendingScanRoots = new Set();
      const markedElements = new Set();

      function getMessage(placeholder) {
        const line = placeholder.closest(MESSAGE_SELECTOR);
        const author = line?.getAttribute('data-a-user');
        const label = line?.getAttribute('aria-label');
        if (!author || !label) {
          return null;
        }
        const marker = `${author}: `;
        const index = label.toLowerCase().indexOf(marker.toLowerCase());
        if (index < 0) {
          return null;
        }
        const text = label.slice(index + marker.length);
        return text ? { author, text } : null;
      }

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
          .${POPUP_CLASS}__title {
            margin-bottom: 0.35rem;
            color: #adadb8;
          }
        `;
        (document.head || document.documentElement).appendChild(style);
      }

      function scanRoot(root) {
        if (!(root instanceof Element || root instanceof Document)) {
          return;
        }
        const placeholders = [...root.querySelectorAll(PLACEHOLDER_SELECTOR)];
        if (root instanceof Element && root.matches(PLACEHOLDER_SELECTOR)) {
          placeholders.push(root);
        }
        for (const placeholder of placeholders) {
          if (getMessage(placeholder)) {
            placeholder.setAttribute(MARKER_ATTRIBUTE, 'true');
            markedElements.add(placeholder);
          } else {
            placeholder.removeAttribute(MARKER_ATTRIBUTE);
            markedElements.delete(placeholder);
          }
        }
      }

      function removePopup() {
        popup?.remove();
        popup = null;
        popupAnchor = null;
      }

      function flushPendingScans() {
        scanFrameId = null;
        for (const root of pendingScanRoots) {
          if (root.isConnected) {
            scanRoot(root);
          }
        }
        pendingScanRoots.clear();
        for (const element of markedElements) {
          if (!element.isConnected) {
            markedElements.delete(element);
          }
        }
        if (popupAnchor && (!popupAnchor.isConnected || !getMessage(popupAnchor))) {
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

      function showPopup(anchor, message) {
        removePopup();
        popup = document.createElement('div');
        popup.className = POPUP_CLASS;
        const title = document.createElement('div');
        title.className = `${POPUP_CLASS}__title`;
        title.textContent = message.author;
        const body = document.createElement('div');
        body.textContent = message.text;
        popup.append(title, body);
        const line = anchor.closest(MESSAGE_SELECTOR);
        const typography = getComputedStyle(line);
        popup.style.fontSize = typography.fontSize;
        popup.style.lineHeight = typography.lineHeight;
        document.body.appendChild(popup);
        popupAnchor = anchor;

        const anchorRect = anchor.getBoundingClientRect();
        const chatRect = anchor.closest('.chat-room__content')?.getBoundingClientRect();
        const margin = 8;
        const boundaryLeft = chatRect?.left ?? 0;
        const boundaryRight = chatRect?.right ?? window.innerWidth;
        const boundaryWidth = chatRect?.width ?? window.innerWidth;
        popup.style.maxWidth = `${Math.max(1, boundaryWidth - margin * 2)}px`;
        const popupRect = popup.getBoundingClientRect();
        const minimumLeft = boundaryLeft + margin;
        const maximumLeft = Math.max(minimumLeft, boundaryRight - popupRect.width - margin);
        popup.style.left = `${Math.min(Math.max(minimumLeft, anchorRect.left), maximumLeft)}px`;
        popup.style.top = `${Math.max(margin, anchorRect.top - popupRect.height - margin)}px`;
      }

      function handleClick(event) {
        if (!enabled || !(event.target instanceof Element) || popup?.contains(event.target)) {
          return;
        }
        const placeholder = event.target.closest(PLACEHOLDER_SELECTOR);
        const message = placeholder ? getMessage(placeholder) : null;
        if (!message) {
          removePopup();
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        showPopup(placeholder, message);
      }

      function handleKeyDown(event) {
        if (event.key === 'Escape') {
          removePopup();
        }
      }

      function enable() {
        if (enabled) {
          return;
        }
        enabled = true;
        ensureStyle();
        scanRoot(document);
        observer = new MutationObserver((mutations) => {
          for (const mutation of mutations) {
            if (mutation.type === 'attributes') {
              queueScan(mutation.target);
            } else {
              mutation.addedNodes.forEach(queueScan);
              queueScan(mutation.target.closest?.(MESSAGE_SELECTOR));
            }
          }
        });
        observer.observe(document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['aria-label', 'data-a-user']
        });
        document.addEventListener('click', handleClick, true);
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('scroll', removePopup, true);
        window.addEventListener('resize', removePopup);
      }

      function disable() {
        enabled = false;
        observer?.disconnect();
        observer = null;
        if (scanFrameId !== null) {
          cancelAnimationFrame(scanFrameId);
          scanFrameId = null;
        }
        pendingScanRoots.clear();
        removePopup();
        for (const element of markedElements) {
          element.removeAttribute(MARKER_ATTRIBUTE);
        }
        markedElements.clear();
        document.getElementById(STYLE_ID)?.remove();
        document.removeEventListener('click', handleClick, true);
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('scroll', removePopup, true);
        window.removeEventListener('resize', removePopup);
      }

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
