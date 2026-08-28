let shortcuts = [];
const MAX_SHORTCUTS = 30;

async function initShortcuts() {
  const result = await chrome.storage.sync.get(["myShortcuts"]);
  shortcuts = result.myShortcuts ?? [];
  renderGrid();
}

async function saveShortcuts(nextShortcuts) {
  await chrome.storage.sync.set({ myShortcuts: nextShortcuts });
}

function showShortcutSaveError(error) {
  console.error("Could not save shortcuts:", error);
  alert(
    t.shortcutSaveError ||
      "Could not save your changes. Your previous shortcuts are still intact.",
  );
}
