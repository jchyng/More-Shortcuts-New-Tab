const MAX_USER_WALLPAPERS = 8;
const MAX_WALLPAPER_EDGE = 1920;
const WALLPAPER_THUMB_SIZE = 160;
const MAX_WALLPAPER_DATA_URL_LENGTH = 700 * 1024;
const GOOGLE_APP_IDS = [
  "gmail",
  "drive",
  "meet",
  "calendar",
  "photos",
  "maps",
  "docs",
  "slides",
  "sheets",
  "keep",
  "gemini",
];
const MICROSOFT_APP_IDS = [
  "outlook",
  "onedrive",
  "teams",
  "word",
  "excel",
  "powerpoint",
  "onenote",
  "copilot",
];
const APP_IDS_BY_PROVIDER = {
  google: GOOGLE_APP_IDS,
  microsoft: MICROSOFT_APP_IDS,
};

function capitalize(text) {
  return text[0].toUpperCase() + text.slice(1);
}

const APPS_LAUNCHER_ANIMATION_MS = 220;

// Slides an apps launcher icon in/out instead of snapping it away, mirroring
// createSlidingDialog's animate-then-remove pattern: the "hiding" class
// drives the CSS transition, and the `hidden` attribute is only applied
// once that transition has actually finished.
function setLauncherVisibility(launcher, isVisible) {
  window.clearTimeout(launcher._hideTimer);

  if (isVisible) {
    launcher.hidden = false;
    void launcher.offsetWidth; // force reflow so removing the class transitions in
    launcher.classList.remove("apps-launcher-hiding");
  } else {
    launcher.classList.add("apps-launcher-hiding");
    launcher._hideTimer = window.setTimeout(() => {
      launcher.hidden = true;
    }, APPS_LAUNCHER_ANIMATION_MS);
  }
}

function createSlidingDialog(modal) {
  let closeTimer;

  const close = () => {
    if (!modal.open || modal.classList.contains("closing")) return;

    modal.classList.add("closing");
    closeTimer = window.setTimeout(() => {
      modal.close();
      modal.classList.remove("closing");
    }, 200);
  };

  const open = () => {
    window.clearTimeout(closeTimer);
    modal.classList.remove("closing");
    modal.showModal();
  };

  modal.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });

  modal.addEventListener("click", (event) => {
    // Only the dialog's own backdrop area can be the click target directly;
    // clicks on descendants (including a synthetic click bubbling from a
    // programmatically-triggered hidden file input, which reports (0,0))
    // must not be mistaken for a backdrop click.
    if (event.target !== modal) return;

    const rect = modal.getBoundingClientRect();
    const clickedOutsidePanel =
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom;
    if (clickedOutsidePanel) close();
  });

  return { open, close };
}

// Wires up a provider's apps launcher (header icon + flyout), its edit
// modal, and its per-app visibility/order toggles. Called once per
// provider ("google", "microsoft") since both share identical markup
// conventions (${provider}Apps*, ${provider}AppToggle-<app>, etc.).
function setupAppProvider(provider) {
  const label = capitalize(provider);
  const editBtn = document.getElementById(`edit${label}AppsBtn`);
  const appsModal = document.getElementById(`${provider}AppsModal`);
  const closeAppsBtn = document.getElementById(`close${label}AppsBtn`);
  const launcher = document.getElementById(`${provider}AppsLauncher`);
  const appsToggle = document.getElementById(`${provider}AppsToggle`);
  const appsFlyout = document.getElementById(`${provider}AppsFlyout`);
  const hideAllApps = document.getElementById(`hideAll${label}Apps`);
  const appToggles = document.querySelectorAll(`[id^='${provider}AppToggle-']`);

  const appsDialog = createSlidingDialog(appsModal);

  editBtn.addEventListener("click", () => {
    appsDialog.open();
  });

  closeAppsBtn.addEventListener("click", () => {
    appsDialog.close();
  });

  appsToggle.addEventListener("click", () => {
    const isOpen = !appsFlyout.hidden;
    appsFlyout.hidden = isOpen;
    appsToggle.setAttribute("aria-expanded", String(!isOpen));
  });

  document.addEventListener("click", (event) => {
    if (!launcher.contains(event.target)) {
      appsFlyout.hidden = true;
      appsToggle.setAttribute("aria-expanded", "false");
    }
  });

  appToggles.forEach((toggle) => {
    const app = toggle.dataset[`${provider}App`];
    const isVisible = getPrefSync(`${provider}App_${app}Hidden`, "false") !== "true";
    toggle.checked = isVisible;
    setAppVisibility(provider, app, isVisible);

    toggle.addEventListener("change", () => {
      // Refuse to hide the last visible app in this provider's list — the
      // apps flyout would otherwise have nothing left to show.
      if (!toggle.checked && ![...appToggles].some((t) => t !== toggle && t.checked)) {
        toggle.checked = true;
        return;
      }

      setPref(`${provider}App_${app}Hidden`, String(!toggle.checked));
      setAppVisibility(provider, app, toggle.checked);
    });
  });

  const allAppsHidden = getPrefSync(`${provider}AppsHidden`, "false") === "true";
  hideAllApps.checked = !allAppsHidden;
  // Initial state on page load: apply instantly, no slide-in/out animation.
  launcher.classList.toggle("apps-launcher-hiding", allAppsHidden);
  launcher.hidden = allAppsHidden;

  hideAllApps.addEventListener("change", () => {
    const hideAll = !hideAllApps.checked;
    setPref(`${provider}AppsHidden`, String(hideAll));
    setLauncherVisibility(launcher, !hideAll);
  });

  applyAppOrder(provider, getAppOrder(provider));
  attachAppDragAndDrop(provider, appsFlyout, ".flyout-app-link");
}

