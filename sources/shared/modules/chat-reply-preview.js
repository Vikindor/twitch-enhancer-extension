(function () {
  'use strict';

  function registerModule(definition) {
    window.__twitchEnhancerModuleDefinitions = window.__twitchEnhancerModuleDefinitions || [];
    window.__twitchEnhancerModuleDefinitions.push(definition);
  }

  registerModule({
    id: 'chatReplyPreview',
    create() {
      const REPLY_SELECTOR = '.chat-line__message p[title]';
      const MARKER_ATTRIBUTE = 'data-twitch-enhancer-reply-preview';
      const STYLE_ID = 'twitch-enhancer-chat-reply-preview-style';
      let enabled = true;
      let popup = null;
      let raf = null;

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

          .twitch-enhancer-reply-preview-popup {
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

          .twitch-enhancer-reply-preview-popup__title {
            margin-bottom: 0.35rem;
            color: #adadb8;
          }
        `;
        (document.head || document.documentElement).appendChild(style);
      }

      function isReplyPreview(element) {
        return (
          element instanceof HTMLElement &&
          element.matches(REPLY_SELECTOR) &&
          element.title &&
          element.textContent.trim().startsWith('Replying to')
        );
      }

      function extractReplyTarget(element) {
        const reply = getReplyElement(element);
        const user = reply?.querySelector('span')?.textContent?.trim();
        return user || 'original message';
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
          if (candidate.querySelector('.tw-svg')) {
            return candidate;
          }

          candidate = candidate.parentElement;
        }

        return reply;
      }

      function markReplyPreviews(root = document) {
        if (!enabled || !root || typeof root.querySelectorAll !== 'function') {
          return;
        }

        root.querySelectorAll(REPLY_SELECTOR).forEach((reply) => {
          if (!isReplyPreview(reply)) {
            return;
          }

          const clickTarget = getReplyClickTarget(reply);
          clickTarget.setAttribute(MARKER_ATTRIBUTE, 'true');
          clickTarget.tabIndex = 0;
          clickTarget.setAttribute('role', 'button');
          clickTarget.setAttribute('aria-label', `Show full replied message from ${extractReplyTarget(reply)}`);
        });
      }

      function unmarkReplyPreviews() {
        document.querySelectorAll(`[${MARKER_ATTRIBUTE}]`).forEach((element) => {
          element.removeAttribute(MARKER_ATTRIBUTE);
          element.removeAttribute('role');
          element.removeAttribute('aria-label');
          if (element.getAttribute('tabindex') === '0') {
            element.removeAttribute('tabindex');
          }
        });
      }

      function removePopup() {
        if (popup) {
          popup.remove();
          popup = null;
        }
      }

      function positionPopup(anchor) {
        if (!popup) {
          return;
        }

        const rect = anchor.getBoundingClientRect();
        const chatRect = anchor.closest('.chat-room__content')?.getBoundingClientRect();
        const margin = 8;
        const boundaryLeft = chatRect?.left ?? 0;
        const boundaryRight = chatRect?.right ?? window.innerWidth;
        const boundaryWidth = chatRect?.width ?? window.innerWidth;

        popup.style.maxWidth = `${Math.max(0, boundaryWidth - margin * 2)}px`;

        const popupRect = popup.getBoundingClientRect();
        const minimumLeft = boundaryLeft + margin;
        const maximumLeft = Math.max(minimumLeft, boundaryRight - popupRect.width - margin);
        const left = Math.min(Math.max(minimumLeft, rect.left), maximumLeft);
        const top = Math.max(margin, rect.top - popupRect.height - margin);

        popup.style.left = `${left}px`;
        popup.style.top = `${top}px`;
      }

      function showPopup(anchor) {
        const reply = getReplyElement(anchor);
        const message = reply?.title?.trim();
        if (!message) {
          return;
        }

        removePopup();

        popup = document.createElement('div');
        popup.className = 'twitch-enhancer-reply-preview-popup';
        popup.setAttribute('role', 'tooltip');

        const chatLine = anchor.closest('.chat-line__message');
        const chatText = chatLine?.querySelector('[data-a-target="chat-message-text"]') || chatLine;
        if (chatText) {
          const chatTextStyle = getComputedStyle(chatText);
          popup.style.fontSize = chatTextStyle.fontSize;
          popup.style.lineHeight = chatTextStyle.lineHeight;
        }

        const title = document.createElement('div');
        title.className = 'twitch-enhancer-reply-preview-popup__title';
        title.textContent = extractReplyTarget(reply);

        const body = document.createElement('div');
        body.textContent = message;

        popup.append(title, body);
        document.body.appendChild(popup);
        positionPopup(anchor);
      }

      function queueScan() {
        if (!enabled || raf) {
          return;
        }

        raf = requestAnimationFrame(() => {
          raf = null;
          markReplyPreviews();
        });
      }

      document.addEventListener('click', (event) => {
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
      }, true);

      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          removePopup();
          return;
        }

        if (!enabled || (event.key !== 'Enter' && event.key !== ' ')) {
          return;
        }

        if (!(event.target instanceof Element)) {
          return;
        }

        const preview = event.target.closest(`[${MARKER_ATTRIBUTE}]`);
        if (!preview) {
          return;
        }

        event.preventDefault();
        showPopup(preview);
      }, true);

      document.addEventListener('scroll', removePopup, true);
      window.addEventListener('resize', removePopup);

      const observer = new MutationObserver((mutations) => {
        if (!enabled) {
          return;
        }

        for (const mutation of mutations) {
          if (mutation.type !== 'childList') {
            continue;
          }

          if (Array.from(mutation.addedNodes).some((node) => node instanceof Element)) {
            queueScan();
            return;
          }
        }
      });

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });

      ensureStyle();
      markReplyPreviews();

      return {
        updateSettings(nextSettings) {
          enabled = nextSettings.enabled !== false;

          if (enabled) {
            ensureStyle();
            markReplyPreviews();
          } else {
            removePopup();
            unmarkReplyPreviews();
          }
        }
      };
    }
  });
})();
