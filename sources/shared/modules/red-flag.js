(function () {
  'use strict';

  function registerModule(definition) {
    window.__twitchEnhancerModuleDefinitions = window.__twitchEnhancerModuleDefinitions || [];
    window.__twitchEnhancerModuleDefinitions.push(definition);
  }

  registerModule({
    id: 'redFlag',
    create() {
      const gql = window.__twitchEnhancerGQL;
      const streamCards = window.__twitchEnhancerStreamCards;
      const tagsByLogin = new Map();
      const COLORS = window.__twitchEnhancerFlagColors;
      const CHANNEL_HEADER_SELECTOR = 'section#live-channel-stream-information';
      const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
      const ICON_PATHS = [
        {
          d: 'M0 0h14l-4 5 4 5H0z'
        }
      ];

      let settings = { enabled: true, visualMode: 'suffix', color: 'red' };
      let selectedTags = new Set();
      let raf = null;

      function collectTags(node) {
        const login = node.broadcaster?.login || node.broadcasterLogin ||
          node.userLogin || node.login || node.channel?.login || node.channel?.name;
        if (!login) {
          return;
        }
        const sources = [node.freeformTags, node.contentTags,
          node.stream?.freeformTags, node.stream?.contentTags].filter(Array.isArray);
        if (!sources.length) {
          return;
        }
        const names = new Set();
        for (const tags of sources) {
          for (const tag of tags) {
            const name = typeof tag === 'string' ? tag :
              tag?.name || tag?.localizedName || tag?.tagName || tag?.label || tag?.slug;
            if (typeof name === 'string' && name.trim()) {
              names.add(name.trim().toLowerCase());
            }
          }
        }
        const key = String(login).toLowerCase();
        const previous = tagsByLogin.get(key);
        if (!previous || previous.size !== names.size ||
          [...names].some((name) => !previous.has(name))) {
          tagsByLogin.set(key, names);
          queueAnnotate();
        }
      }

      function createFlag(className, mode) {
        const flag = mode === 'badge'
          ? streamCards.createBadge(className)
          : document.createElement('span');
        flag.className = className;
        flag.style.display = 'inline-flex';
        flag.style.alignItems = 'center';
        flag.style.flex = '0 0 auto';
        flag.style.order = '-1';
        flag.style.pointerEvents = 'none';
        if (mode === 'suffix') {
          flag.style.color = COLORS[settings.color];
        }
        const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
        svg.setAttribute('viewBox', '0 0 14 10');
        svg.style.height = mode === 'badge' ? '1em' : '1cap';
        svg.style.width = 'auto';
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
        flag.appendChild(svg);
        return flag;
      }

      function clearFlags() {
        document.querySelectorAll('.__redFlagSuffix, .__redFlagBadge, .__redFlagChannelInline')
          .forEach(streamCards.removeDecoration);
      }

      function getMatchingTags(login) {
        const tags = tagsByLogin.get(login);
        return tags ? [...tags].filter((tag) => selectedTags.has(tag)) : [];
      }

      function updateChannelHeader() {
        const section = document.querySelector(CHANNEL_HEADER_SELECTOR);
        if (!section) {
          return;
        }
        const heading = section.querySelector('h1');
        const nameLink = heading?.closest('a[href^="/"]');
        const login = nameLink ? streamCards.getLoginFromLink(nameLink) : null;
        const matches = getMatchingTags(login);
        let flag = section.querySelector('.__redFlagChannelInline');
        if (!matches.length || !heading) {
          streamCards.removeDecoration(flag);
          return;
        }

        const verifiedIcon = section.querySelector('svg[aria-label*="Verified" i]');
        const reference = section.querySelector('.__langChannelInline') ||
          (verifiedIcon ? verifiedIcon.closest('[class]') : null) || nameLink;
        if (!reference?.parentElement) {
          return;
        }
        if (!flag) {
          flag = createFlag('__redFlagChannelInline', settings.visualMode);
          flag.style.order = '0';
          flag.style.marginLeft = '0.4rem';
          flag.style.verticalAlign = 'middle';
        }
        flag.title = `Matching tags: ${matches.join(', ')}`;
        if (flag.previousSibling !== reference) {
          reference.parentElement.insertBefore(flag, reference.nextSibling);
        }
      }

      function annotate() {
        raf = null;
        if (!settings.enabled || !selectedTags.size) {
          clearFlags();
          return;
        }
        updateChannelHeader();
        const seenCards = new Set();
        document.querySelectorAll(streamCards.CHANNEL_LINK_SELECTOR).forEach((node) => {
          const card = streamCards.getCard(node);
          if (seenCards.has(card)) {
            return;
          }
          seenCards.add(card);
          const matches = getMatchingTags(streamCards.getLoginFromLink(node));
          let flag = card.querySelector('.__redFlagSuffix, .__redFlagBadge');
          if (!matches.length) {
            card.querySelectorAll('.__redFlagSuffix, .__redFlagBadge')
              .forEach(streamCards.removeDecoration);
            return;
          }
          const stack = settings.visualMode === 'badge'
            ? streamCards.getBadgeStack(card) : streamCards.getSuffixStack(node).stack;
          if (!flag) {
            flag = createFlag(
              settings.visualMode === 'badge' ? '__redFlagBadge' : '__redFlagSuffix',
              settings.visualMode
            );
          }
          const description = `Matching tags: ${matches.join(', ')}`;
          flag.title = description;
          if (flag.parentElement !== stack) {
            stack.appendChild(flag);
          }
        });
      }

      function queueAnnotate() {
        if (!settings.enabled || !selectedTags.size) {
          return;
        }
        if (raf === null) {
          raf = requestAnimationFrame(annotate);
        }
      }

      const observer = new MutationObserver((mutations) => {
        const selector = `${streamCards.CHANNEL_LINK_SELECTOR}, ${CHANNEL_HEADER_SELECTOR}, h1, .__langChannelInline`;
        if (mutations.some((mutation) => {
          if (mutation.type === 'attributes') {
            return mutation.target.matches(streamCards.ANY_LINK_SELECTOR) ||
              Boolean(mutation.target.closest(CHANNEL_HEADER_SELECTOR));
          }
          if ([...mutation.removedNodes].some((node) =>
            node.nodeType === Node.ELEMENT_NODE && node.matches('.__langChannelInline'))) {
            return true;
          }
          return [...mutation.addedNodes].some((node) =>
            node.nodeType === Node.ELEMENT_NODE &&
            (node.matches(selector) || node.querySelector(selector)));
        })) {
          queueAnnotate();
        }
      });
      gql.subscribeNodes(collectTags);
      function start() {
        observer.observe(document.documentElement, {
          childList: true, subtree: true, attributes: true, attributeFilter: ['href']
        });
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
            enabled: nextSettings.enabled !== false,
            visualMode: nextSettings.visualMode === 'badge' ? 'badge' : 'suffix',
            color: Object.hasOwn(COLORS, nextSettings.color) ? nextSettings.color : 'red'
          };
          selectedTags = new Set((Array.isArray(nextSettings.tags) ? nextSettings.tags : [])
            .filter((tag) => typeof tag === 'string')
            .map((tag) => tag.trim().toLowerCase()).filter(Boolean));
          clearFlags();
          queueAnnotate();
        }
      };
    }
  });
})();
