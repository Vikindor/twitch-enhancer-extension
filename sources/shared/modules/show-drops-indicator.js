(function () {
  'use strict';

  function registerModule(definition) {
    window.__twitchEnhancerModuleDefinitions = window.__twitchEnhancerModuleDefinitions || [];
    window.__twitchEnhancerModuleDefinitions.push(definition);
  }

  registerModule({
    id: 'showDropsIndicator',
    create() {
      const dropsByLogin = new Map();
      const DROPS_TAG_NAMES = new Set([
        'dropsenabled', // English
        // Bahasa Indonesia — Indonesian — not covered
        // Català — Catalan — not covered
        'dropsaktiveret', // Dansk — Danish
        'dropsaktiviert', // Deutsch — German
        'dropsactivados', // Español — Spanish
        'dropsactivés', // Français — French
        'dropabilitati', // Italiano — Italian
        'dropokengedélyezve', // Magyar — Hungarian
        'dropsingeschakeld', // Nederlands — Dutch
        'dropsaktivert', // Norsk — Norwegian — requires verification
        'dropywłączone', // Polski — Polish
        'dropsativados', // Português — Portuguese
        'dropssuntactivate', // Română — Romanian
        // Slovenčina — Slovak — not covered
        'dropitkäytössä', // Suomi — Finnish
        'dropsaktiverat', // Svenska — Swedish — requires verification
        // Tagalog — not covered
        // Tiếng Việt — Vietnamese — not covered
        'droplaretkin', // Türkçe — Turkish
        'povolenédrops', // Čeština — Czech
        'ταdropενεργοποιήθηκαν', // Ελληνικά — Greek
        // Български — Bulgarian — not covered
        'dropsвключены', // Русский — Russian
        'dropsувімкнено', // Українська — Ukrainian
        'تم・تمكين・drops', // العربية — Arabic
        // بهاس ملايو — Malay — not covered.
        // मानक हिन्दी — Standard Hindi — not covered
        'ใช้dropsได้', // ภาษาไทย — Thai
        '启用掉宝', // 中文 — Chinese
        'drops有効', // 日本語 — Japanese
        '드롭활성화됨', // 한국어 — Korean
      ]);
      const CHANNEL_LINK_SELECTOR = [
        'p[data-a-target="preview-card-channel-link"]',
        'p[data-test-selector="TitleAndChannel__channelLink"]',
        'a[data-a-target="preview-card-channel-link"]',
        'a[data-test-selector="preview-card-channel-link"]',
        'a[data-test-selector="TitleAndChannel__channelLink"]'
      ].join(',');
      const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
      const ICON_PATHS = [
        {
          d: 'M0 14V5L2.417 0.971C2.59469 0.674846 2.84605 0.429755 3.1466 0.259593C3.44714 0.0894306 3.78663 -3.32274e-06 4.132 0H15.868C16.2134 -3.32274e-06 16.5529 0.0894306 16.8534 0.259593C17.1539 0.429755 17.4053 0.674846 17.583 0.971L20 5V14H0ZM18 12V7H11V9H9V7H2V12H18ZM15.868 2L17.668 5H2.332L4.132 2H15.868Z',
          fillRule: 'evenodd',
          clipRule: 'evenodd'
        }
      ];

      let settings = {
        enabled: true,
        visualMode: 'suffix'
      };
      let raf = null;

      function getLogin(node) {
        const login =
          (node.broadcaster && (node.broadcaster.login || node.broadcasterLogin)) ||
          node.userLogin ||
          node.login ||
          (node.channel && (node.channel.login || node.channel.name)) ||
          null;

        return login ? String(login).toLowerCase() : null;
      }

      function isDropsTag(tag) {
        if (!tag) return false;
        const name =
          typeof tag === 'string'
            ? tag
            : tag.name || tag.localizedName || tag.tagName || tag.label || null;

        return typeof name === 'string' && DROPS_TAG_NAMES.has(name.trim().toLowerCase());
      }

      function hasDropsInTitle(node) {
        const title =
          (typeof node.title === 'string' && node.title) ||
          (node.broadcastSettings &&
            typeof node.broadcastSettings.title === 'string' &&
            node.broadcastSettings.title) ||
          '';

        return /\bdrops\b/i.test(title);
      }

      function collectDrops(any, seen = new WeakSet()) {
        if (!any || typeof any !== 'object' || seen.has(any)) return;
        seen.add(any);

        if (Array.isArray(any.freeformTags)) {
          const login = getLogin(any);
          if (login) {
            const hasDrops = any.freeformTags.some(isDropsTag) || hasDropsInTitle(any);
            if (dropsByLogin.get(login) !== hasDrops) {
              dropsByLogin.set(login, hasDrops);
              queueAnnotate();
            }
          }
        }

        if (Array.isArray(any)) {
          any.forEach((item) => collectDrops(item, seen));
          return;
        }

        for (const key in any) {
          if (!Object.prototype.hasOwnProperty.call(any, key)) continue;
          const value = any[key];
          if (value && typeof value === 'object') collectDrops(value, seen);
        }
      }

      function getFetchUrl(input) {
        if (typeof input === 'string') return input;
        return input && typeof input.url === 'string' ? input.url : '';
      }

      const originalFetch = window.fetch;
      window.fetch = function (...args) {
        const promise = originalFetch.apply(this, args);
        try {
          if (getFetchUrl(args[0]).includes('/gql')) {
            promise
              .then((response) => {
                response
                  .clone()
                  .json()
                  .then((payload) => collectDrops(payload))
                  .catch(() => {});
              })
              .catch(() => {});
          }
        } catch (_) {}
        return promise;
      };

      const OriginalXHR = window.XMLHttpRequest;
      window.XMLHttpRequest = function PatchedXHR() {
        const xhr = new OriginalXHR();
        let isGQL = false;
        const originalOpen = xhr.open;

        xhr.open = function (method, url, ...rest) {
          isGQL = Boolean(url && /\/gql(\?|$)/.test(String(url)));
          return originalOpen.call(this, method, url, ...rest);
        };
        xhr.addEventListener('load', () => {
          if (!isGQL) return;
          try {
            const contentType = (xhr.getResponseHeader('content-type') || '').toLowerCase();
            if (contentType.includes('application/json')) {
              collectDrops(JSON.parse(xhr.responseText));
            }
          } catch (_) {}
        });

        return xhr;
      };

      function getLoginFromLink(node) {
        const anchor = node.tagName === 'A' ? node : node.closest('a[href^="/"]');
        if (!anchor) return null;

        const match = (anchor.getAttribute('href') || '').match(
          /^\/([a-zA-Z0-9_]+)(?:\/|$)/
        );
        return match ? match[1].toLowerCase() : null;
      }

      function createIcon(className = '__dropsIndicator') {
        const indicator = document.createElement('span');
        indicator.className = className;
        indicator.title = 'Drops enabled';
        indicator.setAttribute('role', 'img');
        indicator.setAttribute('aria-label', 'Drops enabled');
        indicator.style.display = 'inline-flex';
        indicator.style.alignItems = 'center';
        indicator.style.justifyContent = 'center';
        indicator.style.flex = '0 0 auto';
        indicator.style.height = '1cap';
        indicator.style.color = 'rgb(162,126,217)';
        indicator.style.pointerEvents = 'none';
        indicator.style.order = '998';

        const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
        svg.setAttribute('viewBox', '0 0 20 14');
        svg.setAttribute('aria-hidden', 'true');
        svg.style.display = 'block';
        svg.style.width = 'auto';
        svg.style.height = '1cap';
        svg.style.fill = 'currentColor';

        ICON_PATHS.forEach((definition) => {
          const path = document.createElementNS(SVG_NAMESPACE, 'path');
          path.setAttribute('d', definition.d);
          if (definition.fillRule) path.setAttribute('fill-rule', definition.fillRule);
          if (definition.clipRule) path.setAttribute('clip-rule', definition.clipRule);
          svg.appendChild(path);
        });
        indicator.appendChild(svg);
        return indicator;
      }

      function getCardAndRow(node) {
        const card = node.closest('article,[data-target="directory-first-item"]') || node;
        const primaryNode =
          card.querySelector(
            'p[data-a-target="preview-card-channel-link"], ' +
              'p[data-test-selector="TitleAndChannel__channelLink"]'
          ) || node;

        let row = primaryNode.parentElement || primaryNode;
        if (row.nextElementSibling && row.parentElement) {
          row = row.parentElement;
        }

        return { card, row };
      }

      function restoreLanguageSuffix(row) {
        const suffix = row?.querySelector(':scope > .__langSuffixRight');
        if (suffix) suffix.style.marginLeft = 'auto';
      }

      function updateSuffix(node, login) {
        const { card, row } = getCardAndRow(node);
        let indicator = card.querySelector('.__dropsIndicator');

        if (!settings.enabled || !dropsByLogin.get(login)) {
          if (indicator) {
            const oldRow = indicator.parentElement;
            indicator.remove();
            restoreLanguageSuffix(oldRow);
          }
          return;
        }

        if (!indicator) {
          indicator = createIcon();
        }

        const suffix = row.querySelector(':scope > .__langSuffixRight');
        indicator.style.marginLeft = 'auto';
        indicator.style.marginRight = suffix ? '0.4rem' : '0';

        if (suffix) {
          suffix.style.marginLeft = '0';
          row.insertBefore(indicator, suffix);
        } else {
          row.appendChild(indicator);
        }

        card.querySelectorAll('.__dropsIndicator').forEach((element) => {
          if (element !== indicator) element.remove();
        });
      }

      function getBadgeStack(thumb) {
        let stack = thumb.querySelector(':scope > .__streamCardBadgeStack');
        if (!stack) {
          stack = document.createElement('div');
          stack.className = '__streamCardBadgeStack';
          stack.style.position = 'absolute';
          stack.style.top = '8px';
          stack.style.right = '8px';
          stack.style.display = 'flex';
          stack.style.alignItems = 'center';
          stack.style.gap = '0.4rem';
          stack.style.pointerEvents = 'none';
          stack.style.zIndex = '3';
          thumb.appendChild(stack);
        }

        const liveBadge = thumb.querySelector(
          '[class*="tw-channel-status-text-indicator"]'
        );
        if (liveBadge) {
          const thumbRect = thumb.getBoundingClientRect();
          const liveBadgeRect = liveBadge.getBoundingClientRect();
          const scaleY = thumb.offsetHeight ? thumbRect.height / thumb.offsetHeight : 1;
          if (scaleY > 0) {
            stack.style.top = `${(liveBadgeRect.top - thumbRect.top) / scaleY}px`;
          }
        }

        const languageBadge = thumb.querySelector('.__langBadge');
        if (languageBadge && languageBadge.parentElement !== stack) {
          languageBadge.style.position = 'static';
          languageBadge.style.top = '';
          languageBadge.style.right = '';
          languageBadge.style.zIndex = '';
          stack.appendChild(languageBadge);
        }

        return stack;
      }

      function updateBadge(anchor, login) {
        const card =
          anchor.closest('article') ||
          anchor.closest('div[data-target="directory-first-item"]') ||
          anchor.closest('div') ||
          anchor;
        const thumb =
          card.querySelector('[data-a-target="preview-card-image-link"]') ||
          card.querySelector('[data-a-target="preview-card-thumbnail"]') ||
          card.querySelector('figure') ||
          card;
        let badge = card.querySelector('.__dropsBadge');

        if (!settings.enabled || !dropsByLogin.get(login)) {
          if (badge) {
            const stack = badge.parentElement;
            badge.remove();
            if (stack?.classList.contains('__streamCardBadgeStack') && !stack.children.length) {
              stack.remove();
            }
          }
          return;
        }

        if (getComputedStyle(thumb).position === 'static') {
          thumb.style.position = 'relative';
        }

        const stack = getBadgeStack(thumb);
        if (!badge) {
          badge = createIcon('__dropsBadge');
          badge.style.boxSizing = 'content-box';
          badge.style.height = '16px';
          badge.style.padding = '2px 6px';
          badge.style.borderRadius = '4px';
          badge.style.fontSize = '12px';
          badge.style.lineHeight = '16px';
          badge.style.background = 'rgb(235,4,0)';
          badge.style.color = '#fff';
          badge.style.order = '0';
          badge.firstElementChild.style.height = '1em';
        }

        const languageBadge = stack.querySelector('.__langBadge');
        stack.insertBefore(badge, languageBadge || stack.firstChild);

        card.querySelectorAll('.__dropsBadge').forEach((element) => {
          if (element !== badge) element.remove();
        });
      }

      function clearIndicators(root = document) {
        root.querySelectorAll('.__dropsIndicator').forEach((indicator) => {
          const row = indicator.parentElement;
          indicator.remove();
          restoreLanguageSuffix(row);
        });
        root.querySelectorAll('.__dropsBadge').forEach((badge) => {
          const stack = badge.parentElement;
          badge.remove();
          if (stack?.classList.contains('__streamCardBadgeStack') && !stack.children.length) {
            stack.remove();
          }
        });
      }

      function annotate(root = document) {
        if (!settings.enabled) {
          clearIndicators(root);
          return;
        }

        root.querySelectorAll(CHANNEL_LINK_SELECTOR).forEach((node) => {
          const login = getLoginFromLink(node);
          if (!login) return;

          const card = node.closest('article,[data-target="directory-first-item"]') || node;
          if (settings.visualMode === 'badge') {
            card.querySelectorAll('.__dropsIndicator').forEach((element) => {
              const row = element.parentElement;
              element.remove();
              restoreLanguageSuffix(row);
            });
            updateBadge(node, login);
          } else {
            card.querySelectorAll('.__dropsBadge').forEach((element) => {
              const stack = element.parentElement;
              element.remove();
              if (stack?.classList.contains('__streamCardBadgeStack') && !stack.children.length) {
                stack.remove();
              }
            });
            updateSuffix(node, login);
          }
        });
      }

      function queueAnnotate() {
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => annotate(document));
      }

      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes || []) {
            if (node.nodeType === Node.ELEMENT_NODE) annotate(node);
          }
        }
      });

      function start() {
        observer.observe(document.documentElement, { childList: true, subtree: true });
        queueAnnotate();
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
      } else {
        start();
      }

      return {
        updateSettings(nextSettings) {
          settings = {
            enabled:
              typeof nextSettings.enabled === 'boolean' ? nextSettings.enabled : true,
            visualMode: nextSettings.visualMode === 'badge' ? 'badge' : 'suffix'
          };
          queueAnnotate();
        }
      };
    }
  });
})();
