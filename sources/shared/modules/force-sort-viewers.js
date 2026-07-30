(function () {
  'use strict';

  function registerModule(definition) {
    window.__twitchEnhancerModuleDefinitions = window.__twitchEnhancerModuleDefinitions || [];
    window.__twitchEnhancerModuleDefinitions.push(definition);
  }

  registerModule({
    id: 'forceSortViewers',
    create() {
      const TARGET_LABELS = new Set([
        // English
        'Viewers (High to Low)',
        // Dansk — Danish
        'Seere (høj-lav)',
        // Deutsch — German
        'Zuschauer (viel -> wenig)',
        // Español - España — Spanish (Spain)
        'Espectadores (descend.)',
        // Español - Latinoamérica — Spanish (Latin America)
        'Más espectadores',
        // Français — French
        'Spectateurs (décroissant)',
        // Italiano — Italian
        'Spettatori (decr.)',
        // Magyar — Hungarian
        'Nézők száma (csökkenő)',
        // Nederlands — Dutch
        'Kijkers (hoog - laag)',
        // Norsk — Norwegian
        'Seere (høyt til lavt)',
        // Polski — Polish
        'Widzów (najwięcej)',
        // Português — Portuguese
        'Espetadores (ordem desc.)',
        // Português - Brasil — Portuguese (Brazil)
        'Espectadores (ordem decrescente)',
        // Română — Romanian
        'Vizualizatori (mare la mic)',
        // Slovenčina — Slovak
        'Divákov (zostupne)',
        // Suomi — Finnish
        'Katsojaluku (suurin ensin)',
        // Svenska — Swedish
        'Tittare (flest först)',
        // Tiếng Việt — Vietnamese
        'Lượng xem (Cao đến thấp)',
        // Türkçe — Turkish
        'İzleyici (çoktan aza)',
        // Čeština — Czech
        'Diváků (sestupně)',
        // Ελληνικά — Greek
        'Θεατές (Φθίν. ταξιν.)',
        // Български — Bulgarian
        'Зрители (низходящ ред)',
        // Русский — Russian
        'Аудитория (по убыв.)',
        // Українська — Ukrainian
        'Глядачі (за спаданням)',
        // ภาษาไทย — Thai
        'ผู้ชม (สูงไปต่ำ)',
        // العربية — Arabic
        'المشاهدون (من الأعلى إلى الأقل)',
        // 中文 简体 — Chinese (Simplified)
        '观众人数（高到低）',
        // 中文 繁體 — Chinese (Traditional)
        '觀眾人數 (高到低)',
        // 日本語 — Japanese
        '視聴者数（降順）',
        // 한국어 — Korean
        '시청자 수 (높은 순)'
      ]);
      const SORT_COMBO_SELECTOR =
        '[role="combobox"][id*="browse-sort-drop-down"], ' +
        '[role="combobox"][aria-controls*="browse-sort-drop-down"]';
      const SORT_LABEL_SELECTOR = '[data-a-target="tw-core-button-label-text"]';
      const SORT_OPTION_SELECTOR = '[role="menuitemradio"], [role="option"]';
      const LOCATION_CHANGE_EVENT = 'twitch-enhancer-locationchange';

      let settings = {
        enabled: true,
        runPolicy: 'perLoad'
      };

      function normalizeText(text) {
        return (text || '').replace(/\s+/g, ' ').trim();
      }

      function isTargetLabel(text) {
        return TARGET_LABELS.has(normalizeText(text));
      }

      function extractOptionLabel(element) {
        return normalizeText(
          element?.getAttribute('aria-label') ||
            element?.getAttribute('title') ||
            element?.textContent ||
            ''
        );
      }

      function isVisible(element) {
        return Boolean(
          element && (element.offsetParent || element.getClientRects().length)
        );
      }

      function safeClick(element) {
        try {
          element.click();
        } catch (_) {}
      }

      function waitFor(
        selector,
        { timeout = 15000, interval = 150, filter = null } = {}
      ) {
        return new Promise((resolve, reject) => {
          const startedAt = Date.now();

          function poll() {
            if (!settings.enabled) {
              reject(new Error('disabled'));
              return;
            }

            const elements = Array.from(document.querySelectorAll(selector));
            const element = filter ? elements.find(filter) : elements[0];
            if (element) {
              resolve(element);
              return;
            }

            if (Date.now() - startedAt > timeout) {
              reject(new Error(`timeout:${selector}`));
              return;
            }

            setTimeout(poll, interval);
          }

          poll();
        });
      }

      function blurAfterAutoAction(...relatedElements) {
        requestAnimationFrame(() => {
          const activeElement = document.activeElement;
          if (
            !activeElement ||
            activeElement === document.body ||
            !relatedElements.includes(activeElement)
          ) {
            return;
          }

          try {
            activeElement.blur();
          } catch (_) {}
        });
      }

      function getNormalizedUrl() {
        const url = new URL(location.href);
        url.searchParams.delete('sort');
        return `${url.pathname}${url.search}`;
      }

      function getRunKey() {
        const baseKey = `tw_sort_viewers_high_to_low_${getNormalizedUrl()}`;
        return settings.runPolicy === 'perLoad'
          ? `${baseKey}_${performance.timeOrigin}`
          : baseKey;
      }

      function alreadyRan() {
        return Boolean(sessionStorage.getItem(getRunKey()));
      }

      function markRan() {
        sessionStorage.setItem(getRunKey(), '1');
      }

      async function ensureTargetSort() {
        if (!settings.enabled || alreadyRan()) {
          return;
        }

        try {
          const combo = await waitFor(SORT_COMBO_SELECTOR);
          const labelElement = combo.querySelector(SORT_LABEL_SELECTOR);
          const labelText = normalizeText(
            labelElement ? labelElement.textContent : combo.textContent
          );

          if (isTargetLabel(labelText)) {
            markRan();
            return;
          }

          safeClick(combo);
          const option = await waitFor(SORT_OPTION_SELECTOR, {
            filter: (element) =>
              isVisible(element) && isTargetLabel(extractOptionLabel(element))
          });

          safeClick(option);
          blurAfterAutoAction(combo, option);
          markRan();
        } catch (_) {
          // Ignore Twitch timing failures; the next navigation or reload will try again.
        }
      }

      function scheduleEnsure(delayMs) {
        setTimeout(() => {
          ensureTargetSort();
        }, delayMs);
      }

      function dispatchLocationChange() {
        window.dispatchEvent(new Event(LOCATION_CHANGE_EVENT));
      }

      function hookHistory() {
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;

        history.pushState = function () {
          originalPushState.apply(this, arguments);
          dispatchLocationChange();
        };
        history.replaceState = function () {
          originalReplaceState.apply(this, arguments);
          dispatchLocationChange();
        };

        window.addEventListener('popstate', dispatchLocationChange);
      }

      function start() {
        hookHistory();
        window.addEventListener(LOCATION_CHANGE_EVENT, () => {
          scheduleEnsure(600);
        });
        scheduleEnsure(500);
      }

      start();

      return {
        updateSettings(nextSettings) {
          settings = {
            enabled:
              typeof nextSettings.enabled === 'boolean' ? nextSettings.enabled : true,
            runPolicy: nextSettings.runPolicy === 'perTab' ? 'perTab' : 'perLoad'
          };

          if (settings.enabled) {
            scheduleEnsure(200);
          }
        }
      };
    }
  });
})();
