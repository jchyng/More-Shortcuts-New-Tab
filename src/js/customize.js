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
  const exportShortcutsBtn = document.getElementById("exportShortcutsBtn");
  const importShortcutsInput = document.getElementById("importShortcutsInput");
  const googleAppsModal = document.getElementById("googleAppsModal");
  const editGoogleAppsBtn = document.getElementById("editGoogleAppsBtn");
  const closeGoogleAppsBtn = document.getElementById("closeGoogleAppsBtn");
  const googleAppList = document.getElementById("googleAppList");
  const googleAppsGroup = document.getElementById("googleAppsGroup");
  const hideAllGoogleApps = document.getElementById("hideAllGoogleApps");
  const googleAppToggles = document.querySelectorAll("[id^='googleAppToggle-']");

  const customizeDialog = createSlidingDialog(modal);
  const googleAppsDialog = createSlidingDialog(googleAppsModal);

  customizeBtn.addEventListener("click", () => {
    if (modal.open) customizeDialog.close();
    else customizeDialog.open();
  });

  closeBtn.addEventListener("click", () => {
    customizeDialog.close();
  });

  editGoogleAppsBtn.addEventListener("click", () => {
    googleAppsDialog.open();
  });

  closeGoogleAppsBtn.addEventListener("click", () => {
    googleAppsDialog.close();
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

  const savedColorTheme = getPrefSync("colorTheme", "neutral");
  const savedSwatch = colorThemeOptions.querySelector(
    `[data-theme-color="${savedColorTheme}"]`,
  );
  applyColorTheme(
    savedSwatch ? savedColorTheme : "neutral",
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
    const file = backgroundInput.files[0];

    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("Image is too large. Maximum size is 5 MB.");
      return;
    }

    setWallpaperGalleryLoading(true);

    try {
      const source = await readFileAsDataUrl(file);
      const wallpaper = await createOptimizedWallpaper(source);
      await chrome.storage.local.set({ customBackground: wallpaper.full });
      await saveUserWallpaper(wallpaper);
      applyBackground(wallpaper.full);
      await renderWallpaperGallery();
    } catch (error) {
      console.error("Could not process wallpaper:", error);
      setWallpaperGalleryLoading(false);
      alert("Could not save this image.");
    }

    // Allow re-selecting the same file later (e.g. after removing it)
    backgroundInput.value = "";
  });

  removeBackgroundBtn.addEventListener("click", async () => {
    removeBackground();

    await chrome.storage.local.remove("customBackground");

    await renderWallpaperGallery();
  });

  googleAppToggles.forEach((toggle) => {
    const app = toggle.dataset.googleApp;
    const isVisible = getPrefSync(`googleApp_${app}Hidden`, "false") !== "true";
    toggle.checked = isVisible;
    setGoogleAppVisibility(app, isVisible);

    toggle.addEventListener("change", () => {
      setPref(`googleApp_${app}Hidden`, String(!toggle.checked));
      setGoogleAppVisibility(app, toggle.checked);
    });
  });

  const allGoogleAppsHidden = getPrefSync("googleAppsHidden", "false") === "true";
  hideAllGoogleApps.checked = !allGoogleAppsHidden;
  googleAppsGroup.hidden = allGoogleAppsHidden;

  hideAllGoogleApps.addEventListener("change", () => {
    const hideAll = !hideAllGoogleApps.checked;
    setPref("googleAppsHidden", String(hideAll));
    setGoogleAppsGroupVisibility(googleAppsGroup, !hideAll);
  });

  applyGoogleAppOrder(getGoogleAppOrder());
  attachGoogleAppDragAndDrop(googleAppsGroup, ".header-link", true);
  attachGoogleAppDragAndDrop(googleAppList, ".google-app-row", false);

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

