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
      autoPausePromotedStreams: true,
      consentBanner: true,
      newsFromLuna: true,
      bitsButton: true,
      goAdFreeButton: true,
      storiesLeftPanel: true,
      chatLeaderboardAndGoals: true,
      stickyCommunityHighlight: true,
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

async function ensureDefaults() {
  const current = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  const modules = current.modules || {};

  await chrome.storage.sync.set({
    modules: {
      toggleVideoQuality: {
        ...DEFAULT_SETTINGS.modules.toggleVideoQuality,
        ...(modules.toggleVideoQuality || {})
      },
      autoClaimBonus: {
        ...DEFAULT_SETTINGS.modules.autoClaimBonus,
        ...(modules.autoClaimBonus || {})
      },
      keepTabActive: {
        ...DEFAULT_SETTINGS.modules.keepTabActive,
        ...(modules.keepTabActive || {})
      },
      chatReplyPreview: {
        ...DEFAULT_SETTINGS.modules.chatReplyPreview,
        ...(modules.chatReplyPreview || {})
      },
      blockAnnoyances: {
        ...DEFAULT_SETTINGS.modules.blockAnnoyances,
        ...(modules.blockAnnoyances || {})
      },
      showStreamLanguage: {
        ...DEFAULT_SETTINGS.modules.showStreamLanguage,
        ...(modules.showStreamLanguage || {})
      },
      forceSortViewers: {
        ...DEFAULT_SETTINGS.modules.forceSortViewers,
        ...(modules.forceSortViewers || {})
      }
    }
  });
}

chrome.runtime.onInstalled.addListener(() => {
  ensureDefaults().catch((error) => {
    console.warn('Failed to initialize Twitch Enhancer settings:', error);
  });
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || tab.id == null) {
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, {
      type: 'run-toggle-video-quality'
    });
  } catch (error) {
    console.warn('Failed to send toggle command to tab:', error);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'set-tab-muted') {
    return false;
  }

  const tabId = sender.tab && sender.tab.id;
  if (tabId == null) {
    sendResponse({ ok: false });
    return false;
  }

  chrome.tabs.update(tabId, { muted: Boolean(message.muted) }, () => {
    const error = chrome.runtime.lastError;
    if (error) {
      sendResponse({ ok: false, error: error.message });
      return;
    }

    sendResponse({ ok: true });
  });

  return true;
});
