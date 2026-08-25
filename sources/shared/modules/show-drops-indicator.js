(function () {
  'use strict';

  function registerModule(definition) {
    window.__twitchEnhancerModuleDefinitions = window.__twitchEnhancerModuleDefinitions || [];
    window.__twitchEnhancerModuleDefinitions.push(definition);
  }

  registerModule({
    id: 'showDropsIndicator',
    create() {
      const gql = window.__twitchEnhancerGQL;
      const streamCards = window.__twitchEnhancerStreamCards;
      const dropsByLogin = new Map();
      const DROPS_TAG_NAMES = new Set([
        'drops', // common
        'dropsenabled', // English
        // Bahasa Indonesia - Indonesian - not covered
        // Català — Catalan - not covered
        'dropsaktiveret', // Dansk - Danish
        'dropsaktiviert', // Deutsch - German
        'dropsactivados', // Español - Spanish
        'dropsactivés', // Français - French
        'dropabilitati', // Italiano - Italian
        'dropokengedélyezve', // Magyar - Hungarian
        'dropsingeschakeld', // Nederlands - Dutch
        'dropsaktivert', // Norsk - Norwegian
        'dropywłączone', // Polski - Polish
        'dropsativados', // Português - Portuguese
        'dropssuntactivate', // Română - Romanian
        'dropyzapnuté', // Slovenčina - Slovak
        'dropitkäytössä', // Suomi - Finnish
        'dropsaktiverat', // Svenska - Swedish
        // Tagalog - not covered
        // Tiếng Việt - Vietnamese - not covered
        'droplaretkin', // Türkçe - Turkish
        'povolenédrops', // Čeština - Czech
        'ταdropενεργοποιήθηκαν', // Ελληνικά - Greek
        'сразрешениdrops', // Български - Bulgarian
        'dropsвключены', // Русский - Russian
        'dropsувімкнено', // Українська - Ukrainian
        'تم・تمكين・drops', // العربية - Arabic
        // بهاس ملايو - Malay - not covered
        // मानक हिन्दी - Standard Hindi - not covered
        'ใช้dropsได้', // ภาษาไทย - Thai
        '启用掉宝', // 中文 - Chinese
        'drops有効', // 日本語 - Japanese
        '드롭활성화됨', // 한국어 - Korean
		// Additional fallbacks
		'dropsenable'
      ]);
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
        if (!tag) {
          return false;
        }

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

      function collectDrops(value, seen = new WeakSet()) {
        if (!value || typeof value !== 'object' || seen.has(value)) {
          return;
        }
        seen.add(value);

        if (Array.isArray(value.freeformTags)) {
          const login = getLogin(value);
          if (login) {
            const hasDrops =
              value.freeformTags.some(isDropsTag) || hasDropsInTitle(value);
            if (dropsByLogin.get(login) !== hasDrops) {
              dropsByLogin.set(login, hasDrops);
              queueAnnotate();
            }
          }
        }

        if (Array.isArray(value)) {
          value.forEach((item) => collectDrops(item, seen));
          return;
        }

        for (const key in value) {
          if (!Object.prototype.hasOwnProperty.call(value, key)) {
            continue;
          }

          const child = value[key];
          if (child && typeof child === 'object') {
            collectDrops(child, seen);
          }
        }
      }

      function createIcon(className, mode) {
        const indicator =
          mode === 'badge'
            ? streamCards.createBadge(className)
            : document.createElement('span');

        indicator.className = className;
        indicator.title = 'Drops enabled';
        indicator.setAttribute('role', 'img');
        indicator.setAttribute('aria-label', 'Drops enabled');
        indicator.style.display = 'inline-flex';
        indicator.style.alignItems = 'center';
        indicator.style.justifyContent = 'center';
        indicator.style.flex = '0 0 auto';
        indicator.style.order = '0';

        if (mode === 'suffix') {
          indicator.style.height = '1cap';
          indicator.style.color = 'rgb(162,126,217)';
          indicator.style.pointerEvents = 'none';
        }

        const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
        svg.setAttribute('viewBox', '0 0 20 14');
        svg.setAttribute('aria-hidden', 'true');
        svg.style.display = 'block';
        svg.style.width = 'auto';
        svg.style.height = mode === 'badge' ? '1em' : '1cap';
        svg.style.fill = 'currentColor';

        ICON_PATHS.forEach((definition) => {
          const path = document.createElementNS(SVG_NAMESPACE, 'path');
          path.setAttribute('d', definition.d);
          if (definition.fillRule) {
            path.setAttribute('fill-rule', definition.fillRule);
          }
          if (definition.clipRule) {
            path.setAttribute('clip-rule', definition.clipRule);
          }
          svg.appendChild(path);
        });

        indicator.appendChild(svg);
        return indicator;
      }

      function updateSuffix(node, login) {
        const card = streamCards.getCard(node);
        let indicator = card.querySelector('.__dropsIndicator');

        if (!settings.enabled || !dropsByLogin.get(login)) {
          streamCards.removeDecoration(indicator);
          return;
        }

        const { stack } = streamCards.getSuffixStack(node);
        if (!indicator) {
          indicator = createIcon('__dropsIndicator', 'suffix');
        }
        stack.appendChild(indicator);

        card.querySelectorAll('.__dropsIndicator').forEach((element) => {
          if (element !== indicator) {
            streamCards.removeDecoration(element);
          }
        });
      }

      function updateBadge(node, login) {
        const card = streamCards.getCard(node);
        let badge = card.querySelector('.__dropsBadge');

        if (!settings.enabled || !dropsByLogin.get(login)) {
          streamCards.removeDecoration(badge);
          return;
        }

        const stack = streamCards.getBadgeStack(card);
        if (!badge) {
          badge = createIcon('__dropsBadge', 'badge');
        }
        stack.appendChild(badge);

        card.querySelectorAll('.__dropsBadge').forEach((element) => {
          if (element !== badge) {
            streamCards.removeDecoration(element);
          }
        });
      }

      function clearIndicators(root = document) {
        root
          .querySelectorAll('.__dropsIndicator, .__dropsBadge')
          .forEach(streamCards.removeDecoration);
      }

      function annotate(root = document) {
        if (!settings.enabled) {
          clearIndicators(root);
          return;
        }

        root.querySelectorAll(streamCards.CHANNEL_LINK_SELECTOR).forEach((node) => {
          const login = streamCards.getLoginFromLink(node);
          if (!login) {
            return;
          }

          const card = streamCards.getCard(node);
          if (settings.visualMode === 'badge') {
            card
              .querySelectorAll('.__dropsIndicator')
              .forEach(streamCards.removeDecoration);
            updateBadge(node, login);
          } else {
            card.querySelectorAll('.__dropsBadge').forEach(streamCards.removeDecoration);
            updateSuffix(node, login);
          }
        });
      }

      function queueAnnotate() {
        if (raf) {
          cancelAnimationFrame(raf);
        }
        raf = requestAnimationFrame(() => annotate(document));
      }

      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes || []) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              annotate(node);
            }
          }
        }
      });

      gql.subscribe(collectDrops);

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
