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
    blockAnnoyances: {
      enabled: false,
      autoPausePromotedStreams: true,
      consentBanner: true,
      newsFromLuna: true,
      bitsButton: true,
      storiesLeftPanel: true,
      chatLeaderboardAndGoals: true,
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
  const current = await browser.storage.sync.get(DEFAULT_SETTINGS);
  const modules = current.modules || {};

  await browser.storage.sync.set({
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

browser.runtime.onInstalled.addListener(() => {
  ensureDefaults().catch((error) => {
    console.warn('Failed to initialize Twitch Enhancer settings:', error);
  });
});

browser.action.onClicked.addListener(async (tab) => {
  if (!tab || tab.id == null) {
    return;
  }

  try {
    await browser.tabs.sendMessage(tab.id, {
      type: 'run-toggle-video-quality'
    });
  } catch (error) {
    console.warn('Failed to send toggle command to tab:', error);
  }
});

browser.runtime.onMessage.addListener((message, sender) => {
  if (!message || message.type !== 'set-tab-muted') {
    return false;
  }

  const tabId = sender.tab && sender.tab.id;
  if (tabId == null) {
    return Promise.resolve({ ok: false });
  }

  return browser.tabs.update(tabId, { muted: Boolean(message.muted) })
    .then(() => ({ ok: true }))
    .catch((error) => ({ ok: false, error: String(error) }));
});
