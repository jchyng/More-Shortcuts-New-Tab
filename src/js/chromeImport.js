function isImportableChromeUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

// Returns null when the file isn't a Chrome Preferences file at all
// (no custom_links.list), or an array (possibly empty) of {title, url}.
function parseChromePreferences(preferences) {
  const list = preferences?.custom_links?.list;
  if (!Array.isArray(list)) return null;

  return list
    .filter((item) => typeof item?.title === "string" && typeof item?.url === "string")
    .map((item) => ({ title: item.title.trim(), url: item.url }))
    .filter((item) => item.title && isImportableChromeUrl(item.url));
}

function setupChromeImport() {
  const openBtn = document.getElementById("importFromChromeBtn");
  const modal = document.getElementById("chromeImportModal");
  if (!openBtn || !modal) return;

  const closeBtn = document.getElementById("closeChromeImportBtn");
  const dropzone = document.getElementById("chromeImportDropzone");
  const fileInput = document.getElementById("chromeImportFileInput");
  const introSection = document.getElementById("chromeImportIntro");
  const previewSection = document.getElementById("chromeImportPreview");
  const errorSection = document.getElementById("chromeImportError");
  const errorText = document.getElementById("chromeImportErrorText");
  const summary = document.getElementById("chromeImportSummary");
  const list = document.getElementById("chromeImportList");
  const cancelBtn = document.getElementById("chromeImportCancelBtn");
  const confirmBtn = document.getElementById("chromeImportConfirmBtn");

  const dialog = createSlidingDialog(modal);
  let parsedItems = [];

  const showIntro = () => {
    introSection.hidden = false;
    previewSection.hidden = true;
    errorSection.hidden = true;
  };

  const showError = (message) => {
    introSection.hidden = false;
    previewSection.hidden = true;
    errorSection.hidden = false;
    errorText.textContent = message;
  };

  const renderPreview = (items) => {
    parsedItems = items;
    list.replaceChildren();

    items.forEach((item, index) => {
      const row = document.createElement("label");
      row.className = "chrome-import-row";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = true;
      checkbox.dataset.index = String(index);

      const text = document.createElement("div");
      text.className = "chrome-import-row-text";

      const title = document.createElement("div");
      title.className = "chrome-import-row-title";
      title.textContent = item.title;

      const url = document.createElement("div");
      url.className = "chrome-import-row-url";
      url.textContent = item.url;

      text.appendChild(title);
      text.appendChild(url);
      row.appendChild(checkbox);
      row.appendChild(text);
      list.appendChild(row);
    });

    summary.textContent =
      items.length === 1
        ? t.chromeImportFoundOne || "Found 1 shortcut."
        : (t.chromeImportFoundMany || "Found {count} shortcuts.").replace(
            "{count}",
            String(items.length),
          );

    introSection.hidden = true;
    errorSection.hidden = true;
    previewSection.hidden = false;
  };

  const handleFile = async (file) => {
    if (!file) return;

    let preferences;
    try {
      preferences = JSON.parse(await file.text());
    } catch {
      showError(t.chromeImportInvalidFile || "This doesn't look like a Chrome Preferences file.");
      return;
    }

    const items = parseChromePreferences(preferences);
    if (items === null) {
      showError(t.chromeImportInvalidFile || "This doesn't look like a Chrome Preferences file.");
      return;
    }
    if (!items.length) {
      showError(t.chromeImportNoShortcuts || "No shortcuts were found in this profile.");
      return;
    }

    renderPreview(items);
  };

  openBtn.addEventListener("click", () => {
    fileInput.value = "";
    parsedItems = [];
    list.replaceChildren();
    showIntro();
    dialog.open();
  });

  closeBtn.addEventListener("click", () => dialog.close());
  cancelBtn.addEventListener("click", () => dialog.close());

  dropzone.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      fileInput.click();
    }
  });

  dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropzone.classList.add("dragover");
  });
  dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("dragover");
  });
  dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropzone.classList.remove("dragover");
    handleFile(event.dataTransfer.files[0]);
  });

  fileInput.addEventListener("change", () => {
    handleFile(fileInput.files[0]);
  });

  confirmBtn.addEventListener("click", async () => {
    const checkedIndexes = [...list.querySelectorAll("input[type=checkbox]:checked")].map(
      (checkbox) => Number(checkbox.dataset.index),
    );
    const selected = checkedIndexes.map((index) => parsedItems[index]);
    if (!selected.length) {
      dialog.close();
      return;
    }

    const existingUrls = new Set(shortcuts.map((item) => item.url));
    const toAdd = [];
    selected.forEach((item, index) => {
      if (existingUrls.has(item.url)) return;
      existingUrls.add(item.url);
      toAdd.push({ title: item.title, url: item.url, id: Date.now() + index });
    });

    if (!toAdd.length) {
      dialog.close();
      return;
    }

    const room = Math.max(MAX_SHORTCUTS - shortcuts.length, 0);
    const trimmed = toAdd.slice(0, room);

    if (!trimmed.length) {
      alert(t.shortcutLimitReached || `You can add up to ${MAX_SHORTCUTS} shortcuts.`);
      return;
    }

    if (trimmed.length < toAdd.length) {
      alert(t.shortcutLimitReached || `You can add up to ${MAX_SHORTCUTS} shortcuts.`);
    }

    const nextShortcuts = [...shortcuts, ...trimmed];
    try {
      await saveShortcuts(nextShortcuts);
      shortcuts = nextShortcuts;
      renderGrid();
    } catch (error) {
      showShortcutSaveError(error);
    }

    dialog.close();
  });
}