function initCustomize() {
  // Remove data created by the old "Recent" wallpapers feature.
  chrome.storage.local.remove("wallpaperHistory");

  const modal = document.getElementById("customizeModal");
  const customizeBtn = document.getElementById("customizeBtn");
  const closeBtn = document.getElementById("closeCustomizeBtn");
  const themeSelect = document.getElementById("themeSelect");
  const themePicker = document.getElementById("themePicker");
  const themeOptions = document.getElementById("themeOptions");
  const reverseSearchColors = document.getElementById("reverseSearchColors");
  const use24HourClock = document.getElementById("use24HourClock");
  const colorThemeOptions = document.getElementById("colorThemeOptions");
  const backgroundInput = document.getElementById("backgroundInput");
  const removeBackgroundBtn = document.getElementById("removeBackgroundBtn");
  const backgroundDim = document.getElementById("backgroundDim");
  const urlBackgroundBtn = document.getElementById("urlBackgroundBtn");
  const wallpaperUrlForm = document.getElementById("wallpaperUrlForm");
  const wallpaperUrlInput = document.getElementById("wallpaperUrlInput");
  const wallpaperUrlSubmitBtn = document.getElementById("wallpaperUrlSubmitBtn");
  const wallpaperUrlError = document.getElementById("wallpaperUrlError");
  const exportShortcutsBtn = document.getElementById("exportShortcutsBtn");
  const importShortcutsInput = document.getElementById("importShortcutsInput");

  const customizeDialog = createSlidingDialog(modal);

  customizeBtn.addEventListener("click", () => {
    if (modal.open) customizeDialog.close();
    else customizeDialog.open();
  });

  closeBtn.addEventListener("click", () => {
    if (wallpaperUrlForm && !wallpaperUrlForm.hidden) {
      wallpaperUrlForm.hidden = true;
      urlBackgroundBtn.classList.remove("active");
      urlBackgroundBtn.setAttribute("aria-expanded", "false");
    }
    customizeDialog.close();
  });

  themeSelect.addEventListener("click", () => {
    const isOpen = !themeOptions.hidden;
    themeOptions.hidden = isOpen;
    themeSelect.setAttribute("aria-expanded", String(!isOpen));
  });

  themeOptions.addEventListener("click", (event) => {
    const option = event.target.closest("[data-value]");
    if (!option) return;

    const mode = option.dataset.value;

    setPref("themeMode", mode);
    setThemePickerValue(mode);
    applyTheme(mode);
    reapplyDefaultColorTheme();

    themeOptions.hidden = true;
    themeSelect.setAttribute("aria-expanded", "false");
  });

  document.addEventListener("click", (event) => {
    if (!themePicker.contains(event.target)) {
      themeOptions.hidden = true;
      themeSelect.setAttribute("aria-expanded", "false");
    }
  });

  const savedReverseColors =
    getPrefSync("reverseSearchColors", "false") === "true";
  reverseSearchColors.checked = savedReverseColors;
  document.body.classList.toggle(
    "reverse-search-colors",
    savedReverseColors,
  );

  reverseSearchColors.addEventListener("change", () => {
    const enabled = reverseSearchColors.checked;
    setPref("reverseSearchColors", String(enabled));
    document.body.classList.toggle("reverse-search-colors", enabled);
  });

  if (use24HourClock) {
    use24HourClock.checked = getPrefSync("use24HourClock", "false") === "true";
    use24HourClock.addEventListener("change", () => {
      setPref("use24HourClock", String(use24HourClock.checked));
      updateClock();
    });
  }

  // Use the stored value if the user has explicitly saved one; otherwise fall
  // back to a theme-aware default (black for light, neutral for dark).
  const storedColorTheme = localStorage.getItem("colorTheme");
  const defaultColorTheme = getDefaultColorTheme();
  const savedColorTheme = storedColorTheme ?? defaultColorTheme;
  const savedSwatch = colorThemeOptions.querySelector(
    `[data-theme-color="${savedColorTheme}"]`,
  );
  applyColorTheme(
    savedSwatch ? savedColorTheme : defaultColorTheme,
    savedSwatch?.dataset.color || "",
  );

  colorThemeOptions.addEventListener("click", (event) => {
    const swatch = event.target.closest("[data-theme-color]");
    if (!swatch) return;

    const name = swatch.dataset.themeColor;
    setPref("colorTheme", name);
    applyColorTheme(name, swatch.dataset.color);
  });

  const savedDim = getPrefSync("backgroundDim", "20");

  backgroundDim.value = savedDim;

  setBackgroundDim(savedDim);
  updateRangeFill(backgroundDim);

  backgroundDim.addEventListener("input", () => {
    const value = backgroundDim.value;

    // Local-only write while dragging; syncing every tick would burst
    // past chrome.storage.sync's per-minute write quota.
    setPrefLocal("backgroundDim", value);

    setBackgroundDim(value);
    updateRangeFill(backgroundDim);
  });

  backgroundDim.addEventListener("change", () => {
    setPref("backgroundDim", backgroundDim.value);
  });

  backgroundInput.addEventListener("change", async () => {
    const files = Array.from(backgroundInput.files || []);

    if (!files.length) return;

    const oversizedFiles = files.filter((f) => f.size > 5 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      alert(t.imageTooLarge || "Image is too large. Maximum size is 5 MB.");
      backgroundInput.value = "";
      return;
    }

    setWallpaperGalleryLoading(true);

    let lastProcessedWallpaper = null;

    try {
      for (const file of files) {
        const source = await readFileAsDataUrl(file);
        const wallpaper = await createOptimizedWallpaper(source);
        await saveUserWallpaper(wallpaper);
        lastProcessedWallpaper = wallpaper;
      }

      if (lastProcessedWallpaper) {
        await chrome.storage.local.set({ customBackground: lastProcessedWallpaper.full });
        applyBackground(lastProcessedWallpaper.full);
      }
      await renderWallpaperGallery();
    } catch (error) {
      console.error("Could not process wallpaper:", error);
      setWallpaperGalleryLoading(false);
      alert(t.imageSaveError || "Could not save this image.");
    }

    // Allow re-selecting the same file later (e.g. after removing it)
    backgroundInput.value = "";
  });

  removeBackgroundBtn.addEventListener("click", async () => {
    removeBackground();

    await chrome.storage.local.remove("customBackground");

    await renderWallpaperGallery();
  });

  // --- URL wallpaper form ---

  function setUrlFormOpen(open) {
    wallpaperUrlForm.hidden = !open;
    urlBackgroundBtn.classList.toggle("active", open);
    urlBackgroundBtn.setAttribute("aria-expanded", String(open));
    if (open) {
      wallpaperUrlInput.value = "";
      showUrlError(null);
      wallpaperUrlInput.focus();
    }
  }

  function showUrlError(msg) {
    if (msg) {
      wallpaperUrlError.textContent = msg;
      wallpaperUrlError.hidden = false;
    } else {
      wallpaperUrlError.hidden = true;
      wallpaperUrlError.textContent = "";
    }
  }

  urlBackgroundBtn.addEventListener("click", () => {
    const isOpen = !wallpaperUrlForm.hidden;
    setUrlFormOpen(!isOpen);
  });

  async function submitWallpaperUrl() {
    const raw = wallpaperUrlInput.value.trim();

    if (!raw) {
      showUrlError(t.invalidImageUrl || "Please enter a valid image URL.");
      wallpaperUrlInput.focus();
      return;
    }

    // Basic URL format check
    let url;
    try {
      url = new URL(raw);
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        throw new Error("Invalid protocol");
      }
    } catch {
      showUrlError(t.invalidImageUrl || "Please enter a valid image URL.");
      wallpaperUrlInput.focus();
      return;
    }

    showUrlError(null);
    setWallpaperGalleryLoading(true);
    wallpaperUrlSubmitBtn.disabled = true;

    try {
      const dataUrl = await fetchImageAsDataUrl(url.href);
      const wallpaper = await createOptimizedWallpaper(dataUrl);
      await chrome.storage.local.set({ customBackground: wallpaper.full });
      await saveUserWallpaper(wallpaper);
      applyBackground(wallpaper.full);
      setUrlFormOpen(false);
      await renderWallpaperGallery();
    } catch (error) {
      console.error("Could not load wallpaper from URL:", error);
      setWallpaperGalleryLoading(false);
      showUrlError(t.imageFetchError || "Could not load image from URL.");
      wallpaperUrlInput.focus();
    } finally {
      wallpaperUrlSubmitBtn.disabled = false;
    }
  }

  wallpaperUrlSubmitBtn.addEventListener("click", submitWallpaperUrl);

  wallpaperUrlInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submitWallpaperUrl();
    } else if (event.key === "Escape") {
      setUrlFormOpen(false);
    }
  });

  setupAppProvider("google");
  setupAppProvider("microsoft");

  exportShortcutsBtn.addEventListener("click", () => {
    exportShortcuts();
  });

  importShortcutsInput.addEventListener("change", async () => {
    const file = importShortcutsInput.files[0];
    if (!file) return;
    await importShortcutsFromFile(file);
    importShortcutsInput.value = "";
  });

  initializeWallpaperGallery();
  pruneStaleWallpaperThumbnails();
}

