(function () {
  'use strict';

  if (window.__twitchEnhancerStreamCards) {
    return;
  }

  const CHANNEL_LINK_SELECTOR = [
    'p[data-a-target="preview-card-channel-link"]',
    'p[data-test-selector="TitleAndChannel__channelLink"]',
    'a[data-a-target="preview-card-channel-link"]',
    'a[data-test-selector="preview-card-channel-link"]',
    'a[data-test-selector="TitleAndChannel__channelLink"]'
  ].join(',');
  const ANY_LINK_SELECTOR = [
    'a[data-a-target="preview-card-title-link"]',
    'a[data-a-target="preview-card-channel-link"]',
    'a[data-test-selector="preview-card-title-link"]',
    'a[data-test-selector="preview-card-channel-link"]',
    'a[data-test-selector="TitleAndChannel__titleLink"]',
    'a[data-test-selector="TitleAndChannel__channelLink"]'
  ].join(',');
  const CARD_SELECTOR = 'article,[data-target="directory-first-item"]';
  const BADGE_STACK_CLASS = '__streamCardBadgeStack';
  const SUFFIX_STACK_CLASS = '__streamCardSuffixStack';

  function getLoginFromLink(node) {
    const anchor = node.tagName === 'A' ? node : node.closest('a[href^="/"]');
    if (!anchor) {
      return null;
    }

    const match = (anchor.getAttribute('href') || '').match(
      /^\/([a-zA-Z0-9_]+)(?:\/|$)/
    );
    return match ? match[1].toLowerCase() : null;
  }

  function getCard(node) {
    return node.closest(CARD_SELECTOR) || node.closest('div') || node;
  }

  function getCardAndRow(node) {
    const card = getCard(node);
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

  function getThumbnail(card) {
    return (
      card.querySelector('[data-a-target="preview-card-image-link"]') ||
      card.querySelector('[data-a-target="preview-card-thumbnail"]') ||
      card.querySelector('figure') ||
      card
    );
  }

  function alignBadgeStack(thumb, stack) {
    const liveBadge = thumb.querySelector(
      '[class*="tw-channel-status-text-indicator"]'
    );
    if (!liveBadge) {
      return;
    }

    const thumbRect = thumb.getBoundingClientRect();
    const liveBadgeRect = liveBadge.getBoundingClientRect();
    const scaleY = thumb.offsetHeight ? thumbRect.height / thumb.offsetHeight : 1;
    if (scaleY > 0) {
      stack.style.top = `${(liveBadgeRect.top - thumbRect.top) / scaleY}px`;
    }
  }

  function getBadgeStack(card) {
    const thumb = getThumbnail(card);
    if (getComputedStyle(thumb).position === 'static') {
      thumb.style.position = 'relative';
    }

    let stack = thumb.querySelector(`:scope > .${BADGE_STACK_CLASS}`);
    if (!stack) {
      stack = document.createElement('div');
      stack.className = BADGE_STACK_CLASS;
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

    alignBadgeStack(thumb, stack);
    return stack;
  }

  function getSuffixStack(node) {
    const { card, row } = getCardAndRow(node);
    let stack = row.querySelector(`:scope > .${SUFFIX_STACK_CLASS}`);
    if (!stack) {
      stack = document.createElement('div');
      stack.className = SUFFIX_STACK_CLASS;
      stack.style.display = 'inline-flex';
      stack.style.alignItems = 'center';
      stack.style.gap = '0.4rem';
      stack.style.marginLeft = 'auto';
      stack.style.whiteSpace = 'nowrap';
      stack.style.pointerEvents = 'none';
      row.appendChild(stack);
    }

    return { card, row, stack };
  }

  function createBadge(className) {
    const badge = document.createElement('div');
    badge.className = className;
    badge.style.boxSizing = 'content-box';
    badge.style.height = '16px';
    badge.style.padding = '2px 6px';
    badge.style.borderRadius = '4px';
    badge.style.fontSize = '12px';
    badge.style.fontWeight = '700';
    badge.style.lineHeight = '16px';
    badge.style.background = 'rgb(235,4,0)';
    badge.style.color = '#fff';
    badge.style.pointerEvents = 'none';
    return badge;
  }

  function removeDecoration(element) {
    if (!element) {
      return;
    }

    const parent = element.parentElement;
    element.remove();
    if (
      parent &&
      !parent.children.length &&
      (parent.classList.contains(BADGE_STACK_CLASS) ||
        parent.classList.contains(SUFFIX_STACK_CLASS))
    ) {
      parent.remove();
    }
  }

  window.__twitchEnhancerStreamCards = {
    ANY_LINK_SELECTOR,
    CHANNEL_LINK_SELECTOR,
    createBadge,
    getBadgeStack,
    getCard,
    getCardAndRow,
    getLoginFromLink,
    getSuffixStack,
    removeDecoration
  };
})();
