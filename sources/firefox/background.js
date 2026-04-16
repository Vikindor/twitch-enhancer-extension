const DEFAULT_SETTINGS = {
  preferredHigh: 1080,
  muteOnLow: true,
  muteTarget: 'tab',
  persistSelection: true,
  forceUnmuteBothOnHigh: false
};

async function getSettings() {
  const stored = await browser.storage.sync.get(DEFAULT_SETTINGS);

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

browser.runtime.onInstalled.addListener(async () => {
  const current = await browser.storage.sync.get(DEFAULT_SETTINGS);
  await browser.storage.sync.set({
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

browser.action.onClicked.addListener(async (tab) => {
  if (!tab || tab.id == null) {
    return;
  }

  const settings = await getSettings();

  try {
    await browser.tabs.sendMessage(tab.id, {
      type: 'toggle-quality',
      settings
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