async function initializeWallpaperGallery() {
  const result = await chrome.storage.local.get("customBackground");

  if (result.customBackground?.startsWith("data:image/")) {
    const wallpapers = await getUserWallpapers();
    const alreadySaved = wallpapers.some(
      (wallpaper) => wallpaper.full === result.customBackground,
    );
    if (!alreadySaved) {
      const optimized = await createOptimizedWallpaper(result.customBackground);
      await chrome.storage.local.set({ customBackground: optimized.full });
      applyBackground(optimized.full);
      await saveUserWallpaper(optimized);
    }
  }

  await renderWallpaperGallery();
}

async function loadBackground() {
  const result = await chrome.storage.local.get("customBackground");

  if (result.customBackground) {
    applyBackground(result.customBackground);
  }
}

function setAppVisibility(provider, app, isVisible) {
  const link = document.querySelector(`.flyout-app-link[data-${provider}-app="${app}"]`);
  if (link) link.hidden = !isVisible;
}

// Returns the appropriate default color theme name based on the current
// actual theme (light → "black" for better contrast, dark → "neutral").
// Only used when the user has not explicitly saved a colorTheme preference.
function getDefaultColorTheme() {
  const actualTheme = document.body.getAttribute("data-theme") || "dark";
  return actualTheme === "light" ? "black" : "neutral";
}