function setGoogleAppVisibility(app, isVisible) {
  const link = document.querySelector(`.header-link[data-google-app="${app}"]`);
  if (link) link.hidden = !isVisible;
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

  if (key === "googleAppsHidden") {
    const hideAll = value === "true";
    const toggle = document.getElementById("hideAllGoogleApps");
    if (toggle) toggle.checked = !hideAll;
    const group = document.getElementById("googleAppsGroup");
    if (group) setGoogleAppsGroupVisibility(group, !hideAll);
    return;
  }

  if (key === "googleAppOrder") {
    applyGoogleAppOrder(getGoogleAppOrder());
    return;
  }

  if (key.startsWith("googleApp_") && key.endsWith("Hidden")) {
    const app = key.slice("googleApp_".length, -"Hidden".length);
    const isVisible = value !== "true";
    const toggle = document.getElementById(`googleAppToggle-${app}`);
    if (toggle) toggle.checked = isVisible;
    setGoogleAppVisibility(app, isVisible);
  }
}

const GOOGLE_APPS_STAGGER_MS = 45;
const GOOGLE_APPS_FADE_MS = 220;

// Animates the whole group in/out: showing builds the bar right-to-left,
// hiding collapses it left-to-right, each icon staggered after the last.
function setGoogleAppsGroupVisibility(group, show) {
  const items = [...group.querySelectorAll(".header-link:not([hidden])")];

  if (!items.length) {
    group.hidden = !show;
    return;
  }

  const token = Symbol();
  group._googleAppsAnimToken = token;

  items.forEach((item) => {
    item.style.transition = "none";
  });

  if (show) {
    group.hidden = false;
    items.forEach((item) => {
      item.style.opacity = "0";
      item.style.transform = "translateY(-4px)";
    });
  }

  void group.offsetWidth; // commit the "from" state before transitioning

  items.forEach((item, index) => {
    const order = show ? items.length - 1 - index : index;
    const delay = order * GOOGLE_APPS_STAGGER_MS;
    item.style.transition = `opacity ${GOOGLE_APPS_FADE_MS}ms ease ${delay}ms, transform ${GOOGLE_APPS_FADE_MS}ms ease ${delay}ms`;
    item.style.opacity = show ? "" : "0";
    item.style.transform = show ? "" : "translateY(-4px)";
  });

  const totalDuration =
    (items.length - 1) * GOOGLE_APPS_STAGGER_MS + GOOGLE_APPS_FADE_MS;

  window.setTimeout(() => {
    if (group._googleAppsAnimToken !== token) return;

    if (!show) group.hidden = true;
    items.forEach((item) => {
      item.style.transition = "";
      item.style.opacity = "";
      item.style.transform = "";
    });
  }, totalDuration);
}

function getGoogleAppOrder() {
  let stored;
  try {
    stored = JSON.parse(getPrefSync("googleAppOrder", null));
  } catch {
    stored = null;
  }

  const known = Array.isArray(stored)
    ? stored.filter((app) => GOOGLE_APP_IDS.includes(app))
    : [];
  const missing = GOOGLE_APP_IDS.filter((app) => !known.includes(app));

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

function applyGoogleAppOrder(order) {
  reorderElements(document.getElementById("googleAppList"), order, (app) =>
    document.querySelector(`.google-app-row[data-google-app="${app}"]`),
  );

  reorderElements(document.getElementById("googleAppsGroup"), order, (app) =>
    document.querySelector(`.header-link[data-google-app="${app}"]`),
  );
}

function saveGoogleAppOrder(order) {
  setPref("googleAppOrder", JSON.stringify(order));
  applyGoogleAppOrder(order);
}

// FLIP-style animation: record positions, run the DOM change, animate the delta.
function animateGoogleAppReorder(container, itemSelector, moveAction) {
  const items = [...container.querySelectorAll(itemSelector)];
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

    if (deltaX === 0 && deltaY === 0) return;

    item.style.transition = "none";
    item.style.transform = `translate(${deltaX}px, ${deltaY}px)`;

    requestAnimationFrame(() => {
      item.getBoundingClientRect(); // force reflow
      item.style.transition = "";
      item.style.transform = "";
    });
  });
}

