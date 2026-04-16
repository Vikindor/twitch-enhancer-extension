const DEFAULT_SETTINGS = {
  preferredHigh: 1080,
  muteOnLow: true,
  muteTarget: 'tab',
  persistSelection: true,
  forceUnmuteBothOnHigh: false
};

async function getSettings() {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);

  const preferredHigh =
    typeof stored.preferredHigh === 'number' && Number.isFinite(stored.preferredHigh)
      ? stored.preferredHigh
      : null;

  const muteOnLow =
    typeof stored.muteOnLow === 'boolean'
      ? stored.muteOnLow
      : Boolean(stored.willMute);

  return {
    preferredHigh,
    muteOnLow,
    muteTarget: stored.muteTarget === 'video' ? 'video' : 'tab',
    persistSelection: typeof stored.persistSelection === 'boolean' ? stored.persistSelection : true,
    forceUnmuteBothOnHigh:
      typeof stored.forceUnmuteBothOnHigh === 'boolean' ? stored.forceUnmuteBothOnHigh : false
  };
}

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  await chrome.storage.sync.set({
    preferredHigh:
      typeof current.preferredHigh === 'number' && Number.isFinite(current.preferredHigh)
        ? current.preferredHigh
        : 1080,
    muteOnLow:
      typeof current.muteOnLow === 'boolean'
        ? current.muteOnLow
        : Boolean(current.willMute),
    muteTarget: current.muteTarget === 'video' ? 'video' : 'tab',
    persistSelection: typeof current.persistSelection === 'boolean' ? current.persistSelection : true,
    forceUnmuteBothOnHigh:
      typeof current.forceUnmuteBothOnHigh === 'boolean' ? current.forceUnmuteBothOnHigh : false
  });
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || tab.id == null) {
    return;
  }

  const settings = await getSettings();

  try {
    await chrome.tabs.sendMessage(tab.id, {
      type: 'toggle-quality',
      settings
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