// Re-applies the default color theme when no explicit colorTheme pref is
// saved and the active theme (light/dark) has just changed.
function reapplyDefaultColorTheme() {
  if (localStorage.getItem("colorTheme") !== null) return;

  const name = getDefaultColorTheme();
  const colorThemeOptions = document.getElementById("colorThemeOptions");
  const swatch = colorThemeOptions?.querySelector(`[data-theme-color="${name}"]`);
  applyColorTheme(name, swatch?.dataset.color || "");
}

function applyColorTheme(name, color) {
  const isNeutral = name === "neutral";
  document.body.classList.toggle("has-color-theme", !isNeutral);
  document.body.dataset.colorTheme = name;

  if (isNeutral) {
    document.body.style.removeProperty("--palette-color");
  } else {
    document.body.style.setProperty("--palette-color", color);
  }

  const colorThemeOptions = document.getElementById("colorThemeOptions");
  colorThemeOptions?.querySelectorAll("[data-theme-color]").forEach((swatch) => {
    if (swatch.dataset.color) {
      swatch.style.setProperty("--swatch-color", swatch.dataset.color);
    }
    const selected = swatch.dataset.themeColor === name;
    swatch.classList.toggle("selected", selected);
    swatch.setAttribute("aria-pressed", String(selected));
  });
}

