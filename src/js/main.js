// --- English UI copy ---
// Keep all user-facing text in one place so the new tab stays English-only.
const t = {
  searchPlaceholder: "Search Google or type a URL",
  addShortcutTitle: "Add Shortcut",
  shortcutLimitReached: "You can add up to 30 shortcuts.",
  shortcutSaveError:
    "Could not save your changes. Your previous shortcuts are still intact.",
  editShortcutTitle: "Edit Shortcut",
  addBtnLabel: "Add",
  saveBtnLabel: "Save",
  cancelBtnLabel: "Cancel",
  modalHeaderAdd: "Add Shortcut",
  modalHeaderEdit: "Edit Shortcut",
  nameLabel: "Name",
  urlLabel: "URL",
  themeTitle: "Toggle Theme",
  imgSearchTitle: "Image Search",
  aiModeTitle: "AI Search Mode",
  menuEdit: "Edit",
  menuDelete: "Delete",
  titleLoadingPlaceholder: "Fetching name...",
  titleInputPlaceholder: "e.g. YouTube",
  aiModeBtnText: "AI Mode",
};

document.addEventListener("DOMContentLoaded", () => {
  applyEnglishText();
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

function applyEnglishText() {
  document.documentElement.lang = "en";
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