function attachGoogleAppDragAndDrop(container, itemSelector, horizontal) {
  let dragged = null;

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
    dragged = null;

    const order = [...container.querySelectorAll(itemSelector)].map(
      (element) => element.dataset.googleApp,
    );
    saveGoogleAppOrder(order);
  });

  container.addEventListener("dragover", (event) => {
    event.preventDefault();
    const item = event.target.closest(itemSelector);
    if (!dragged || !item || item === dragged) return;

    const rect = item.getBoundingClientRect();
    const isAfter = horizontal
      ? event.clientX - rect.left > rect.width / 2
      : event.clientY - rect.top > rect.height / 2;

    animateGoogleAppReorder(container, itemSelector, () => {
      container.insertBefore(dragged, isAfter ? item.nextSibling : item);
    });
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
  const full = await resizeImage(
    source,
    MAX_WALLPAPER_EDGE,
    0.82,
    MAX_WALLPAPER_DATA_URL_LENGTH,
  );
  const thumbnail = await resizeImage(full, WALLPAPER_THUMB_SIZE, 0.72);
  return { full, thumbnail };
}

const DEFAULT_WALLPAPER_FILES = ["1.jpg", "2.jpg", "3.jpg"];

async function getDefaultWallpapers() {
  return DEFAULT_WALLPAPER_FILES.map((filename) => ({
    full: chrome.runtime.getURL(`assets/wallpapers/${filename}`),
  }));
}

async function getUserWallpapers() {
  const result = await chrome.storage.local.get("userWallpapers");
  const stored = result.userWallpapers ?? [];
  const normalized = await Promise.all(
    stored.map(async (item) =>
      typeof item === "string" ? createOptimizedWallpaper(item) : item,
    ),
  );
  if (stored.some((item) => typeof item === "string")) {
    await chrome.storage.local.set({ userWallpapers: normalized });
  }
  return normalized;
}

async function saveUserWallpaper(wallpaper) {
  let wallpapers = await getUserWallpapers();
  wallpapers = wallpapers.filter((item) => item.full !== wallpaper.full);
  wallpapers.unshift(wallpaper);
  wallpapers = wallpapers.slice(0, MAX_USER_WALLPAPERS);

  await chrome.storage.local.set({ userWallpapers: wallpapers });
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
  const version = chrome.runtime.getManifest().version;
  const filename = wallpaper.full.split("/").pop();
  const key = `wallpaperThumb_${version}_${filename}`;
  const cached = await chrome.storage.local.get(key);
  if (cached[key]) return cached[key];
  const thumbnail = await resizeImage(wallpaper.full, WALLPAPER_THUMB_SIZE, 0.72);
  await chrome.storage.local.set({ [key]: thumbnail });
  return thumbnail;
}

async function pruneStaleWallpaperThumbnails() {
  const version = chrome.runtime.getManifest().version;
  const currentPrefix = `wallpaperThumb_${version}_`;
  const all = await chrome.storage.local.get(null);
  const staleKeys = Object.keys(all).filter(
    (key) => key.startsWith("wallpaperThumb_") && !key.startsWith(currentPrefix),
  );
  if (staleKeys.length) await chrome.storage.local.remove(staleKeys);
}

function createWallpaperThumb(wallpaper, currentBg) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "wallpaper-thumb";
  btn.style.backgroundImage = `url("${wallpaper.thumbnail}")`;
  btn.title = "Use this wallpaper";
  if (currentBg && currentBg.includes(wallpaper.full)) btn.classList.add("active");
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

  if (defaults.length) {
    gallery.appendChild(createWallpaperGroupLabel("Default presets"));
    const row = document.createElement("div");
    row.className = "wallpaper-row";
    defaults.forEach((wallpaper) =>
      row.appendChild(createWallpaperThumb(wallpaper, currentBg)),
    );
    gallery.appendChild(row);
  }

  if (userWallpapers.length) {
    gallery.appendChild(
      createWallpaperGroupLabel(
        `Your presets (${userWallpapers.length}/${MAX_USER_WALLPAPERS})`,
      ),
    );
    const row = document.createElement("div");
    row.className = "wallpaper-row";
    userWallpapers.forEach((wallpaper) =>
      row.appendChild(createUserWallpaperThumb(wallpaper, currentBg)),
    );
    gallery.appendChild(row);
  }

  if (!defaults.length && !userWallpapers.length) {
    gallery.style.display = "none";
  } else {
    gallery.style.display = "";
  }
}
