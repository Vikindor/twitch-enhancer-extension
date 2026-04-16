const DEFAULT_SETTINGS = {
  modules: {
    toggleVideoQuality: {
      enabled: true,
      preferredHigh: 1080,
      muteOnLow: true,
      muteTarget: 'tab',
      persistSelection: true,
      forceUnmuteBothOnHigh: false
    },
    forceSortViewers: {
      enabled: true,
      runPolicy: 'perLoad'
    },
    showStreamLanguage: {
      enabled: true,
      visualMode: 'suffix'
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
      forceSortViewers: {
        ...DEFAULT_SETTINGS.modules.forceSortViewers,
        ...(modules.forceSortViewers || {})
      },
      showStreamLanguage: {
        ...DEFAULT_SETTINGS.modules.showStreamLanguage,
        ...(modules.showStreamLanguage || {})
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