// Re-applies a single preference after reconcilePrefs() pulls in a value
// that changed on another device.
function applyChangedPref(key, value) {
  if (key === "themeMode") {
    applyTheme(value);
    setThemePickerValue(value);
    // If the user has never explicitly chosen a color theme, re-evaluate the
    // theme-aware default now that the active theme may have changed.
    reapplyDefaultColorTheme();
    return;
  }

  if (key === "reverseSearchColors") {
    const enabled = value === "true";
    const toggle = document.getElementById("reverseSearchColors");
    if (toggle) toggle.checked = enabled;
    document.body.classList.toggle("reverse-search-colors", enabled);
    return;
  }

  if (key === "colorTheme") {
    const colorThemeOptions = document.getElementById("colorThemeOptions");
    const swatch = colorThemeOptions?.querySelector(`[data-theme-color="${value}"]`);
    applyColorTheme(swatch ? value : "neutral", swatch?.dataset.color || "");
    return;
  }

  if (key === "backgroundDim") {
    const input = document.getElementById("backgroundDim");
    if (!input) return;
    input.value = value;
    setBackgroundDim(value);
    updateRangeFill(input);
    return;
  }

  for (const provider of Object.keys(APP_IDS_BY_PROVIDER)) {
    const label = capitalize(provider);

    if (key === `${provider}AppsHidden`) {
      const hideAll = value === "true";
      const toggle = document.getElementById(`hideAll${label}Apps`);
      if (toggle) toggle.checked = !hideAll;
      const launcher = document.getElementById(`${provider}AppsLauncher`);
      if (launcher) setLauncherVisibility(launcher, !hideAll);
      return;
    }

    if (key === `${provider}AppOrder`) {
      applyAppOrder(provider, getAppOrder(provider));
      return;
    }

    const prefix = `${provider}App_`;
    if (key.startsWith(prefix) && key.endsWith("Hidden")) {
      const app = key.slice(prefix.length, -"Hidden".length);
      const isVisible = value !== "true";
      const toggle = document.getElementById(`${provider}AppToggle-${app}`);
      if (toggle) toggle.checked = isVisible;
      setAppVisibility(provider, app, isVisible);
      return;
    }
  }

  if (key === "use24HourClock") {
    const enabled = value === "true";
    const toggle = document.getElementById("use24HourClock");
    if (toggle) toggle.checked = enabled;
    updateClock();
    return;
  }

  if (key === "language") {
    applyLocalization();
    return;
  }
}

function getAppOrder(provider) {
  const appIds = APP_IDS_BY_PROVIDER[provider];

  let stored;
  try {
    stored = JSON.parse(getPrefSync(`${provider}AppOrder`, null));
  } catch {
    stored = null;
  }

  const known = Array.isArray(stored)
    ? stored.filter((app) => appIds.includes(app))
    : [];
  const missing = appIds.filter((app) => !known.includes(app));

  return [...known, ...missing];
}

function reorderElements(container, order, getElement, beforeNode = null) {
  const fragment = document.createDocumentFragment();
  order.forEach((app) => {
    const element = getElement(app);
    if (element) fragment.appendChild(element);
  });
  container.insertBefore(fragment, beforeNode);
}

function applyAppOrder(provider, order) {
  reorderElements(document.getElementById(`${provider}AppList`), order, (app) =>
    document.querySelector(`.app-row[data-${provider}-app="${app}"]`),
  );

  reorderElements(document.getElementById(`${provider}AppsFlyout`), order, (app) =>
    document.querySelector(`.flyout-app-link[data-${provider}-app="${app}"]`),
  );
}

function saveAppOrder(provider, order) {
  setPref(`${provider}AppOrder`, JSON.stringify(order));
  applyAppOrder(provider, order);
}

