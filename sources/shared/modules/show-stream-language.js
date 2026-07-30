(function () {
  'use strict';

  function registerModule(definition) {
    window.__twitchEnhancerModuleDefinitions = window.__twitchEnhancerModuleDefinitions || [];
    window.__twitchEnhancerModuleDefinitions.push(definition);
  }

  registerModule({
    id: 'showStreamLanguage',
    create() {
      const gql = window.__twitchEnhancerGQL;
      const streamCards = window.__twitchEnhancerStreamCards;
      const languageByLogin = new Map();
      const languageById = new Map();
      const idByLogin = new Map();
      const loginById = new Map();
      const LANGUAGE_TAG_CODES = new Map(
        Object.entries({
          arabic: 'AR',
          qatar: 'AR',
          uae: 'AR',
          'العربية': 'AR',
          bulgarian: 'BG',
          'български': 'BG',
          czech: 'CS',
          cz: 'CS',
          czsk: 'CS',
          'čeština': 'CS',
          danish: 'DA',
          dansk: 'DA',
          deutsch: 'DE',
          greek: 'EL',
          'ελληνικά': 'EL',
          australia: 'EN',
          english: 'EN',
          'español': 'ES',
          espanol: 'ES',
          suomi: 'FI',
          francais: 'FR',
          'français': 'FR',
          magyar: 'HU',
          italiano: 'IT',
          '日本語': 'JA',
          '한국어': 'KO',
          lietuva: 'LT',
          lithuania: 'LT',
          dutch: 'NL',
          nederlands: 'NL',
          norsk: 'NO',
          polski: 'PL',
          portugues: 'PT',
          'português': 'PT',
          portuguese: 'PT',
          romania: 'RO',
          romanian: 'RO',
          'română': 'RO',
          'русский': 'RU',
          'slovenčina': 'SK',
          svenska: 'SV',
          'ภาษาไทย': 'TH',
          tagalog: 'TL',
          turkish: 'TR',
          'türkçe': 'TR',
          ukrainian: 'UK',
          'українська': 'UK',
          '中文': 'ZH',
          '中文(简体)': 'ZH',
          '中文(繁體)': 'ZH'
        })
      );

      let settings = {
        enabled: true,
        visualMode: 'suffix'
      };
      let raf = null;

      function normalizeLanguage(value) {
        return typeof value === 'string' ? value.trim().toUpperCase() : null;
      }

      function isLanguageCode(value) {
        return (
          typeof value === 'string' &&
          /^[a-z]{2}(?:-[a-z]{2})?$/i.test(value.trim())
        );
      }

      function getTagLanguage(tag) {
        if (!tag) {
          return null;
        }

        const name =
          typeof tag === 'string'
            ? tag
            : tag.localizedName || tag.name || tag.tagName || tag.label || tag.slug;

        return name
          ? LANGUAGE_TAG_CODES.get(String(name).trim().toLowerCase()) || null
          : null;
      }

      function extractLanguagePair(node) {
        if (!node || typeof node !== 'object') {
          return null;
        }

        const login =
          (node.broadcaster && (node.broadcaster.login || node.broadcasterLogin)) ||
          node.userLogin ||
          node.login ||
          (node.channel && (node.channel.login || node.channel.name)) ||
          null;

        let language = null;
        if (
          typeof node.broadcasterLanguage === 'string' &&
          node.broadcasterLanguage
        ) {
          language = node.broadcasterLanguage;
        }
        if (!language && isLanguageCode(node.language)) {
          language = node.language;
        }
        if (!language && node.stream && isLanguageCode(node.stream.language)) {
          language = node.stream.language;
        }
        if (!language && node.channel) {
          if (isLanguageCode(node.channel.broadcasterLanguage)) {
            language = node.channel.broadcasterLanguage;
          } else if (isLanguageCode(node.channel.language)) {
            language = node.channel.language;
          }
        }

        if (!language) {
          const tags = Array.isArray(node.contentTags)
            ? node.contentTags
            : Array.isArray(node.freeformTags)
              ? node.freeformTags
              : null;

          if (tags) {
            for (const tag of tags) {
              const tagLanguage = getTagLanguage(tag);
              if (tagLanguage) {
                language = tagLanguage;
                break;
              }
            }
          }
        }

        if (!login || !language) {
          return null;
        }

        return {
          login: String(login).toLowerCase(),
          language: normalizeLanguage(language)
        };
      }

      function extractLanguageRecord(node) {
        if (!node || typeof node !== 'object') {
          return null;
        }

        const login =
          (node.broadcaster && (node.broadcaster.login || node.broadcasterLogin)) ||
          (node.user && node.user.login) ||
          (node.userByAttribute && node.userByAttribute.login) ||
          node.userLogin ||
          node.login ||
          (node.channel && (node.channel.login || node.channel.name)) ||
          null;
        const id =
          (node.user && node.user.id) ||
          (node.userByAttribute && node.userByAttribute.id) ||
          (node.channel && node.channel.id) ||
          (node.broadcaster && node.broadcaster.id) ||
          node.id ||
          null;

        let language = null;
        if (
          typeof node.broadcasterLanguage === 'string' &&
          node.broadcasterLanguage
        ) {
          language = node.broadcasterLanguage;
        }
        if (!language && isLanguageCode(node.language)) {
          language = node.language;
        }
        if (!language && node.stream && isLanguageCode(node.stream.language)) {
          language = node.stream.language;
        }
        if (
          !language &&
          node.broadcastSettings &&
          typeof node.broadcastSettings.language === 'string'
        ) {
          language = node.broadcastSettings.language;
        }
        if (!language && node.channel) {
          if (isLanguageCode(node.channel.broadcasterLanguage)) {
            language = node.channel.broadcasterLanguage;
          } else if (isLanguageCode(node.channel.language)) {
            language = node.channel.language;
          }
        }

        const normalizedLogin = login ? String(login).toLowerCase() : null;
        const normalizedLanguage = language
          ? normalizeLanguage(language)
          : null;

        if (!normalizedLogin && !id && !normalizedLanguage) {
          return null;
        }

        return {
          login: normalizedLogin,
          id,
          language: normalizedLanguage
        };
      }

      function collectLanguages(value, seen = new WeakSet()) {
        if (!value || typeof value !== 'object' || seen.has(value)) {
          return false;
        }
        seen.add(value);

        const pair = extractLanguagePair(value);
        if (
          pair &&
          languageByLogin.get(pair.login) !== pair.language
        ) {
          languageByLogin.set(pair.login, pair.language);
          queueAnnotate();
        }

        const record = extractLanguageRecord(value);
        if (record) {
          let changed = false;

          if (record.login && record.id) {
            if (idByLogin.get(record.login) !== record.id) {
              idByLogin.set(record.login, record.id);
              changed = true;
            }
            if (loginById.get(record.id) !== record.login) {
              loginById.set(record.id, record.login);
              changed = true;
            }
          }

          if (record.language) {
            if (
              record.id &&
              languageById.get(record.id) !== record.language
            ) {
              languageById.set(record.id, record.language);
              changed = true;
            }
            if (record.login && !languageByLogin.has(record.login)) {
              languageByLogin.set(record.login, record.language);
              changed = true;
            }

            if (!record.login && record.id) {
              const knownLogin = loginById.get(record.id);
              if (knownLogin && !languageByLogin.get(knownLogin)) {
                languageByLogin.set(knownLogin, record.language);
                changed = true;
              }
            }
            if (!record.id && record.login) {
              const knownId = idByLogin.get(record.login);
              if (knownId && !languageById.get(knownId)) {
                languageById.set(knownId, record.language);
                changed = true;
              }
            }
          }

          if (changed) {
            queueAnnotate();
          }
        }

        if (Array.isArray(value)) {
          value.forEach((item) => collectLanguages(item, seen));
          return;
        }

        for (const key in value) {
          if (!Object.prototype.hasOwnProperty.call(value, key)) {
            continue;
          }

          const child = value[key];
          if (child && typeof child === 'object') {
            collectLanguages(child, seen);
          }
        }

        return true;
      }

      function inferLanguageFromText(text) {
        if (!text) {
          return null;
        }

        const normalized = text.replace(/https?:\/\/\S+/g, '');
        if (/[ㄱ-ㅎ가-힣]/.test(normalized)) return 'KO';
        if (/[\u3040-\u309F]/.test(normalized)) return 'JA';
        if (/[\u30A0-\u30FF]/.test(normalized)) return 'JA';
        if (/[\u4E00-\u9FFF]/.test(normalized)) return 'ZH';
        if (/[\u0600-\u06FF]/.test(normalized)) return 'AR';
        if (/[\u0590-\u05FF]/.test(normalized)) return 'HE';
        if (/[\u0E00-\u0E7F]/.test(normalized)) return 'TH';
        if (/[\u0900-\u097F]/.test(normalized)) return 'HI';
        return null;
      }

      function inferLanguageFromCard(card) {
        try {
          const titled = card.querySelector('h4[title], h3[title], p[title]');
          const title = titled ? titled.getAttribute('title') : '';
          if (title) {
            return inferLanguageFromText(title);
          }

          const titleElement =
            card.querySelector('a[data-a-target="preview-card-title-link"]') ||
            card.querySelector('a[data-test-selector="preview-card-title-link"]') ||
            card.querySelector('[data-test-selector="TitleAndChannel__title"]');

          return inferLanguageFromText(titleElement ? titleElement.textContent : '');
        } catch (_) {
          return null;
        }
      }

      function resolveLanguage(login, card = null) {
        let language = languageByLogin.get(login);
        if (!language) {
          const id = idByLogin.get(login);
          language = id ? languageById.get(id) : null;
        }
        return language || (card ? inferLanguageFromCard(card) : null);
      }

      function getCurrentLogin() {
        const match = location.pathname.match(/^\/([a-zA-Z0-9_]+)(?:\/|$)/);
        return match ? match[1].toLowerCase() : null;
      }

      function createChannelLabel() {
        const label = document.createElement('span');
        label.style.marginLeft = '0.2rem';
        label.style.verticalAlign = 'middle';
        label.style.pointerEvents = 'none';
        label.style.fontWeight = '700';

        if (settings.visualMode === 'badge') {
          label.style.padding = '2px 6px';
          label.style.borderRadius = '4px';
          label.style.fontSize = '12px';
          label.style.lineHeight = '16px';
          label.style.background = 'rgb(235,4,0)';
          label.style.color = '#fff';
        } else {
          label.style.whiteSpace = 'nowrap';
          label.style.opacity = '0.9';
          label.style.color = 'rgb(162,126,217)';
        }

        return label;
      }

      function updateChannelHeader(root) {
        const section = root.querySelector(
          'section#live-channel-stream-information'
        );
        if (!section) {
          return;
        }

        const heading = section.querySelector('h1');
        if (!heading) {
          return;
        }

        const verifiedIcon = section.querySelector('svg[aria-label*="Verified" i]');
        const verifiedContainer = verifiedIcon
          ? verifiedIcon.closest('[class]')
          : null;
        const nameLink = heading.closest('a[href^="/"]');
        const reference = verifiedContainer || nameLink;
        if (!reference || !reference.parentElement) {
          return;
        }

        const parent = reference.parentElement;
        let container = parent.querySelector(':scope > .__langChannelInline');
        if (!container) {
          container = document.createElement('div');
          container.className = '__langChannelInline';
          container.appendChild(createChannelLabel());
        }
        parent.insertBefore(container, reference.nextSibling);

        const login = getCurrentLogin();
        const language = login ? resolveLanguage(login) : null;
        const label = container.firstElementChild || container;
        label.textContent = `[${language || '??'}]`;
      }

      function updateSuffix(node, login) {
        const card = streamCards.getCard(node);
        const { stack } = streamCards.getSuffixStack(node);
        let suffix = card.querySelector('.__langSuffixRight');

        if (!suffix) {
          suffix = document.createElement('div');
          suffix.className = '__langSuffixRight';
          suffix.style.fontWeight = '600';
          suffix.style.opacity = '0.9';
          suffix.style.color = 'rgb(162,126,217)';
          suffix.style.order = '1';
        }

        suffix.textContent = `[${resolveLanguage(login, card) || '??'}]`;
        stack.appendChild(suffix);

        card.querySelectorAll('.__langSuffixRight').forEach((element) => {
          if (element !== suffix) {
            streamCards.removeDecoration(element);
          }
        });
      }

      function updateBadge(node, login) {
        const card = streamCards.getCard(node);
        const stack = streamCards.getBadgeStack(card);
        let badge = card.querySelector('.__langBadge');

        if (!badge) {
          badge = streamCards.createBadge('__langBadge');
          badge.style.order = '1';
        }

        badge.textContent = `[${resolveLanguage(login, card) || '??'}]`;
        stack.appendChild(badge);

        card.querySelectorAll('.__langBadge').forEach((element) => {
          if (element !== badge) {
            streamCards.removeDecoration(element);
          }
        });
      }

      function clearDecorations(root = document) {
        root.querySelectorAll('.__langChannelInline').forEach((element) => {
          element.remove();
        });
        root
          .querySelectorAll('.__langSuffixRight, .__langBadge')
          .forEach(streamCards.removeDecoration);
      }

      function annotate(root = document) {
        if (!settings.enabled) {
          clearDecorations(root);
          return;
        }

        updateChannelHeader(root);

        const selector =
          settings.visualMode === 'badge'
            ? streamCards.ANY_LINK_SELECTOR
            : streamCards.CHANNEL_LINK_SELECTOR;

        root.querySelectorAll(selector).forEach((node) => {
          const login = streamCards.getLoginFromLink(node);
          if (!login) {
            return;
          }

          const card = streamCards.getCard(node);
          if (settings.visualMode === 'badge') {
            card
              .querySelectorAll('.__langSuffixRight')
              .forEach(streamCards.removeDecoration);
            updateBadge(node, login);
          } else {
            card.querySelectorAll('.__langBadge').forEach(streamCards.removeDecoration);
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

      gql.subscribe(collectLanguages);

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
