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
      footer: true,
      storiesLeftPanel: true,
      saveYourStreakLeftPanel: true,
      chatLeaderboardAndGoals: true,
      stickyCommunityHighlight: true,
      chatInputNotices: false,
      chatBitsBalance: true,
      allPlayerExtensions: false,
      extensionsDockButtons: false,
      primeBenefitsExtension: true,
      underPlayerBitsButton: true,
      giftSubsButton: true,
      subscribeButton: true,
      continueSubButton: true,
      subscriptionOfferBanner: true,
      channelAboutSection: false
    },
    showStreamLanguage: {
      enabled: true,
      visualMode: 'suffix'
    },
    showDropsIndicator: {
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
  const storedModules = current.modules || {};

  await chrome.storage.sync.set({
    modules: mergeModuleSettings(storedModules)
  });
}

function mergeModuleSettings(storedModules) {
  return Object.fromEntries(
    Object.entries(DEFAULT_SETTINGS.modules).map(
      ([moduleId, defaultModuleSettings]) => [
        moduleId,
        {
          ...defaultModuleSettings,
          ...(storedModules[moduleId] || {})
        }
      ]
    )
  );
}

function handleInstalled() {
  ensureDefaults().catch((error) => {
    console.warn('Failed to initialize Twitch Enhancer settings:', error);
  });
}

async function handleActionClicked(tab) {
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
}

function handleMessage(message, sender, sendResponse) {
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
}

chrome.runtime.onInstalled.addListener(handleInstalled);
chrome.action.onClicked.addListener(handleActionClicked);
chrome.runtime.onMessage.addListener(handleMessage);