// FLIP-style animation: record positions, run the DOM change, animate the delta.
function animateAppReorder(container, itemSelector, moveAction) {
  const items = [...container.querySelectorAll(itemSelector)];

  // Snap any item still mid-animation from a previous call back to its true
  // layout position first, so the "before" measurement below is never thrown
  // off by a leftover transform — chaining reorders on top of an in-flight
  // one is what produced the overlapping/misplaced tiles during fast drags.
  items.forEach((item) => {
    item.style.transition = "none";
    item.style.transform = "";
  });
  void container.offsetWidth; // force reflow before measuring

  const positions = new Map();
  items.forEach((item) => {
    const rect = item.getBoundingClientRect();
    positions.set(item, { left: rect.left, top: rect.top });
  });

  moveAction();

  items.forEach((item) => {
    const oldPos = positions.get(item);
    if (!oldPos) return;

    const rect = item.getBoundingClientRect();
    const deltaX = oldPos.left - rect.left;
    const deltaY = oldPos.top - rect.top;

    if (deltaX === 0 && deltaY === 0) {
      item.style.transition = "";
      return;
    }

    item.style.transform = `translate(${deltaX}px, ${deltaY}px)`;

    requestAnimationFrame(() => {
      item.getBoundingClientRect(); // force reflow
      item.style.transition = "";
      item.style.transform = "";
    });
  });
}

// Grid-aware reorder: a target well below/above the dragged item's row wins
// on the vertical axis; otherwise (same row) the horizontal position decides.
function attachAppDragAndDrop(provider, container, itemSelector) {
  let dragged = null;
  let pendingFrame = null;
  let latestEvent = null;

  const processPendingMove = () => {
    pendingFrame = null;
    const event = latestEvent;
    if (!dragged || !event) return;

    const item = event.target.closest(itemSelector);
    if (!item || item === dragged) return;

    const rect = item.getBoundingClientRect();
    const dy = event.clientY - (rect.top + rect.height / 2);
    const rowThreshold = rect.height / 4;
    const isAfter =
      Math.abs(dy) > rowThreshold
        ? dy > 0
        : event.clientX - rect.left > rect.width / 2;

    const referenceNode = isAfter ? item.nextSibling : item;
    // Skip when the move is a no-op — otherwise every mousemove re-triggers
    // the FLIP animation and the grid visibly jitters under the cursor.
    if (referenceNode === dragged || dragged.nextSibling === referenceNode) {
      return;
    }

    animateAppReorder(container, itemSelector, () => {
      container.insertBefore(dragged, referenceNode);
    });
  };

  container.addEventListener("dragstart", (event) => {
    const item = event.target.closest(itemSelector);
    if (!item) return;
    dragged = item;
    item.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
  });

  container.addEventListener("dragend", (event) => {
    const item = event.target.closest(itemSelector);
    if (item) item.classList.remove("dragging");
    if (!dragged) return;

    // A drag that ends before the next animation frame (a quick flick, or a
    // synthetic drag) would otherwise drop its last pending move unapplied.
    if (pendingFrame !== null) {
      cancelAnimationFrame(pendingFrame);
      processPendingMove();
    }
    dragged = null;
    latestEvent = null;

    const order = [...container.querySelectorAll(itemSelector)].map(
      (element) => element.dataset[`${provider}App`],
    );
    saveAppOrder(provider, order);
  });

  container.addEventListener("dragenter", (event) => {
    event.preventDefault();
  });

  container.addEventListener("dragover", (event) => {
    event.preventDefault();
    if (!dragged) return;

    // Coalesce rapid dragover events (several can fire per animation frame)
    // into a single reorder using the latest pointer position, instead of
    // chaining a FLIP animation per event.
    latestEvent = event;
    if (pendingFrame === null) {
      pendingFrame = requestAnimationFrame(processPendingMove);
    }
  });

  container.addEventListener("drop", (event) => {
    if (dragged) event.preventDefault();
  });
}

function applyBackground(image) {
  document.body.style.backgroundImage = `url("${image}")`;

  document.body.classList.add("has-wallpaper");
}

function removeBackground() {
  document.body.style.backgroundImage = "";

  document.body.classList.remove("has-wallpaper");
}

function setBackgroundDim(value) {
  document.documentElement.style.setProperty(
    "--background-dim",
    Number(value) / 100,
  );
}

