const api = globalThis.browser ?? globalThis.chrome;

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
    return null;
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

function syncBlockAnnoyancesDependencies() {
  const moduleEnabled = document.getElementById('annoyances-enabled')?.checked !== false;
  const blockAllPlayerExtensions =
    document.getElementById('annoyances-allPlayerExtensions')?.checked === true;
  const enabled = moduleEnabled && !blockAllPlayerExtensions;

  document.querySelectorAll('[data-player-extension-setting]').forEach((field) => {
    field.dataset.disabled = enabled ? 'false' : 'true';
    field.querySelectorAll('input, select').forEach((element) => {
      element.disabled = !enabled;
    });
  });
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
  document.getElementById('toggle-muteOnLow').checked = toggle.muteOnLow !== false;
  document.getElementById('toggle-muteTarget').value = toggle.muteTarget === 'video' ? 'video' : 'tab';
  document.getElementById('toggle-persistSelection').checked = toggle.persistSelection !== false;
  document.getElementById('toggle-forceUnmuteBothOnHigh').checked = toggle.forceUnmuteBothOnHigh === true;
  const preferredHighInput = document.getElementById('toggle-preferredHigh');
  preferredHighInput.value =
    typeof toggle.preferredHigh === 'number' && Number.isFinite(toggle.preferredHigh)
      ? String(normalizePreferredHighInput(sanitizeDigitsInput(String(toggle.preferredHigh), 4)) ?? '')
      : '';
  document.getElementById('toggle-preferHighestBitrateMatch').checked =
    toggle.preferHighestBitrateMatch !== false;
  setModuleDisabledState('toggleVideoQuality', toggle.enabled !== false);
  syncToggleMuteDependencies();

  const autoClaim = modules.autoClaimBonus || DEFAULT_SETTINGS.modules.autoClaimBonus;
  document.getElementById('claim-enabled').checked = autoClaim.enabled !== false;
  document.getElementById('claim-intervalSeconds').value =
    typeof autoClaim.intervalSeconds === 'number' && Number.isFinite(autoClaim.intervalSeconds)
      ? String(normalizeClaimIntervalInput(sanitizeDigitsInput(String(autoClaim.intervalSeconds), 3)))
      : '15';
  setModuleDisabledState('autoClaimBonus', autoClaim.enabled !== false);

  const keepActive = modules.keepTabActive || DEFAULT_SETTINGS.modules.keepTabActive;
  document.getElementById('keep-enabled').checked = keepActive.enabled === true;
  document.getElementById('keep-autoRecoverOverlays').checked = keepActive.autoRecoverOverlays !== false;
  document.getElementById('keep-requestWakeLock').checked = keepActive.requestWakeLock !== false;
  setModuleDisabledState('keepTabActive', keepActive.enabled === true);

  const blockAnnoyances = modules.blockAnnoyances || DEFAULT_SETTINGS.modules.blockAnnoyances;
  document.getElementById('annoyances-enabled').checked = blockAnnoyances.enabled === true;
  document.getElementById('annoyances-autoPausePromotedStreams').checked =
    blockAnnoyances.autoPausePromotedStreams !== false;
  document.getElementById('annoyances-consentBanner').checked = blockAnnoyances.consentBanner !== false;
  document.getElementById('annoyances-newsFromLuna').checked = blockAnnoyances.newsFromLuna !== false;
  document.getElementById('annoyances-bitsButton').checked = blockAnnoyances.bitsButton !== false;
  document.getElementById('annoyances-storiesLeftPanel').checked =
    blockAnnoyances.storiesLeftPanel !== false;
  document.getElementById('annoyances-chatLeaderboardAndGoals').checked =
    blockAnnoyances.chatLeaderboardAndGoals !== false;
  document.getElementById('annoyances-allPlayerExtensions').checked =
    blockAnnoyances.allPlayerExtensions === true;
  document.getElementById('annoyances-extensionsDockButtons').checked =
    blockAnnoyances.extensionsDockButtons === true;
  document.getElementById('annoyances-primeBenefitsExtension').checked =
    blockAnnoyances.primeBenefitsExtension !== false;
  document.getElementById('annoyances-underPlayerBitsButton').checked =
    blockAnnoyances.underPlayerBitsButton !== false;
  document.getElementById('annoyances-giftSubsButton').checked = blockAnnoyances.giftSubsButton !== false;
  document.getElementById('annoyances-subscribeButton').checked = blockAnnoyances.subscribeButton !== false;
  document.getElementById('annoyances-continueSubButton').checked =
    blockAnnoyances.continueSubButton !== false;
  setModuleDisabledState('blockAnnoyances', blockAnnoyances.enabled === true);
  syncBlockAnnoyancesDependencies();

  const language = modules.showStreamLanguage || DEFAULT_SETTINGS.modules.showStreamLanguage;
  document.getElementById('language-enabled').checked = language.enabled !== false;
  document.getElementById('language-visualMode').value = language.visualMode === 'badge' ? 'badge' : 'suffix';
  setModuleDisabledState('showStreamLanguage', language.enabled !== false);

  const sort = modules.forceSortViewers || DEFAULT_SETTINGS.modules.forceSortViewers;
  document.getElementById('sort-enabled').checked = sort.enabled !== false;
  document.getElementById('sort-runPolicy').value = sort.runPolicy === 'perTab' ? 'perTab' : 'perLoad';
  setModuleDisabledState('forceSortViewers', sort.enabled !== false);
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
        muteOnLow: document.getElementById('toggle-muteOnLow').checked,
        muteTarget: document.getElementById('toggle-muteTarget').value === 'video' ? 'video' : 'tab',
        persistSelection: document.getElementById('toggle-persistSelection').checked,
        forceUnmuteBothOnHigh: document.getElementById('toggle-forceUnmuteBothOnHigh').checked,
        preferredHigh: Number.isFinite(preferredHigh) ? preferredHigh : null,
        preferHighestBitrateMatch: document.getElementById('toggle-preferHighestBitrateMatch').checked
      },
      autoClaimBonus: {
        enabled: document.getElementById('claim-enabled').checked,
        intervalSeconds: claimInterval
      },
      keepTabActive: {
        enabled: document.getElementById('keep-enabled').checked,
        autoRecoverOverlays: document.getElementById('keep-autoRecoverOverlays').checked,
        requestWakeLock: document.getElementById('keep-requestWakeLock').checked
      },
      blockAnnoyances: {
        enabled: document.getElementById('annoyances-enabled').checked,
        autoPausePromotedStreams:
          document.getElementById('annoyances-autoPausePromotedStreams').checked,
        consentBanner: document.getElementById('annoyances-consentBanner').checked,
        newsFromLuna: document.getElementById('annoyances-newsFromLuna').checked,
        bitsButton: document.getElementById('annoyances-bitsButton').checked,
        storiesLeftPanel: document.getElementById('annoyances-storiesLeftPanel').checked,
        chatLeaderboardAndGoals:
          document.getElementById('annoyances-chatLeaderboardAndGoals').checked,
        allPlayerExtensions: document.getElementById('annoyances-allPlayerExtensions').checked,
        extensionsDockButtons:
          document.getElementById('annoyances-extensionsDockButtons').checked,
        primeBenefitsExtension:
          document.getElementById('annoyances-primeBenefitsExtension').checked,
        underPlayerBitsButton: document.getElementById('annoyances-underPlayerBitsButton').checked,
        giftSubsButton: document.getElementById('annoyances-giftSubsButton').checked,
        subscribeButton: document.getElementById('annoyances-subscribeButton').checked,
        continueSubButton: document.getElementById('annoyances-continueSubButton').checked
      },
      showStreamLanguage: {
        enabled: document.getElementById('language-enabled').checked,
        visualMode: document.getElementById('language-visualMode').value === 'badge' ? 'badge' : 'suffix'
      },
      forceSortViewers: {
        enabled: document.getElementById('sort-enabled').checked,
        runPolicy: document.getElementById('sort-runPolicy').value === 'perTab' ? 'perTab' : 'perLoad'
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

  document.getElementById('claim-enabled').addEventListener('change', (event) => {
    setModuleDisabledState('autoClaimBonus', event.target.checked);
  });
  document.getElementById('keep-enabled').addEventListener('change', (event) => {
    setModuleDisabledState('keepTabActive', event.target.checked);
  });
  document.getElementById('annoyances-enabled').addEventListener('change', (event) => {
    setModuleDisabledState('blockAnnoyances', event.target.checked);
    syncBlockAnnoyancesDependencies();
  });
  document.getElementById('annoyances-allPlayerExtensions').addEventListener(
    'change',
    syncBlockAnnoyancesDependencies
  );
  document.getElementById('language-enabled').addEventListener('change', (event) => {
    setModuleDisabledState('showStreamLanguage', event.target.checked);
  });
  document.getElementById('sort-enabled').addEventListener('change', (event) => {
    setModuleDisabledState('forceSortViewers', event.target.checked);
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
