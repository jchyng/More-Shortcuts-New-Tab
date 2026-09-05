document.addEventListener("DOMContentLoaded", () => {
  initLanguagePicker();
  applyLocalization();
  initTheme();
  initCustomize();
  reconcilePrefs(applyChangedPref);
  loadBackground();
  updateClock();
  setInterval(updateClock, 1000);
  initShortcuts();
  setupSearch();
  setupAddModal();
  setupChromeImport();

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
      if (e.key === "ArrowRight") movePage(1);
      if (e.key === "ArrowLeft") movePage(-1);

      if (e.key === "/" && document.activeElement !== searchInput) {
        e.preventDefault();
        searchInput.focus();
      }
    }

    if (e.key === "Escape" && document.activeElement === searchInput) {
      searchInput.blur();
    }
  });

  document.addEventListener("dragover", handleGlobalDragOver);
});