function updateRangeFill(input) {
  const min = Number(input.min) || 0;
  const max = Number(input.max) || 100;
  const pct = ((Number(input.value) - min) / (max - min)) * 100;

  input.style.background = `linear-gradient(to right, var(--slider-fill) ${pct}%, var(--slider-track) ${pct}%)`;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Fetches a remote image URL and converts it to a data URL, leveraging
// the extension's <all_urls> host_permissions so cross-origin images work.
async function fetchImageAsDataUrl(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.startsWith("image/")) {
    throw new Error(`Not an image (${contentType})`);
  }

  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

async function resizeImage(
  source,
  maxEdge,
  quality = 0.82,
  maxDataUrlLength = Infinity,
) {
  const image = await loadImage(source);
  let scale = Math.min(
    1,
    maxEdge / Math.max(image.naturalWidth, image.naturalHeight),
  );
  const canvas = document.createElement("canvas");
  let output;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);

    for (let currentQuality = quality; currentQuality >= 0.42; currentQuality -= 0.1) {
      output = canvas.toDataURL("image/webp", currentQuality);
      if (output.length <= maxDataUrlLength) return output;
    }

    scale *= 0.82;
  }

  return output;
}

async function createOptimizedWallpaper(source) {
  try {
    const full = await resizeImage(
      source,
      MAX_WALLPAPER_EDGE,
      0.82,
      MAX_WALLPAPER_DATA_URL_LENGTH,
    );
    const thumbnail = await resizeImage(full, WALLPAPER_THUMB_SIZE, 0.72);
    return { full, thumbnail };
  } catch (error) {
    console.warn("Could not optimize wallpaper:", error);
    return { full: source, thumbnail: source };
  }
}

const DEFAULT_WALLPAPER_FILES = [
  "1.jpg",
  "2.jpg",
  "3.jpg",
  "4.jpg",
  "5.jpg",
  "4-mountain-lake.png",
  "5-desert-canyon.png",
];

async function getDefaultWallpapers() {
  return DEFAULT_WALLPAPER_FILES.map((filename) => ({
    full: chrome.runtime.getURL(`assets/wallpapers/${filename}`),
  }));
}

async function getUserWallpapers() {
  try {
    const result = await chrome.storage.local.get("userWallpapers");
    const stored = (result.userWallpapers ?? []).filter(Boolean);
    const normalized = (
      await Promise.all(
        stored.map(async (item) => {
          try {
            if (typeof item === "string") return await createOptimizedWallpaper(item);
            if (item && item.full) {
              return {
                full: item.full,
                thumbnail: item.thumbnail || item.full,
              };
            }
            return null;
          } catch {
            return null;
          }
        }),
      )
    ).filter(Boolean);

    if (stored.some((item) => typeof item === "string")) {
      await chrome.storage.local.set({ userWallpapers: normalized });
    }
    return normalized;
  } catch (error) {
    console.error("Could not get user wallpapers:", error);
    return [];
  }
}

async function saveUserWallpaper(wallpaper) {
  try {
    let wallpapers = await getUserWallpapers();
    wallpapers = wallpapers.filter((item) => item.full !== wallpaper.full);
    wallpapers.unshift(wallpaper);
    wallpapers = wallpapers.slice(0, MAX_USER_WALLPAPERS);

    await chrome.storage.local.set({ userWallpapers: wallpapers });
  } catch (error) {
    console.error("Could not save user wallpaper:", error);
  }
}

function setWallpaperGalleryLoading(isLoading) {
  const gallery = document.getElementById("wallpaperGallery");
  if (gallery) gallery.classList.toggle("loading", isLoading);
}

async function selectWallpaper(url) {
  applyBackground(url);

  await chrome.storage.local.set({ customBackground: url });

  await renderWallpaperGallery();
}

async function getDefaultWallpaperThumbnail(wallpaper) {
  if (!wallpaper || !wallpaper.full) return "";
  try {
    const manifest = chrome.runtime.getManifest ? chrome.runtime.getManifest() : { version: "1" };
    const version = manifest.version;
    const filename = wallpaper.full.split("/").pop();
    const key = `wallpaperThumb_${version}_${filename}`;
    const cached = await chrome.storage.local.get(key);
    if (cached[key]) return cached[key];
    const thumbnail = await resizeImage(wallpaper.full, WALLPAPER_THUMB_SIZE, 0.72);
    await chrome.storage.local.set({ [key]: thumbnail });
    return thumbnail;
  } catch (error) {
    console.warn("Could not generate default thumbnail, using original image:", error);
    return wallpaper.full;
  }
}

