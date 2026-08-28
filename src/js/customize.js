const MAX_USER_WALLPAPERS = 8;
const MAX_DEFAULT_WALLPAPERS = 100;
const MAX_WALLPAPER_EDGE = 1920;
const WALLPAPER_THUMB_SIZE = 160;
const MAX_WALLPAPER_DATA_URL_LENGTH = 700 * 1024;

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
  let closeTimer;

  const closeCustomize = () => {
    if (!modal.open || modal.classList.contains("closing")) return;

    modal.classList.add("closing");
    closeTimer = window.setTimeout(() => {
      modal.close();
      modal.classList.remove("closing");
    }, 200);
  };

  customizeBtn.addEventListener("click", () => {
    if (modal.open) {
      closeCustomize();
      return;
    }

    window.clearTimeout(closeTimer);
    modal.classList.remove("closing");
    modal.showModal();
  });

  closeBtn.addEventListener("click", () => {
    closeCustomize();
  });

  modal.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeCustomize();
  });

  modal.addEventListener("click", (event) => {
    const rect = modal.getBoundingClientRect();
    const clickedOutsidePanel =
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom;
    if (clickedOutsidePanel) closeCustomize();
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

    localStorage.setItem("themeMode", mode);
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
    localStorage.getItem("reverseSearchColors") === "true";
  reverseSearchColors.checked = savedReverseColors;
  document.body.classList.toggle(
    "reverse-search-colors",
    savedReverseColors,
  );

  reverseSearchColors.addEventListener("change", () => {
    const enabled = reverseSearchColors.checked;
    localStorage.setItem("reverseSearchColors", String(enabled));
    document.body.classList.toggle("reverse-search-colors", enabled);
  });

  use24HourClock.checked = localStorage.getItem("use24HourClock") === "true";
  use24HourClock.addEventListener("change", () => {
    localStorage.setItem("use24HourClock", String(use24HourClock.checked));
    updateClock();
  });

  const applyColorTheme = (name, color) => {
    const isNeutral = name === "neutral";
    document.body.classList.toggle("has-color-theme", !isNeutral);
    document.body.dataset.colorTheme = name;

    if (isNeutral) {
      document.body.style.removeProperty("--palette-color");
    } else {
      document.body.style.setProperty("--palette-color", color);
    }

    colorThemeOptions.querySelectorAll("[data-theme-color]").forEach((swatch) => {
      if (swatch.dataset.color) {
        swatch.style.setProperty("--swatch-color", swatch.dataset.color);
      }
      const selected = swatch.dataset.themeColor === name;
      swatch.classList.toggle("selected", selected);
      swatch.setAttribute("aria-pressed", String(selected));
    });
  };

  const savedColorTheme = localStorage.getItem("colorTheme") || "neutral";
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
    localStorage.setItem("colorTheme", name);
    applyColorTheme(name, swatch.dataset.color);
  });

  const savedDim = localStorage.getItem("backgroundDim") || "20";

  backgroundDim.value = savedDim;

  setBackgroundDim(savedDim);
  updateRangeFill(backgroundDim);

  backgroundDim.addEventListener("input", () => {
    const value = backgroundDim.value;

    localStorage.setItem("backgroundDim", value);

    setBackgroundDim(value);
    updateRangeFill(backgroundDim);
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

  initializeWallpaperGallery();
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

// --- Preset wallpapers ---
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

async function wallpaperExists(url) {
  try {
    const response = await fetch(url, { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
}

async function getDefaultWallpapers() {
  const wallpapers = [];
  for (let index = 1; index <= MAX_DEFAULT_WALLPAPERS; index += 1) {
    const full = chrome.runtime.getURL(`assets/wallpapers/${index}.jpg`);
    if (!(await wallpaperExists(full))) break;
    wallpapers.push({ full });
  }
  return wallpapers;
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
