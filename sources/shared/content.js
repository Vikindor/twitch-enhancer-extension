(function () {
  'use strict';

  const api = globalThis.browser ?? globalThis.chrome;
  const PAGE_SCRIPT_IDS = [
    'modules/toggle-video-quality.js',
    'modules/auto-claim-bonus.js',
    'modules/keep-tab-active.js',
    'modules/chat-reply-preview.js',
    'modules/block-annoyances.js',
    'modules/show-stream-language.js',
    'modules/force-sort-viewers.js',
    'page.js'
  ];
  const ANNOYANCE_ATTRIBUTES = {
    consentBanner: 'data-twitch-enhancer-block-consent-banner',
    newsFromLuna: 'data-twitch-enhancer-block-news-from-luna',
    bitsButton: 'data-twitch-enhancer-block-bits-button',
    goAdFreeButton: 'data-twitch-enhancer-block-go-ad-free-button',
    storiesLeftPanel: 'data-twitch-enhancer-block-stories-left-panel',
    chatLeaderboardAndGoals: 'data-twitch-enhancer-block-chat-leaderboard-and-goals',
    stickyCommunityHighlight: 'data-twitch-enhancer-block-sticky-community-highlight',
    chatBitsBalance: 'data-twitch-enhancer-block-chat-bits-balance',
    allPlayerExtensions: 'data-twitch-enhancer-block-all-player-extensions',
    extensionsDockButtons: 'data-twitch-enhancer-block-extensions-dock-buttons',
    primeBenefitsExtension: 'data-twitch-enhancer-block-prime-benefits-extension',
    underPlayerBitsButton: 'data-twitch-enhancer-block-under-player-bits-button',
    giftSubsButton: 'data-twitch-enhancer-block-gift-subs-button',
    subscribeButton: 'data-twitch-enhancer-block-subscribe-button',
    continueSubButton: 'data-twitch-enhancer-block-continue-sub-button'
  };
  const isTwitchExtensionFrame = /\.ext-twitch\.tv$/i.test(window.location.hostname);

  const DEFAULT_SETTINGS = {
    modules: {
      toggleVideoQuality: {
        enabled: true,
        muteOnLow: true,
        muteTarget: 'tab',
        persistSelection: true,
        forceUnmuteBothOnHigh: true,
        preferredHigh: null,
        preferHighestBitrateMatch: true
      },
      autoClaimBonus: {
        enabled: true,
        intervalSeconds: 15
      },
      keepTabActive: {
        enabled: true,
        autoRecoverOverlays: true,
        requestWakeLock: false
      },
      chatReplyPreview: {
        enabled: true
      },
      blockAnnoyances: {
        enabled: false,
        dismissPhoneNumberPrompt: true,
        autoPausePromotedStreams: true,
        consentBanner: true,
        newsFromLuna: true,
        bitsButton: true,
        goAdFreeButton: true,
        storiesLeftPanel: true,
        chatLeaderboardAndGoals: true,
        stickyCommunityHighlight: true,
        chatBitsBalance: true,
        allPlayerExtensions: false,
        extensionsDockButtons: false,
        primeBenefitsExtension: true,
        underPlayerBitsButton: true,
        giftSubsButton: true,
        subscribeButton: true,
        continueSubButton: true
      },
      showStreamLanguage: {
        enabled: true,
        visualMode: 'suffix'
      },
      forceSortViewers: {
        enabled: true,
        runPolicy: 'perLoad'
      }
    }
  };

  let bridgeReady = false;
  let scriptsInjected = false;
  let pageStateRequestCounter = 0;
  const bridgeWaiters = [];
  const pendingPageResponses = new Map();

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeSettings(raw) {
    const fallback = deepClone(DEFAULT_SETTINGS);
    const modules = raw && raw.modules && typeof raw.modules === 'object' ? raw.modules : {};
    const toggle = modules.toggleVideoQuality && typeof modules.toggleVideoQuality === 'object'
      ? modules.toggleVideoQuality
      : {};
    const autoClaim = modules.autoClaimBonus && typeof modules.autoClaimBonus === 'object'
      ? modules.autoClaimBonus
      : {};
    const keepActive = modules.keepTabActive && typeof modules.keepTabActive === 'object'
      ? modules.keepTabActive
      : {};
    const replyPreview = modules.chatReplyPreview && typeof modules.chatReplyPreview === 'object'
      ? modules.chatReplyPreview
      : {};
    const blockAnnoyances = modules.blockAnnoyances && typeof modules.blockAnnoyances === 'object'
      ? modules.blockAnnoyances
      : {};
    const language = modules.showStreamLanguage && typeof modules.showStreamLanguage === 'object'
      ? modules.showStreamLanguage
      : {};
    const sort = modules.forceSortViewers && typeof modules.forceSortViewers === 'object'
      ? modules.forceSortViewers
      : {};

    fallback.modules.toggleVideoQuality = {
      enabled: typeof toggle.enabled === 'boolean' ? toggle.enabled : true,
      muteOnLow: typeof toggle.muteOnLow === 'boolean' ? toggle.muteOnLow : true,
      muteTarget: toggle.muteTarget === 'video' ? 'video' : 'tab',
      persistSelection: typeof toggle.persistSelection === 'boolean' ? toggle.persistSelection : true,
      forceUnmuteBothOnHigh:
        typeof toggle.forceUnmuteBothOnHigh === 'boolean' ? toggle.forceUnmuteBothOnHigh : true,
      preferredHigh:
        typeof toggle.preferredHigh === 'number' && Number.isFinite(toggle.preferredHigh)
          ? toggle.preferredHigh
          : null,
      preferHighestBitrateMatch:
        typeof toggle.preferHighestBitrateMatch === 'boolean'
          ? toggle.preferHighestBitrateMatch
          : true
    };

    fallback.modules.autoClaimBonus = {
      enabled: typeof autoClaim.enabled === 'boolean' ? autoClaim.enabled : true,
      intervalSeconds:
        typeof autoClaim.intervalSeconds === 'number' &&
        Number.isFinite(autoClaim.intervalSeconds) &&
        autoClaim.intervalSeconds >= 5
          ? Math.round(autoClaim.intervalSeconds)
          : 15
    };

    fallback.modules.keepTabActive = {
      enabled: typeof keepActive.enabled === 'boolean' ? keepActive.enabled : true,
      autoRecoverOverlays:
        typeof keepActive.autoRecoverOverlays === 'boolean' ? keepActive.autoRecoverOverlays : true,
      requestWakeLock:
        typeof keepActive.requestWakeLock === 'boolean' ? keepActive.requestWakeLock : false
    };

    fallback.modules.chatReplyPreview = {
      enabled: typeof replyPreview.enabled === 'boolean' ? replyPreview.enabled : true
    };

    fallback.modules.blockAnnoyances = {
      enabled: typeof blockAnnoyances.enabled === 'boolean' ? blockAnnoyances.enabled : false,
      dismissPhoneNumberPrompt:
        typeof blockAnnoyances.dismissPhoneNumberPrompt === 'boolean'
          ? blockAnnoyances.dismissPhoneNumberPrompt
          : true,
      autoPausePromotedStreams:
        typeof blockAnnoyances.autoPausePromotedStreams === 'boolean'
          ? blockAnnoyances.autoPausePromotedStreams
          : true,
      consentBanner:
        typeof blockAnnoyances.consentBanner === 'boolean' ? blockAnnoyances.consentBanner : true,
      newsFromLuna:
        typeof blockAnnoyances.newsFromLuna === 'boolean' ? blockAnnoyances.newsFromLuna : true,
      bitsButton:
        typeof blockAnnoyances.bitsButton === 'boolean' ? blockAnnoyances.bitsButton : true,
      goAdFreeButton:
        typeof blockAnnoyances.goAdFreeButton === 'boolean'
          ? blockAnnoyances.goAdFreeButton
          : true,
      storiesLeftPanel:
        typeof blockAnnoyances.storiesLeftPanel === 'boolean'
          ? blockAnnoyances.storiesLeftPanel
          : true,
      chatLeaderboardAndGoals:
        typeof blockAnnoyances.chatLeaderboardAndGoals === 'boolean'
          ? blockAnnoyances.chatLeaderboardAndGoals
          : true,
      stickyCommunityHighlight:
        typeof blockAnnoyances.stickyCommunityHighlight === 'boolean'
          ? blockAnnoyances.stickyCommunityHighlight
          : true,
      chatBitsBalance:
        typeof blockAnnoyances.chatBitsBalance === 'boolean'
          ? blockAnnoyances.chatBitsBalance
          : true,
      allPlayerExtensions:
        typeof blockAnnoyances.allPlayerExtensions === 'boolean'
          ? blockAnnoyances.allPlayerExtensions
          : false,
      extensionsDockButtons:
        typeof blockAnnoyances.extensionsDockButtons === 'boolean'
          ? blockAnnoyances.extensionsDockButtons
          : false,
      primeBenefitsExtension:
        typeof blockAnnoyances.primeBenefitsExtension === 'boolean'
          ? blockAnnoyances.primeBenefitsExtension
          : true,
      underPlayerBitsButton:
        typeof blockAnnoyances.underPlayerBitsButton === 'boolean'
          ? blockAnnoyances.underPlayerBitsButton
          : true,
      giftSubsButton:
        typeof blockAnnoyances.giftSubsButton === 'boolean' ? blockAnnoyances.giftSubsButton : true,
      subscribeButton:
        typeof blockAnnoyances.subscribeButton === 'boolean' ? blockAnnoyances.subscribeButton : true,
      continueSubButton:
        typeof blockAnnoyances.continueSubButton === 'boolean'
          ? blockAnnoyances.continueSubButton
          : true
    };

    fallback.modules.showStreamLanguage = {
      enabled: typeof language.enabled === 'boolean' ? language.enabled : true,
      visualMode: language.visualMode === 'badge' ? 'badge' : 'suffix'
    };

    fallback.modules.forceSortViewers = {
      enabled: typeof sort.enabled === 'boolean' ? sort.enabled : true,
      runPolicy: sort.runPolicy === 'perTab' ? 'perTab' : 'perLoad'
    };

    return fallback;
  }

  function storageGet(defaults) {
    return Promise.resolve(api.storage.sync.get(defaults)).catch(() => defaults);
  }

  function runtimeSendMessage(message) {
    return Promise.resolve(api.runtime.sendMessage(message)).catch((error) => ({
      ok: false,
      error: String(error)
    }));
  }

  function applyAnnoyanceAttributes(settings) {
    const blockAnnoyances = settings.modules.blockAnnoyances;
    const enabled = blockAnnoyances.enabled === true;

    for (const [id, attribute] of Object.entries(ANNOYANCE_ATTRIBUTES)) {
      document.documentElement.toggleAttribute(
        attribute,
        enabled && blockAnnoyances[id] !== false
      );
    }
  }

  async function syncSettingsToFrame() {
    const stored = await storageGet(DEFAULT_SETTINGS);
    const settings = normalizeSettings(stored);
    applyAnnoyanceAttributes(settings);
  }

  if (isTwitchExtensionFrame) {
    syncSettingsToFrame().catch(() => {});

    if (api.storage && api.storage.onChanged && typeof api.storage.onChanged.addListener === 'function') {
      api.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'sync' || !changes.modules) {
          return;
        }

        syncSettingsToFrame().catch(() => {});
      });
    }

    return;
  }

  function injectPageScripts() {
    if (scriptsInjected) {
      return;
    }

    const parent = document.head || document.documentElement;
    if (!parent) {
      return;
    }

    for (const scriptPath of PAGE_SCRIPT_IDS) {
      const id = `twitch-enhancer-${scriptPath.replace(/[^a-z0-9]+/gi, '-')}`;
      if (document.getElementById(id)) {
        continue;
      }

      const script = document.createElement('script');
      script.id = id;
      script.src = api.runtime.getURL(scriptPath);
      script.async = false;
      parent.appendChild(script);
    }

    scriptsInjected = true;
  }

  function waitForBridgeReady(timeoutMs = 2000) {
    if (bridgeReady) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        const index = bridgeWaiters.indexOf(onReady);
        if (index >= 0) {
          bridgeWaiters.splice(index, 1);
        }
        resolve();
      }, timeoutMs);

      function onReady() {
        clearTimeout(timeoutId);
        resolve();
      }

      bridgeWaiters.push(onReady);
    });
  }

  function postToPage(message) {
    window.postMessage(
      {
        source: 'twitch-enhancer-content',
        ...message
      },
      window.location.origin
    );
  }

  async function syncSettingsToPage() {
    injectPageScripts();
    await waitForBridgeReady();
    const stored = await storageGet(DEFAULT_SETTINGS);
    const settings = normalizeSettings(stored);
    postToPage({ type: 'twitch-enhancer-init', settings });
  }

  window.addEventListener('message', async (event) => {
    if (event.source !== window || !event.data || event.data.source !== 'twitch-enhancer-page') {
      return;
    }

    const { data } = event;

    if (data.type === 'twitch-enhancer-page-ready') {
      bridgeReady = true;
      while (bridgeWaiters.length) {
        const resolve = bridgeWaiters.shift();
        resolve();
      }
      await syncSettingsToPage();
      return;
    }

    if (data.type === 'twitch-enhancer-set-tab-muted') {
      const response = await runtimeSendMessage({
        type: 'set-tab-muted',
        muted: Boolean(data.muted)
      });

      postToPage({
        type: 'twitch-enhancer-set-tab-muted-result',
        requestId: data.requestId,
        ok: Boolean(response && response.ok)
      });
      return;
    }

    if (data.type === 'twitch-enhancer-page-state-response') {
      const resolve = pendingPageResponses.get(data.requestId);
      if (resolve) {
        pendingPageResponses.delete(data.requestId);
        resolve(data.result || { ok: false, reason: 'no-result' });
      }
    }
  });

  injectPageScripts();

  if (api.storage && api.storage.onChanged && typeof api.storage.onChanged.addListener === 'function') {
    api.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'sync' || !changes.modules) {
        return;
      }

      syncSettingsToPage().catch(() => {});
    });
  }

  api.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== 'run-toggle-video-quality') {
      return false;
    }

    const requestId = `page-command-${Date.now()}-${++pageStateRequestCounter}`;
    pendingPageResponses.set(requestId, sendResponse);

    syncSettingsToPage()
      .then(() => {
        postToPage({
          type: 'twitch-enhancer-command',
          requestId,
          moduleId: 'toggleVideoQuality',
          command: 'toggle'
        });
      })
      .catch((error) => {
        pendingPageResponses.delete(requestId);
        sendResponse({ ok: false, reason: 'bridge-error', message: String(error) });
      });

    return true;
  });
})();
