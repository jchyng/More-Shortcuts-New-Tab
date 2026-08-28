// --- Localization ---
// Reads from Chrome's standard i18n (_locales/<lang>/messages.json).
// chrome.i18n.getMessage() picks the message matching Chrome's display
// language, falling back to manifest.json's default_locale otherwise.
// Wrapped in a thin Proxy so call sites can keep using t.xxx.
const t = new Proxy({}, { get: (_, key) => chrome.i18n.getMessage(key) });

document.addEventListener("DOMContentLoaded", () => {
  applyLocalization();
  initTheme();
  initCustomize();
  loadBackground();
  updateClock();
  setInterval(updateClock, 1000);
  initShortcuts();
  setupSearch();
  setupAddModal();

  document.addEventListener("click", (e) => {
    if (
      !e.target.closest(".more-options-btn") &&
      !e.target.closest(".shortcut-menu")
    ) {
      closeAllMenus();
    }
  });

  document.addEventListener("keydown", (e) => {
    const modal = document.getElementById("addModal");
    const searchInput = document.getElementById("searchInput");
    if (!modal.open && !draggedItem) {
      // Don't move pages while an item is being dragged.
      if (e.key === "ArrowRight") movePage(1);
      if (e.key === "ArrowLeft") movePage(-1);

      // Focus the search box with "/" (unless already focused on an input).
      if (e.key === "/" && document.activeElement !== searchInput) {
        e.preventDefault();
        searchInput.focus();
      }
    }

    // Blur the search box on Escape.
    if (e.key === "Escape" && document.activeElement === searchInput) {
      searchInput.blur();
    }
  });

  // Handle dragging outside the page area (e.g. edge scrolling).
  document.addEventListener("dragover", handleGlobalDragOver);
});

function applyLocalization() {
  document.documentElement.lang = chrome.i18n.getUILanguage();
  document.getElementById("searchInput").placeholder = t.searchPlaceholder;
  document.getElementById("themeToggle").title = t.themeTitle;
  document.getElementById("imageSearchBtn").title = t.imgSearchTitle;
  document.getElementById("aiModeBtn").title = t.aiModeTitle;
  document.querySelector("#aiModeBtn .btn-text").textContent = t.aiModeBtnText;
  document.querySelector('#addModal label[for="modalTitle"]').textContent =
    t.nameLabel;
  document.getElementById("modalTitle").placeholder = t.titleInputPlaceholder;
  document.querySelector('#addModal label[for="modalUrl"]').textContent =
    t.urlLabel;
  document.getElementById("cancelBtn").textContent = t.cancelBtnLabel;
}
