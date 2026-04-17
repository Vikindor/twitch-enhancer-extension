const api = globalThis.browser ?? globalThis.chrome;

const DEFAULT_SETTINGS = {
  modules: {
    toggleVideoQuality: {
      enabled: true,
      preferredHigh: 1080,
      preferHighestBitrateMatch: true,
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
    autoClaimBonus: {
      enabled: true,
      intervalSeconds: 15
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

function setAppVersion() {
  const versionNode = document.getElementById('app-version');
  if (!versionNode) return;

  const manifest = typeof api.runtime?.getManifest === 'function'
    ? api.runtime.getManifest()
    : null;

  versionNode.textContent = manifest?.version ? `v${manifest.version}` : 'Version';
}

function sanitizeDigitsInput(value, maxLength = Infinity) {
  return String(value).replace(/\D+/g, '').slice(0, maxLength);
}

function normalizeClaimIntervalInput(value) {
  if (value === '') {
    return 15;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return 15;
  }

  if (parsed < 5) {
    return 5;
  }

  return parsed;
}

function normalizePreferredHighInput(value) {
  if (value === '') {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return 1080;
  }

  if (parsed < 160) {
    return 160;
  }

  return parsed;
}

function setModuleDisabledState(moduleName, enabled) {
  const container = document.querySelector(`[data-module-settings="${moduleName}"]`);
  if (!container) return;

  container.dataset.disabled = enabled ? 'false' : 'true';
  container.querySelectorAll('input, select').forEach((element) => {
    element.disabled = !enabled;
  });
}

function syncToggleMuteDependencies() {
  const muteOnLow = document.getElementById('toggle-muteOnLow');
  const muteTarget = document.getElementById('toggle-muteTarget');
  const muteTargetField = document.getElementById('toggle-muteTarget-field');

  if (!muteOnLow || !muteTarget || !muteTargetField) return;

  const toggleModuleEnabled = document.getElementById('toggle-enabled')?.checked !== false;
  const enabled = toggleModuleEnabled && muteOnLow.checked;
  muteTarget.disabled = !enabled;
  muteTargetField.dataset.disabled = enabled ? 'false' : 'true';
}

function setSelectOpenState(select, isOpen) {
  select.classList.toggle('is-open', isOpen);
}

function closeAllSelects(except = null) {
  document.querySelectorAll('select.is-open').forEach((select) => {
    if (select !== except) {
      setSelectOpenState(select, false);
    }
  });
}

function initSelectOpenState() {
  const selects = Array.from(document.querySelectorAll('select'));

  document.addEventListener('pointerdown', (event) => {
    const targetSelect = event.target.closest('select');
    closeAllSelects(targetSelect);
  }, true);

  selects.forEach((select) => {
    select.addEventListener('pointerdown', () => {
      const willOpen = !select.classList.contains('is-open');
      setSelectOpenState(select, willOpen);
    });

    select.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' || event.key === 'Tab') {
        setSelectOpenState(select, false);
        return;
      }

      if (
        event.key === 'ArrowDown' ||
        event.key === 'ArrowUp' ||
        event.key === 'Enter' ||
        event.key === ' '
      ) {
        setSelectOpenState(select, true);
      }
    });

    select.addEventListener('change', () => {
      setSelectOpenState(select, false);
    });

    select.addEventListener('blur', () => {
      setSelectOpenState(select, false);
    });
  });
}

async function loadOptions() {
  const settings = await storageGet(DEFAULT_SETTINGS);
  const modules = settings.modules || DEFAULT_SETTINGS.modules;

  const toggle = modules.toggleVideoQuality || DEFAULT_SETTINGS.modules.toggleVideoQuality;
  document.getElementById('toggle-enabled').checked = toggle.enabled !== false;
  const preferredHighInput = document.getElementById('toggle-preferredHigh');
  preferredHighInput.value =
    typeof toggle.preferredHigh === 'number' && Number.isFinite(toggle.preferredHigh)
      ? String(normalizePreferredHighInput(sanitizeDigitsInput(String(toggle.preferredHigh), 4)) ?? '')
      : '';
  document.getElementById('toggle-muteOnLow').checked = toggle.muteOnLow !== false;
  document.getElementById('toggle-muteTarget').value = toggle.muteTarget === 'video' ? 'video' : 'tab';
  document.getElementById('toggle-persistSelection').checked = toggle.persistSelection !== false;
  document.getElementById('toggle-preferHighestBitrateMatch').checked =
    toggle.preferHighestBitrateMatch !== false;
  document.getElementById('toggle-forceUnmuteBothOnHigh').checked = toggle.forceUnmuteBothOnHigh === true;
  setModuleDisabledState('toggleVideoQuality', toggle.enabled !== false);
  syncToggleMuteDependencies();

  const sort = modules.forceSortViewers || DEFAULT_SETTINGS.modules.forceSortViewers;
  document.getElementById('sort-enabled').checked = sort.enabled !== false;
  document.getElementById('sort-runPolicy').value = sort.runPolicy === 'perTab' ? 'perTab' : 'perLoad';
  setModuleDisabledState('forceSortViewers', sort.enabled !== false);

  const language = modules.showStreamLanguage || DEFAULT_SETTINGS.modules.showStreamLanguage;
  document.getElementById('language-enabled').checked = language.enabled !== false;
  document.getElementById('language-visualMode').value = language.visualMode === 'badge' ? 'badge' : 'suffix';
  setModuleDisabledState('showStreamLanguage', language.enabled !== false);

  const autoClaim = modules.autoClaimBonus || DEFAULT_SETTINGS.modules.autoClaimBonus;
  document.getElementById('claim-enabled').checked = autoClaim.enabled !== false;
  document.getElementById('claim-intervalSeconds').value =
    typeof autoClaim.intervalSeconds === 'number' && Number.isFinite(autoClaim.intervalSeconds)
      ? String(normalizeClaimIntervalInput(sanitizeDigitsInput(String(autoClaim.intervalSeconds), 3)))
      : '15';
  setModuleDisabledState('autoClaimBonus', autoClaim.enabled !== false);

  const keepActive = modules.keepTabActive || DEFAULT_SETTINGS.modules.keepTabActive;
  document.getElementById('keep-enabled').checked = keepActive.enabled === true;
  document.getElementById('keep-requestWakeLock').checked = keepActive.requestWakeLock !== false;
  document.getElementById('keep-autoRecoverOverlays').checked = keepActive.autoRecoverOverlays !== false;
  setModuleDisabledState('keepTabActive', keepActive.enabled === true);
}

async function saveOptions() {
  const preferredHighValue = sanitizeDigitsInput(
    document.getElementById('toggle-preferredHigh').value.trim(),
    4
  );
  const preferredHigh = normalizePreferredHighInput(preferredHighValue);
  const claimIntervalValue = sanitizeDigitsInput(
    document.getElementById('claim-intervalSeconds').value.trim(),
    3
  );
  const claimInterval = normalizeClaimIntervalInput(claimIntervalValue);

  await storageSet({
    modules: {
      toggleVideoQuality: {
        enabled: document.getElementById('toggle-enabled').checked,
        preferredHigh: Number.isFinite(preferredHigh) ? preferredHigh : null,
        preferHighestBitrateMatch: document.getElementById('toggle-preferHighestBitrateMatch').checked,
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
      autoClaimBonus: {
        enabled: document.getElementById('claim-enabled').checked,
        intervalSeconds: claimInterval
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
  setAppVersion();
  initSelectOpenState();
  loadOptions();

  const claimIntervalInput = document.getElementById('claim-intervalSeconds');
  if (claimIntervalInput) {
    claimIntervalInput.addEventListener('input', () => {
      claimIntervalInput.value = sanitizeDigitsInput(claimIntervalInput.value, 3);
    });

    claimIntervalInput.addEventListener('blur', () => {
      claimIntervalInput.value = String(normalizeClaimIntervalInput(
        sanitizeDigitsInput(claimIntervalInput.value, 3)
      ));
    });
  }

  const preferredHighInput = document.getElementById('toggle-preferredHigh');
  if (preferredHighInput) {
    preferredHighInput.addEventListener('input', () => {
      preferredHighInput.value = sanitizeDigitsInput(preferredHighInput.value, 4);
    });

    preferredHighInput.addEventListener('blur', () => {
      preferredHighInput.value = String(normalizePreferredHighInput(
        sanitizeDigitsInput(preferredHighInput.value, 4)
      ) ?? '');
    });
  }

  document.getElementById('toggle-enabled').addEventListener('change', (event) => {
    setModuleDisabledState('toggleVideoQuality', event.target.checked);
    syncToggleMuteDependencies();
  });
  document.getElementById('toggle-muteOnLow').addEventListener('change', syncToggleMuteDependencies);
  document.getElementById('sort-enabled').addEventListener('change', (event) => {
    setModuleDisabledState('forceSortViewers', event.target.checked);
  });
  document.getElementById('language-enabled').addEventListener('change', (event) => {
    setModuleDisabledState('showStreamLanguage', event.target.checked);
  });
  document.getElementById('claim-enabled').addEventListener('change', (event) => {
    setModuleDisabledState('autoClaimBonus', event.target.checked);
  });
  document.getElementById('keep-enabled').addEventListener('change', (event) => {
    setModuleDisabledState('keepTabActive', event.target.checked);
  });

  document.getElementById('save').addEventListener('click', async () => {
    await saveOptions();

    if (claimIntervalInput) {
      claimIntervalInput.value = String(normalizeClaimIntervalInput(
        sanitizeDigitsInput(claimIntervalInput.value, 3)
      ));
    }
  });
});
