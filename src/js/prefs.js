const SYNCED_PREF_KEYS = [
  "themeMode",
  "reverseSearchColors",
  "colorTheme",
  "backgroundDim",
  "googleAppsHidden",
  "googleAppOrder",
  "googleApp_gmailHidden",
  "googleApp_driveHidden",
  "googleApp_meetHidden",
  "googleApp_calendarHidden",
  "googleApp_photosHidden",
  "googleApp_mapsHidden",
  "googleApp_docsHidden",
  "googleApp_slidesHidden",
  "googleApp_sheetsHidden",
  "googleApp_keepHidden",
  "googleApp_geminiHidden",
];

function getPrefSync(key, fallback) {
  const value = localStorage.getItem(key);
  return value === null ? fallback : value;
}

function setPrefLocal(key, value) {
  localStorage.setItem(key, value);
}

async function setPref(key, value) {
  setPrefLocal(key, value);
  try {
    await chrome.storage.sync.set({ [key]: value });
  } catch (error) {
    console.error(`Could not sync preference "${key}":`, error);
  }
}

async function reconcilePrefs(onChanged) {
  let result;
  try {
    result = await chrome.storage.sync.get(SYNCED_PREF_KEYS);
  } catch (error) {
    console.error("Could not read synced preferences:", error);
    return;
  }

  const toPush = {};
  for (const key of SYNCED_PREF_KEYS) {
    const local = localStorage.getItem(key);
    if (Object.prototype.hasOwnProperty.call(result, key)) {
      const cloudValue = String(result[key]);
      if (local !== cloudValue) {
        localStorage.setItem(key, cloudValue);
        onChanged?.(key, cloudValue);
      }
    } else if (local !== null) {
      toPush[key] = local;
    }
  }

  if (Object.keys(toPush).length) {
    try {
      await chrome.storage.sync.set(toPush);
    } catch (error) {
      console.error("Could not seed synced preferences:", error);
    }
  }
}
