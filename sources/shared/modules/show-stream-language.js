(function () {
  'use strict';

  function registerModule(definition) {
    window.__twitchEnhancerModuleDefinitions = window.__twitchEnhancerModuleDefinitions || [];
    window.__twitchEnhancerModuleDefinitions.push(definition);
  }

  registerModule({
    id: 'showStreamLanguage',
    create() {
      const langByLogin = new Map();
      const idByLogin = new Map();
      const loginById = new Map();
      const langById = new Map();
      const ANY_LINK_SELECTORS = [
        'a[data-a-target="preview-card-title-link"]',
        'a[data-a-target="preview-card-channel-link"]',
        'a[data-test-selector="preview-card-title-link"]',
        'a[data-test-selector="preview-card-channel-link"]',
        'a[data-test-selector="TitleAndChannel__titleLink"]',
        'a[data-test-selector="TitleAndChannel__channelLink"]'
      ].join(',');

      let settings = {
        enabled: true,
        visualMode: 'suffix'
      };
      let raf = null;

      const toUpperCode = (value) => (typeof value === 'string' ? value.trim().toUpperCase() : null);
      const isIsoLike = (value) => typeof value === 'string' && /^[a-z]{2}(?:-[a-z]{2})?$/i.test(value.trim());
      const tagNameToCode = new Map(Object.entries({
        arabic: 'AR', qatar: 'AR', uae: 'AR', 'العربية': 'AR', bulgarian: 'BG', 'български': 'BG',
        czech: 'CS', cz: 'CS', czsk: 'CS', 'čeština': 'CS', danish: 'DA', dansk: 'DA', deutsch: 'DE',
        greek: 'EL', 'ελληνικά': 'EL', australia: 'EN', english: 'EN', 'español': 'ES', espanol: 'ES',
        suomi: 'FI', francais: 'FR', 'français': 'FR', magyar: 'HU', italiano: 'IT', '日本語': 'JA',
        '한국어': 'KO', lietuva: 'LT', lithuania: 'LT', dutch: 'NL', nederlands: 'NL', norsk: 'NO',
        polski: 'PL', portugues: 'PT', 'português': 'PT', portuguese: 'PT', romania: 'RO',
        romanian: 'RO', 'română': 'RO', 'русский': 'RU', 'slovenčina': 'SK', svenska: 'SV', 'ภาษาไทย': 'TH',
        tagalog: 'TL', turkish: 'TR', 'türkçe': 'TR', ukrainian: 'UK', 'українська': 'UK',
        '中文': 'ZH', '中文(简体)': 'ZH', '中文(繁體)': 'ZH'
      }));

      function clearDecorations(root = document) {
        root.querySelectorAll('.__langChannelInline, .__langSuffixRight, .__langBadge').forEach((element) => {
          element.remove();
        });
      }

      function tagToCode(tagObj) {
        if (!tagObj) return null;
        if (typeof tagObj === 'string') return tagNameToCode.get(tagObj.trim().toLowerCase()) || null;
        const name = tagObj.localizedName || tagObj.name || tagObj.tagName || tagObj.label || tagObj.slug;
        return name ? tagNameToCode.get(String(name).trim().toLowerCase()) || null : null;
      }

      function extractPair(node) {
        if (!node || typeof node !== 'object') return null;

        const login =
          (node.broadcaster && (node.broadcaster.login || node.broadcasterLogin)) ||
          node.userLogin ||
          node.login ||
          (node.channel && (node.channel.login || node.channel.name)) ||
          null;

        let lang = null;
        if (typeof node.broadcasterLanguage === 'string' && node.broadcasterLanguage) lang = node.broadcasterLanguage;
        if (!lang && typeof node.language === 'string' && isIsoLike(node.language)) lang = node.language;
        if (!lang && node.stream && typeof node.stream.language === 'string' && isIsoLike(node.stream.language)) lang = node.stream.language;
        if (!lang && node.channel) {
          const channel = node.channel;
          if (typeof channel.broadcasterLanguage === 'string' && isIsoLike(channel.broadcasterLanguage)) lang = channel.broadcasterLanguage;
          else if (typeof channel.language === 'string' && isIsoLike(channel.language)) lang = channel.language;
        }
        if (!lang) {
          const tags = Array.isArray(node.contentTags) ? node.contentTags : Array.isArray(node.freeformTags) ? node.freeformTags : null;
          if (tags) {
            for (const tag of tags) {
              const code = tagToCode(tag);
              if (code) {
                lang = code;
                break;
              }
            }
          }
        }

        if (login && lang) return { login: String(login).toLowerCase(), lang: toUpperCode(lang) };
        return null;
      }

      function extractTriple(node) {
        if (!node || typeof node !== 'object') return null;

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

        let lang = null;
        if (typeof node.broadcasterLanguage === 'string' && node.broadcasterLanguage) lang = node.broadcasterLanguage;
        if (!lang && typeof node.language === 'string' && isIsoLike(node.language)) lang = node.language;
        if (!lang && node.stream && typeof node.stream.language === 'string' && isIsoLike(node.stream.language)) lang = node.stream.language;
        if (!lang && node.broadcastSettings && typeof node.broadcastSettings.language === 'string') lang = node.broadcastSettings.language;
        if (!lang && node.channel) {
          const channel = node.channel;
          if (typeof channel.broadcasterLanguage === 'string' && isIsoLike(channel.broadcasterLanguage)) lang = channel.broadcasterLanguage;
          else if (typeof channel.language === 'string' && isIsoLike(channel.language)) lang = channel.language;
        }

        const outLogin = login ? String(login).toLowerCase() : null;
        const outLang = lang ? toUpperCode(lang) : null;
        if (outLogin || id || outLang) return { login: outLogin, id, lang: outLang };
        return null;
      }

      function collectLanguages(any, seen = new WeakSet()) {
        if (!any || typeof any !== 'object') return;
        if (seen.has(any)) return;
        seen.add(any);

        const pair = extractPair(any);
        if (pair) {
          const prev = langByLogin.get(pair.login);
          if (prev !== pair.lang) {
            langByLogin.set(pair.login, pair.lang);
            queueAnnotate();
          }
        }

        const triple = extractTriple(any);
        if (triple) {
          let touched = false;

          if (triple.login && triple.id) {
            if (idByLogin.get(triple.login) !== triple.id) {
              idByLogin.set(triple.login, triple.id);
              touched = true;
            }
            if (loginById.get(triple.id) !== triple.login) {
              loginById.set(triple.id, triple.login);
              touched = true;
            }
          }
          if (triple.lang) {
            if (triple.id && langById.get(triple.id) !== triple.lang) {
              langById.set(triple.id, triple.lang);
              touched = true;
            }
            if (triple.login && !langByLogin.has(triple.login)) {
              langByLogin.set(triple.login, triple.lang);
              touched = true;
            }

            if (!triple.login && triple.id) {
              const knownLogin = loginById.get(triple.id);
              if (knownLogin && !langByLogin.get(knownLogin)) {
                langByLogin.set(knownLogin, triple.lang);
                touched = true;
              }
            }
            if (!triple.id && triple.login) {
              const knownId = idByLogin.get(triple.login);
              if (knownId && !langById.get(knownId)) {
                langById.set(knownId, triple.lang);
                touched = true;
              }
            }
          }

          if (touched) queueAnnotate();
        }

        if (Array.isArray(any)) {
          for (const item of any) collectLanguages(item, seen);
        } else {
          for (const key in any) {
            if (!Object.prototype.hasOwnProperty.call(any, key)) continue;
            const value = any[key];
            if (value && typeof value === 'object') collectLanguages(value, seen);
          }
        }
      }

      function getFetchUrl(input) {
        if (typeof input === 'string') return input;
        if (input && typeof input.url === 'string') return input.url;
        return '';
      }

      const originalFetch = window.fetch;
      window.fetch = function (...args) {
        const promise = originalFetch.apply(this, args);
        try {
          const url = getFetchUrl(args[0]);
          if (url.includes('/gql')) {
            promise.then((response) => {
              response.clone().json().then((payload) => collectLanguages(payload)).catch(() => {});
            }).catch(() => {});
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
          isGQL = url && /\/gql(\?|$)/.test(String(url));
          return originalOpen.call(this, method, url, ...rest);
        };
        xhr.addEventListener('load', function () {
          if (!isGQL) return;
          try {
            const contentType = (xhr.getResponseHeader('content-type') || '').toLowerCase();
            if (!contentType.includes('application/json')) return;
            collectLanguages(JSON.parse(xhr.responseText));
          } catch (_) {}
        });
        return xhr;
      };

      function getLoginFromLink(node) {
        const anchor = node.tagName === 'A' ? node : node.closest('a[href^="/"]');
        if (!anchor) return null;
        const href = anchor.getAttribute('href') || '';
        const match = href.match(/^\/([a-zA-Z0-9_]+)(?:\/|$)/);
        return match ? match[1].toLowerCase() : null;
      }

      function inferLanguageFromText(text) {
        if (!text) return null;
        const normalized = text.replace(/https?:\/\/\S+/g, '');
        if (/[ㄱ-ㅎ가-힣]/.test(normalized)) return 'KO';
        if (/[\u3040-\u309F]/.test(normalized) || /[\u30A0-\u30FF]/.test(normalized)) return 'JA';
        if (/[\u4E00-\u9FFF]/.test(normalized)) return 'ZH';
        if (/[\u0600-\u06FF]/.test(normalized)) return 'AR';
        if (/[\u0590-\u05FF]/.test(normalized)) return 'HE';
        if (/[\u0E00-\u0E7F]/.test(normalized)) return 'TH';
        if (/[\u0900-\u097F]/.test(normalized)) return 'HI';
        return null;
      }

      function inferLangFromCard(card) {
        try {
          const titled = card.querySelector('h4[title], h3[title], p[title]');
          const titleFromAttr = titled ? titled.getAttribute('title') : '';
          if (titleFromAttr) return inferLanguageFromText(titleFromAttr);

          const titleEl =
            card.querySelector('a[data-a-target="preview-card-title-link"]') ||
            card.querySelector('a[data-test-selector="preview-card-title-link"]') ||
            card.querySelector('[data-test-selector="TitleAndChannel__title"]');

          return inferLanguageFromText(titleEl ? titleEl.textContent : '');
        } catch (_) {
          return null;
        }
      }

      function getCurrentLogin() {
        const match = location.pathname.match(/^\/([a-zA-Z0-9_]+)(?:\/|$)/);
        return match ? match[1].toLowerCase() : null;
      }

      function getInlineEl(mode) {
        const element = document.createElement('span');
        element.className = '__langChannelInline';
        element.style.marginLeft = '0.2rem';
        element.style.verticalAlign = 'middle';
        element.style.pointerEvents = 'none';
        element.style.fontWeight = '700';

        if (mode === 'badge') {
          element.style.padding = '2px 6px';
          element.style.borderRadius = '4px';
          element.style.fontSize = '12px';
          element.style.lineHeight = '16px';
          element.style.background = 'rgb(235,4,0)';
          element.style.color = '#fff';
        } else {
          element.style.whiteSpace = 'nowrap';
          element.style.opacity = '0.9';
          element.style.color = 'rgb(162,126,217)';
        }

        element.textContent = '[??]';
        return element;
      }

      function ensureChannelHeaderLang(root) {
        const section =
          root.querySelector('section#live-channel-stream-information') ||
          root.querySelector('section[id="live-channel-stream-information"]');
        if (!section) return;

        const heading = section.querySelector('h1');
        if (!heading) return;

        const verifiedSvg = section.querySelector('svg[aria-label*="Verified" i]');
        const verifiedBox = verifiedSvg ? verifiedSvg.closest('[class]') : null;
        const nameLink = (heading.closest && heading.closest('a[href^="/"]')) || null;
        const reference = verifiedBox || nameLink;
        if (!reference || !reference.parentElement) return;

        const parent = reference.parentElement;
        let container = parent.querySelector(':scope > .__langChannelInline');
        const oldSpan = parent.querySelector(':scope > span.__langChannelInline');

        if (!container) {
          container = document.createElement('div');
          container.className = '__langChannelInline';
          parent.insertBefore(container, reference.nextSibling);

          if (oldSpan) {
            oldSpan.classList.remove('__langChannelInline');
            container.appendChild(oldSpan);
          } else {
            const inner = getInlineEl(settings.visualMode);
            inner.classList.remove('__langChannelInline');
            container.appendChild(inner);
          }
        } else if (container.previousSibling !== reference || container.parentElement !== parent) {
          parent.insertBefore(container, reference.nextSibling);
        }

        const login = getCurrentLogin();
        const displayEl = container.firstElementChild || container;
        let code = login ? langByLogin.get(login) : null;
        if (!code && login) {
          const id = idByLogin.get(login);
          if (id) code = langById.get(id) || null;
        }
        displayEl.textContent = `[${code || '??'}]`;
      }

      function ensureRightSuffix(node, login) {
        const card = node.closest('article,[data-target="directory-first-item"]') || node;
        const primaryNode =
          card.querySelector('p[data-a-target="preview-card-channel-link"], p[data-test-selector="TitleAndChannel__channelLink"]') ||
          node;

        let row = primaryNode.parentElement || primaryNode;
        if (row && row.nextElementSibling && row.parentElement) {
          row = row.parentElement;
        }

        let badge = row.querySelector('.__langSuffixRight');
        if (!badge) {
          badge = document.createElement('div');
          badge.className = '__langSuffixRight';
          badge.style.marginLeft = 'auto';
          badge.style.whiteSpace = 'nowrap';
          badge.style.fontWeight = '600';
          badge.style.opacity = '0.9';
          badge.style.order = '999';
          row.appendChild(badge);
        }

        badge.style.color = 'rgb(162,126,217)';
        badge.style.pointerEvents = 'none';

        let code = langByLogin.get(login);
        if (!code) {
          const inferred = inferLangFromCard(card);
          if (inferred) code = inferred;
        }
        badge.textContent = `[${code || '??'}]`;

        card.querySelectorAll('.__langSuffixRight').forEach((element) => {
          if (element !== badge && element.parentElement !== row) element.remove();
        });
      }

      function ensureBadge(anchor, login) {
        const article = anchor.closest('article') || anchor.closest('div[data-target="directory-first-item"]') || anchor.closest('div') || anchor;

        const thumb =
          article.querySelector('[data-a-target="preview-card-image-link"]') ||
          article.querySelector('[data-a-target="preview-card-thumbnail"]') ||
          article.querySelector('figure') ||
          article;

        if (getComputedStyle(thumb).position === 'static') {
          thumb.style.position = 'relative';
        }

        let element = thumb.querySelector('.__langBadge');
        if (!element) {
          element = document.createElement('div');
          element.className = '__langBadge';
          element.style.position = 'absolute';
          element.style.top = '8px';
          element.style.right = '8px';
          element.style.padding = '2px 6px';
          element.style.borderRadius = '4px';
          element.style.fontSize = '12px';
          element.style.fontWeight = '700';
          element.style.lineHeight = '16px';
          element.style.background = 'rgb(235,4,0)';
          element.style.color = '#fff';
          element.style.pointerEvents = 'none';
          element.style.zIndex = '3';
          element.textContent = '[??]';
          thumb.appendChild(element);
        }

        let code = langByLogin.get(login);
        if (!code) {
          const inferred = inferLangFromCard(article);
          if (inferred) code = inferred;
        }
        element.textContent = `[${code || '??'}]`;
      }

      function annotate(root = document) {
        if (!settings.enabled) {
          clearDecorations(root);
          return;
        }

        ensureChannelHeaderLang(root);

        if (settings.visualMode === 'suffix') {
          const nodes = root.querySelectorAll(
            'p[data-a-target="preview-card-channel-link"], p[data-test-selector="TitleAndChannel__channelLink"], a[data-a-target="preview-card-channel-link"], a[data-test-selector="preview-card-channel-link"], a[data-test-selector="TitleAndChannel__channelLink"]'
          );
          nodes.forEach((node) => {
            const login = getLoginFromLink(node);
            if (!login) return;
            ensureRightSuffix(node, login);
          });
        } else {
          const links = root.querySelectorAll(ANY_LINK_SELECTORS);
          links.forEach((anchor) => {
            const login = getLoginFromLink(anchor);
            if (!login) return;
            ensureBadge(anchor, login);
          });
        }
      }

      function queueAnnotate() {
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => annotate(document));
      }

      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (!mutation.addedNodes || !mutation.addedNodes.length) continue;
          for (const node of mutation.addedNodes) {
            if (node.nodeType === 1) annotate(node);
          }
        }
      });

      function start() {
        try {
          observer.observe(document.documentElement, { childList: true, subtree: true });
        } catch (_) {}
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
            enabled: typeof nextSettings.enabled === 'boolean' ? nextSettings.enabled : true,
            visualMode: nextSettings.visualMode === 'badge' ? 'badge' : 'suffix'
          };

          queueAnnotate();
        }
      };
    }
  });
})();