async function pruneStaleWallpaperThumbnails() {
  try {
    const manifest = chrome.runtime.getManifest ? chrome.runtime.getManifest() : { version: "1" };
    const version = manifest.version;
    const currentPrefix = `wallpaperThumb_${version}_`;
    const all = await chrome.storage.local.get(null);
    const staleKeys = Object.keys(all).filter(
      (key) => key.startsWith("wallpaperThumb_") && !key.startsWith(currentPrefix),
    );
    if (staleKeys.length) await chrome.storage.local.remove(staleKeys);
  } catch (error) {
    console.warn("Could not prune stale thumbnails:", error);
  }
}

function createWallpaperThumb(wallpaper, currentBg) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "wallpaper-thumb";
  const thumbUrl = wallpaper?.thumbnail || wallpaper?.full || "";
  btn.style.backgroundImage = `url("${thumbUrl}")`;
  btn.title = "Use this wallpaper";
  if (currentBg && wallpaper?.full && currentBg.includes(wallpaper.full)) {
    btn.classList.add("active");
  }
  btn.addEventListener("click", () => selectWallpaper(wallpaper.full));
  return btn;
}

async function removeUserWallpaper(full) {
  const result = await chrome.storage.local.get([
    "userWallpapers",
    "customBackground",
  ]);
  const wallpapers = (result.userWallpapers ?? []).filter((item) =>
    (typeof item === "string" ? item : item.full) !== full,
  );

  await chrome.storage.local.set({ userWallpapers: wallpapers });

  if (result.customBackground === full) {
    removeBackground();
    await chrome.storage.local.remove("customBackground");
  }

  await renderWallpaperGallery();
}

function createUserWallpaperThumb(wallpaper, currentBg) {
  const wrapper = document.createElement("div");
  wrapper.className = "wallpaper-thumb-wrapper";
  wrapper.appendChild(createWallpaperThumb(wallpaper, currentBg));

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "wallpaper-remove-btn";
  removeBtn.title = "Remove preset";
  removeBtn.setAttribute("aria-label", "Remove preset");
  removeBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    removeUserWallpaper(wallpaper.full);
  });
  wrapper.appendChild(removeBtn);

  return wrapper;
}

function createWallpaperGroupLabel(text) {
  const div = document.createElement("div");
  div.className = "wallpaper-group-label";
  div.textContent = text;
  return div;
}

async function renderWallpaperGallery() {
  const gallery = document.getElementById("wallpaperGallery");
  if (!gallery) return;

  try {
    const currentBg = document.body.style.backgroundImage;

    const [defaultSources, userWallpapers] = await Promise.all([
      getDefaultWallpapers(),
      getUserWallpapers(),
    ]);
    const defaults = await Promise.all(
      defaultSources.map(async (wallpaper) => ({
        ...wallpaper,
        thumbnail: await getDefaultWallpaperThumbnail(wallpaper),
      })),
    );

    gallery.replaceChildren();
    gallery.classList.remove("loading");

    const validDefaults = defaults.filter((w) => w && w.full);
    if (validDefaults.length) {
      const defaultLabel = (typeof t !== "undefined" && t.defaultPresets) || "Default presets";
      gallery.appendChild(createWallpaperGroupLabel(defaultLabel));
      const row = document.createElement("div");
      row.className = "wallpaper-row";
      validDefaults.forEach((wallpaper) =>
        row.appendChild(createWallpaperThumb(wallpaper, currentBg)),
      );
      gallery.appendChild(row);
    }

    const validUserWallpapers = userWallpapers.filter((w) => w && w.full);
    if (validUserWallpapers.length) {
      const yourPresetsText = (typeof t !== "undefined" && t.yourPresets) || "Your presets";
      gallery.appendChild(
        createWallpaperGroupLabel(
          `${yourPresetsText} (${validUserWallpapers.length}/${MAX_USER_WALLPAPERS})`,
        ),
      );
      const row = document.createElement("div");
      row.className = "wallpaper-row";
      validUserWallpapers.forEach((wallpaper) =>
        row.appendChild(createUserWallpaperThumb(wallpaper, currentBg)),
      );
      gallery.appendChild(row);
    }

    if (!validDefaults.length && !validUserWallpapers.length) {
      gallery.style.display = "none";
    } else {
      gallery.style.display = "";
    }
  } catch (error) {
    console.error("Could not render wallpaper gallery:", error);
    gallery.classList.remove("loading");
  }
}
