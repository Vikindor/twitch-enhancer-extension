const api = globalThis.browser ?? globalThis.chrome;

const DEFAULT_SETTINGS = {
  modules: {
    toggleVideoQuality: {
      enabled: true,
      preferredHigh: 1080,
      muteOnLow: true,
      muteTarget: 'tab',
      persistSelection: true,
      forceUnmuteBothOnHigh: true
    },
    forceSortViewers: {
      enabled: true,
      runPolicy: 'perLoad'
    },
    showStreamLanguage: {
      enabled: true,
      visualMode: 'suffix'
    },
    keepTabActive: {
      enabled: true,
      requestWakeLock: false,
      autoRecoverOverlays: true
    }
  }
};

function storageGet(defaults) {
  return Promise.resolve(api.storage.sync.get(defaults)).catch(() => defaults);
}

function storageSet(value) {
  return Promise.resolve(api.storage.sync.set(value));
}

function setModuleDisabledState(moduleName, enabled) {
  const container = document.querySelector(`[data-module-settings="${moduleName}"]`);
  if (!container) return;

  container.dataset.disabled = enabled ? 'false' : 'true';
  container.querySelectorAll('input, select').forEach((element) => {
    element.disabled = !enabled;
  });
}

async function loadOptions() {
  const settings = await storageGet(DEFAULT_SETTINGS);
  const modules = settings.modules || DEFAULT_SETTINGS.modules;

  const toggle = modules.toggleVideoQuality || DEFAULT_SETTINGS.modules.toggleVideoQuality;
  document.getElementById('toggle-enabled').checked = toggle.enabled !== false;
  document.getElementById('toggle-preferredHigh').value =
    typeof toggle.preferredHigh === 'number' && Number.isFinite(toggle.preferredHigh)
      ? String(toggle.preferredHigh)
      : '';
  document.getElementById('toggle-muteOnLow').checked = toggle.muteOnLow !== false;
  document.getElementById('toggle-muteTarget').value = toggle.muteTarget === 'video' ? 'video' : 'tab';
  document.getElementById('toggle-persistSelection').checked = toggle.persistSelection !== false;
  document.getElementById('toggle-forceUnmuteBothOnHigh').checked = toggle.forceUnmuteBothOnHigh === true;
  setModuleDisabledState('toggleVideoQuality', toggle.enabled !== false);

  const sort = modules.forceSortViewers || DEFAULT_SETTINGS.modules.forceSortViewers;
  document.getElementById('sort-enabled').checked = sort.enabled !== false;
  document.getElementById('sort-runPolicy').value = sort.runPolicy === 'perTab' ? 'perTab' : 'perLoad';
  setModuleDisabledState('forceSortViewers', sort.enabled !== false);

  const language = modules.showStreamLanguage || DEFAULT_SETTINGS.modules.showStreamLanguage;
  document.getElementById('language-enabled').checked = language.enabled !== false;
  document.getElementById('language-visualMode').value = language.visualMode === 'badge' ? 'badge' : 'suffix';
  setModuleDisabledState('showStreamLanguage', language.enabled !== false);

  const keepActive = modules.keepTabActive || DEFAULT_SETTINGS.modules.keepTabActive;
  document.getElementById('keep-enabled').checked = keepActive.enabled === true;
  document.getElementById('keep-requestWakeLock').checked = keepActive.requestWakeLock !== false;
  document.getElementById('keep-autoRecoverOverlays').checked = keepActive.autoRecoverOverlays !== false;
  setModuleDisabledState('keepTabActive', keepActive.enabled === true);
}

async function saveOptions() {
  const preferredHighValue = document.getElementById('toggle-preferredHigh').value.trim();
  const preferredHigh = preferredHighValue === '' ? null : Number.parseInt(preferredHighValue, 10);

  await storageSet({
    modules: {
      toggleVideoQuality: {
        enabled: document.getElementById('toggle-enabled').checked,
        preferredHigh: Number.isFinite(preferredHigh) ? preferredHigh : null,
        muteOnLow: document.getElementById('toggle-muteOnLow').checked,
        muteTarget: document.getElementById('toggle-muteTarget').value === 'video' ? 'video' : 'tab',
        persistSelection: document.getElementById('toggle-persistSelection').checked,
        forceUnmuteBothOnHigh: document.getElementById('toggle-forceUnmuteBothOnHigh').checked
      },
      forceSortViewers: {
        enabled: document.getElementById('sort-enabled').checked,
        runPolicy: document.getElementById('sort-runPolicy').value === 'perTab' ? 'perTab' : 'perLoad'
      },
      showStreamLanguage: {
        enabled: document.getElementById('language-enabled').checked,
        visualMode: document.getElementById('language-visualMode').value === 'badge' ? 'badge' : 'suffix'
      },
      keepTabActive: {
        enabled: document.getElementById('keep-enabled').checked,
        requestWakeLock: document.getElementById('keep-requestWakeLock').checked,
        autoRecoverOverlays: document.getElementById('keep-autoRecoverOverlays').checked
      }
    }
  });

  const status = document.getElementById('status');
  status.textContent = 'Saved';
  setTimeout(() => {
    status.textContent = '';
  }, 1500);
}

document.addEventListener('DOMContentLoaded', () => {
  loadOptions();

  document.getElementById('toggle-enabled').addEventListener('change', (event) => {
    setModuleDisabledState('toggleVideoQuality', event.target.checked);
  });
  document.getElementById('sort-enabled').addEventListener('change', (event) => {
    setModuleDisabledState('forceSortViewers', event.target.checked);
  });
  document.getElementById('language-enabled').addEventListener('change', (event) => {
    setModuleDisabledState('showStreamLanguage', event.target.checked);
  });
  document.getElementById('keep-enabled').addEventListener('change', (event) => {
    setModuleDisabledState('keepTabActive', event.target.checked);
  });

  document.getElementById('save').addEventListener('click', saveOptions);
});

