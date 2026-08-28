let editingItemId = null;

function setupAddModal() {
  const modal = document.getElementById("addModal");
  const form = document.getElementById("addForm");
  const urlInput = document.getElementById("modalUrl");
  const titleInput = document.getElementById("modalTitle");

  document.getElementById("cancelBtn").onclick = () => modal.close();

  let titleFetchTimeout = null;
  let isFetchingTitle = false;

  const fetchPageTitle = async () => {
    if (isFetchingTitle || titleInput.value.trim()) return;
    let url = urlInput.value.trim();
    if (!url) return;
    if (!url.startsWith("http://") && !url.startsWith("https://")) url = "https://" + url;
    try { new URL(url); } catch { return; }

    isFetchingTitle = true;
    titleInput.placeholder = t.titleLoadingPlaceholder;
    titleInput.classList.add("title-loading");

    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5000);
      const response = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);
      const text = await response.text();
      const doc = new DOMParser().parseFromString(text, "text/html");
      if (doc.title && !titleInput.value.trim()) titleInput.value = doc.title;
    } catch {}

    isFetchingTitle = false;
    titleInput.placeholder = t.titleInputPlaceholder;
    titleInput.classList.remove("title-loading");
  };

  // Auto-fetch the title once typing in the URL field pauses for 600ms.
  urlInput.addEventListener("input", () => {
    clearTimeout(titleFetchTimeout);
    const url = urlInput.value.trim();
    if (!url || titleInput.value.trim() || !url.includes(".")) return;
    titleFetchTimeout = setTimeout(fetchPageTitle, 600);
  });

  // Fetch immediately when leaving the URL field.
  urlInput.addEventListener("blur", () => {
    clearTimeout(titleFetchTimeout);
    fetchPageTitle();
  });

  form.onsubmit = async (e) => {
    e.preventDefault();
    const title = titleInput.value;
    let url = urlInput.value;
    const submitBtn = document.getElementById("submitBtn");

    if (!url.startsWith("http://") && !url.startsWith("https://"))
      url = "https://" + url;

    if (title && url) {
      let nextShortcuts;

      if (editingItemId) {
        nextShortcuts = shortcuts.map((item) =>
          item.id === editingItemId ? { ...item, title, url } : item,
        );
      } else {
        if (shortcuts.length >= MAX_SHORTCUTS) {
          alert(
            t.shortcutLimitReached ||
              `You can add up to ${MAX_SHORTCUTS} shortcuts.`,
          );
          modal.close();
          renderGrid();
          return;
        }

        nextShortcuts = [...shortcuts, {
          title,
          url,
          id: Date.now() + Math.floor(Math.random() * 1000),
        }];
      }

      submitBtn.disabled = true;
      try {
        await saveShortcuts(nextShortcuts);
        shortcuts = nextShortcuts;
        renderGrid();
        modal.close();
      } catch (error) {
        showShortcutSaveError(error);
      } finally {
        submitBtn.disabled = false;
      }
    }
  };
}

function openAddModal() {
  if (shortcuts.length >= MAX_SHORTCUTS) {
    alert(
      t.shortcutLimitReached ||
        `You can add up to ${MAX_SHORTCUTS} shortcuts.`,
    );
    return;
  }

  editingItemId = null;
  document.getElementById("modalHeader").textContent = t.modalHeaderAdd;
  document.getElementById("submitBtn").textContent = t.addBtnLabel;
  document.getElementById("modalTitle").value = "";
  document.getElementById("modalUrl").value = "";
  document.getElementById("addModal").showModal();
}

function openEditModal(item) {
  editingItemId = item.id;
  document.getElementById("modalHeader").textContent = t.modalHeaderEdit;
  document.getElementById("submitBtn").textContent = t.saveBtnLabel;
  document.getElementById("modalTitle").value = item.title;
  document.getElementById("modalUrl").value = item.url;
  document.getElementById("addModal").showModal();
}
