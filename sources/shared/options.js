const DEFAULT_SETTINGS = {
  preferredHigh: 1080,
  muteOnLow: true,
  muteTarget: 'tab',
  persistSelection: true,
  forceUnmuteBothOnHigh: false
};

async function loadOptions() {
  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);

  document.getElementById('preferredHigh').value =
    typeof settings.preferredHigh === 'number' && Number.isFinite(settings.preferredHigh)
      ? String(settings.preferredHigh)
      : '';
  document.getElementById('muteOnLow').checked =
    typeof settings.muteOnLow === 'boolean'
      ? settings.muteOnLow
      : Boolean(settings.willMute);
  document.getElementById('muteTarget').value =
    settings.muteTarget === 'video' ? 'video' : 'tab';
  document.getElementById('persistSelection').checked =
    typeof settings.persistSelection === 'boolean' ? settings.persistSelection : true;
  document.getElementById('forceUnmuteBothOnHigh').checked =
    typeof settings.forceUnmuteBothOnHigh === 'boolean' ? settings.forceUnmuteBothOnHigh : false;
}

async function saveOptions() {
  const preferredHighValue = document.getElementById('preferredHigh').value.trim();
  const preferredHigh = preferredHighValue === ''
    ? null
    : Number.parseInt(preferredHighValue, 10);
  const muteOnLow = document.getElementById('muteOnLow').checked;
  const muteTarget = document.getElementById('muteTarget').value === 'video'
    ? 'video'
    : 'tab';
  const persistSelection = document.getElementById('persistSelection').checked;
  const forceUnmuteBothOnHigh = document.getElementById('forceUnmuteBothOnHigh').checked;

  await chrome.storage.sync.set({
    preferredHigh: Number.isFinite(preferredHigh) ? preferredHigh : null,
    muteOnLow,
    muteTarget,
    persistSelection,
    forceUnmuteBothOnHigh
  });

  const status = document.getElementById('status');
  status.textContent = 'Saved';
  setTimeout(() => {
    status.textContent = '';
  }, 1500);
}

document.addEventListener('DOMContentLoaded', () => {
  loadOptions();
  document.getElementById('save').addEventListener('click', saveOptions);
});
