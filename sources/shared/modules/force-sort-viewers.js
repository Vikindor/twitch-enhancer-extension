(function () {
  'use strict';

  function registerModule(definition) {
    window.__twitchEnhancerModuleDefinitions = window.__twitchEnhancerModuleDefinitions || [];
    window.__twitchEnhancerModuleDefinitions.push(definition);
  }

  registerModule({
    id: 'forceSortViewers',
    create() {
      const TARGET_LABELS = [
        'Viewers (High to Low)',
        'Seere (høj-lav)',
        'Zuschauer (viel -> wenig)',
        'Espectadores (descend.)',
        'Más espectadores',
        'Spectateurs (décroissant)',
        'Spettatori (decr.)',
        'Nézők száma (csökkenő)',
        'Kijkers (hoog - laag)',
        'Seere (høyt til lavt)',
        'Widzów (najwięcej)',
        'Espetadores (ordem desc.)',
        'Espectadores (ordem decrescente)',
        'Vizualizatori (mare la mic)',
        'Divákov (zostupne)',
        'Katsojaluku (suurin ensin)',
        'Tittare (flest först)',
        'Lượng xem (Cao đến thấp)',
        'İzleyici (çoktan aza)',
        'Diváků (sestupně)',
        'Θεατές (Φθίν. ταξιν.)',
        'Зрители (низходящ ред)',
        'Аудитория (по убыв.)',
        'ผู้ชม (สูงไปต่ำ)',
        'المشاهدون (من الأعلى إلى الأقل)',
        '观众人数（高到低）',
        '觀眾人數 (高到低)',
        '視聴者数（降順）',
        '시청자 수 (높은 순)'
      ];

      let settings = {
        enabled: true,
        runPolicy: 'perLoad'
      };

      function waitFor(selector, { timeout = 15000, interval = 150, filter = null } = {}) {
        return new Promise((resolve, reject) => {
          const t0 = Date.now();
          (function poll() {
            if (!settings.enabled) {
              reject(new Error('disabled'));
              return;
            }

            const nodes = Array.from(document.querySelectorAll(selector));
            const el = filter ? nodes.find(filter) : nodes[0];
            if (el) {
              resolve(el);
              return;
            }
            if (Date.now() - t0 > timeout) {
              reject(new Error(`timeout:${selector}`));
              return;
            }
            setTimeout(poll, interval);
          })();
        });
      }

      function safeClick(el) {
        try {
          el.click();
        } catch (_) {}
      }

      function isVisible(el) {
        return !!(el && (el.offsetParent || el.getClientRects().length));
      }

      function normalizeText(text) {
        return (text || '').replace(/\s+/g, ' ').trim();
      }

      function isTargetLabel(text) {
        return TARGET_LABELS.includes(normalizeText(text));
      }

      function extractOptionLabel(el) {
        return normalizeText(
          el?.getAttribute('aria-label') ||
          el?.getAttribute('title') ||
          el?.textContent ||
          ''
        );
      }

      function blurAfterAutoAction(...relatedEls) {
        requestAnimationFrame(() => {
          const activeEl = document.activeElement;
          if (!activeEl || activeEl === document.body) return;
          if (!relatedEls.includes(activeEl)) return;

          try {
            activeEl.blur();
          } catch (_) {}
        });
      }

      function getNormalizedUrl() {
        const u = new URL(location.href);
        u.searchParams.delete('sort');
        return `${u.pathname}${u.search}`;
      }

      function getRunKey() {
        if (settings.runPolicy === 'perLoad') {
          return `tw_sort_viewers_high_to_low_${getNormalizedUrl()}_${performance.timeOrigin}`;
        }
        return `tw_sort_viewers_high_to_low_${getNormalizedUrl()}`;
      }

      function alreadyRan() {
        return !!sessionStorage.getItem(getRunKey());
      }

      function markRan() {
        sessionStorage.setItem(getRunKey(), '1');
      }

      async function ensureTargetSort() {
        if (!settings.enabled || alreadyRan()) return;

        try {
          const combo = await waitFor(
            '[role="combobox"][id*="browse-sort-drop-down"], [role="combobox"][aria-controls*="browse-sort-drop-down"]'
          );

          const labelEl = combo.querySelector('[data-a-target="tw-core-button-label-text"]');
          const labelText = normalizeText(labelEl ? labelEl.textContent : combo.textContent);
          if (isTargetLabel(labelText)) {
            markRan();
            return;
          }

          safeClick(combo);
          const option = await waitFor('[role="menuitemradio"], [role="option"]', {
            filter: (el) => isVisible(el) && isTargetLabel(extractOptionLabel(el))
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

      (function hookHistory() {
        const fire = () => window.dispatchEvent(new Event('twitch-enhancer-locationchange'));
        const pushState = history.pushState;
        const replaceState = history.replaceState;

        history.pushState = function () {
          pushState.apply(this, arguments);
          fire();
        };
        history.replaceState = function () {
          replaceState.apply(this, arguments);
          fire();
        };

        window.addEventListener('popstate', fire);
      })();

      window.addEventListener('twitch-enhancer-locationchange', () => {
        scheduleEnsure(600);
      });

      scheduleEnsure(500);

      return {
        updateSettings(nextSettings) {
          settings = {
            enabled: typeof nextSettings.enabled === 'boolean' ? nextSettings.enabled : true,
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
