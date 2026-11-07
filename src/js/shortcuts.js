let currentPage = 0;
const ITEMS_PER_PAGE = 30;

function renderGrid() {
  const wrapper = document.getElementById("shortcutsWrapper");
  const dotContainer = document.getElementById("paginationDots");
  wrapper.innerHTML = "";
  dotContainer.innerHTML = "";

  const addButtonSlots = shortcuts.length < MAX_SHORTCUTS ? 1 : 0;
  const totalPages =
    Math.ceil((shortcuts.length + addButtonSlots) / ITEMS_PER_PAGE) || 1;

  if (currentPage >= totalPages) currentPage = totalPages - 1;

  for (let i = 0; i < totalPages; i++) {
    const pageDiv = document.createElement("div");
    pageDiv.className = "shortcut-page";
    pageDiv.dataset.pageIndex = i;

    const pageItems = shortcuts.slice(
      i * ITEMS_PER_PAGE,
      (i + 1) * ITEMS_PER_PAGE,
    );

    pageItems.forEach((item) => {
      pageDiv.appendChild(createItemEl(item));
    });

    if (
      shortcuts.length < MAX_SHORTCUTS &&
      i === totalPages - 1 &&
      pageItems.length < ITEMS_PER_PAGE
    ) {
      pageDiv.appendChild(createAddBtn());
    }

    wrapper.appendChild(pageDiv);

    if (totalPages > 1) {
      const dot = document.createElement("div");
      dot.className = `dot ${i === currentPage ? "active" : ""}`;
      dot.onclick = () => goToPage(i);
      dotContainer.appendChild(dot);
    }
  }
  wrapper.style.transform = `translateX(-${currentPage * 100}%)`;
}

function createItemEl(item) {
  return item.type === "folder" ? createFolderEl(item) : createLinkEl(item);
}

function createLinkEl(item) {
  const container = document.createElement("div");
  container.className = "shortcut-item-container draggable-item";
  container.draggable = true;
  container.dataset.id = item.id;

  const a = document.createElement("a");
  a.className = "shortcut-item";
  a.href = item.url;

  // Suppress the click that would otherwise fire right after a drag/drop.
  a.onclick = (e) => {
    if (container.classList.contains("dragging")) {
      e.preventDefault();
    }
  };

  const iconCircle = document.createElement("div");
  iconCircle.className = "icon-circle";
  iconCircle.appendChild(createFaviconImg(item));

  const titleDiv = document.createElement("div");
  titleDiv.className = "shortcut-title";
  titleDiv.textContent = item.title;

  a.appendChild(iconCircle);
  a.appendChild(titleDiv);
  container.appendChild(a);

  const moreBtn = document.createElement("button");
  moreBtn.className = "more-options-btn";
  moreBtn.innerHTML = '<span class="material-icons">more_vert</span>';
  container.appendChild(moreBtn);

  const menu = document.createElement("div");
  menu.className = "shortcut-menu";

  const editMenu = document.createElement("div");
  editMenu.className = "menu-item";
  editMenu.textContent = t.menuEdit;
  editMenu.onclick = (e) => {
    e.stopPropagation();
    closeAllMenus();
    openEditModal(item);
  };

  const deleteMenu = document.createElement("div");
  deleteMenu.className = "menu-item";
  deleteMenu.textContent = t.menuDelete;
  deleteMenu.onclick = (e) => {
    e.stopPropagation();
    closeAllMenus();
    deleteShortcut(item.id);
  };

  menu.appendChild(editMenu);
  menu.appendChild(deleteMenu);
  container.appendChild(menu);

  moreBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const isShowing = menu.classList.contains("show");
    closeAllMenus();
    if (!isShowing) menu.classList.add("show");
  });

  attachDragAndDrop(container);

  return container;
}

const FOLDER_ICON_MIN_SIZE = 56;
const FOLDER_ICON_MAX_SIZE = 80;
const FOLDER_ICON_GROWTH_PER_ITEM = 3;
const FOLDER_PREVIEW_MAX_ITEMS = 9;

function folderIconSize(itemCount) {
  return Math.min(
    FOLDER_ICON_MAX_SIZE,
    FOLDER_ICON_MIN_SIZE + Math.max(0, itemCount - 1) * FOLDER_ICON_GROWTH_PER_ITEM,
  );
}

function createFolderPreview(item) {
  const grid = document.createElement("div");
  const gridSize = item.items.length > 4 ? 3 : 2;
  grid.className = `folder-preview-grid folder-preview-grid-${gridSize}`;

  item.items.slice(0, FOLDER_PREVIEW_MAX_ITEMS).forEach((child) => {
    const cell = document.createElement("div");
    cell.className = "folder-preview-cell";
    cell.appendChild(createFaviconImg(child));
    grid.appendChild(cell);
  });

  return grid;
}

function createFolderEl(item) {
  const container = document.createElement("div");
  container.className = "shortcut-item-container draggable-item folder-item";
  container.draggable = true;
  container.dataset.id = item.id;

  const tile = document.createElement("div");
  tile.className = "shortcut-item";
  tile.setAttribute("role", "button");
  tile.setAttribute("tabindex", "0");

  const iconCircle = document.createElement("div");
  iconCircle.className = "icon-circle folder-icon-circle";
  const iconSize = folderIconSize(item.items.length);
  iconCircle.style.width = `${iconSize}px`;
  iconCircle.style.height = `${iconSize}px`;
  iconCircle.appendChild(createFolderPreview(item));

  const titleDiv = document.createElement("div");
  titleDiv.className = "shortcut-title";
  titleDiv.textContent = item.title;

  tile.appendChild(iconCircle);
  tile.appendChild(titleDiv);
  container.appendChild(tile);

  const openThisFolder = () => {
    if (container.classList.contains("dragging")) return;
    openFolder(item.id);
  };
  tile.addEventListener("click", openThisFolder);
  tile.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openThisFolder();
    }
  });

  const moreBtn = document.createElement("button");
  moreBtn.className = "more-options-btn";
  moreBtn.innerHTML = '<span class="material-icons">more_vert</span>';
  container.appendChild(moreBtn);

  const menu = document.createElement("div");
  menu.className = "shortcut-menu";

  const renameMenu = document.createElement("div");
  renameMenu.className = "menu-item";
  renameMenu.textContent = "Rename";
  renameMenu.onclick = (e) => {
    e.stopPropagation();
    closeAllMenus();
    openFolder(item.id, { focusName: true });
  };

  const ungroupMenu = document.createElement("div");
  ungroupMenu.className = "menu-item";
  ungroupMenu.textContent = "Ungroup";
  ungroupMenu.onclick = (e) => {
    e.stopPropagation();
    closeAllMenus();
    ungroupFolder(item.id);
  };

  const deleteMenu = document.createElement("div");
  deleteMenu.className = "menu-item";
  deleteMenu.textContent = "Delete";
  deleteMenu.onclick = (e) => {
    e.stopPropagation();
    closeAllMenus();
    deleteFolder(item.id);
  };

  menu.appendChild(renameMenu);
  menu.appendChild(ungroupMenu);
  menu.appendChild(deleteMenu);
  container.appendChild(menu);

  moreBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const isShowing = menu.classList.contains("show");
    closeAllMenus();
    if (!isShowing) menu.classList.add("show");
  });

  attachDragAndDrop(container);

  return container;
}

function createAddBtn() {
  const container = document.createElement("div");
  container.className = "shortcut-item-container add-btn-container";

  const addBtn = document.createElement("div");
  addBtn.className = "shortcut-item";
  addBtn.innerHTML = `
        <div class="icon-circle">
            <span class="material-icons" style="color:var(--text-main)">add</span>
        </div>
        <div class="shortcut-title">${t.addShortcutTitle}</div>
    `;
  addBtn.addEventListener("click", openAddModal);
  container.appendChild(addBtn);
  return container;
}

async function reorderAndSave() {
  const newShortcuts = [];
  const allItems = document.querySelectorAll(
    ".shortcut-item-container.draggable-item",
  );

  allItems.forEach((el) => {
    const id = Number(el.dataset.id);
    const originalItem = shortcuts.find((s) => s.id === id);
    if (originalItem) {
      newShortcuts.push(originalItem);
    }
  });

  try {
    await saveShortcuts(newShortcuts);
    shortcuts = newShortcuts;
  } catch (error) {
    showShortcutSaveError(error);
  }
  renderGrid(); // Also restores the saved order when persistence fails.
}

function closeAllMenus() {
  document
    .querySelectorAll(".shortcut-menu.show")
    .forEach((menu) => menu.classList.remove("show"));
}

async function deleteShortcut(id) {
  if (confirm(t.menuDeleteConfirm || t.menuDelete + "?")) {
    const nextShortcuts = shortcuts.filter((item) => item.id !== id);
    try {
      await saveShortcuts(nextShortcuts);
      shortcuts = nextShortcuts;
    } catch (error) {
      showShortcutSaveError(error);
    }
    renderGrid();
  }
}

// --- Folders ---

function findFolder(folderId) {
  return shortcuts.find(
    (item) => item.id === folderId && item.type === "folder",
  );
}

async function mergeShortcutsIntoFolder(draggedId, targetId) {
  if (draggedId === targetId) return;

  const draggedItemData = shortcuts.find((item) => item.id === draggedId);
  const targetItemData = shortcuts.find((item) => item.id === targetId);
  if (!draggedItemData || !targetItemData) return;

  // Folders can't be merged into anything — dragdrop.js already prevents
  // this hover state, but guard here too since this mutates saved state.
  if (draggedItemData.type === "folder") return;

  let nextShortcuts = shortcuts.filter((item) => item.id !== draggedId);

  if (targetItemData.type === "folder") {
    nextShortcuts = nextShortcuts.map((item) =>
      item.id === targetId
        ? { ...item, items: [...item.items, draggedItemData] }
        : item,
    );
  } else {
    const newFolder = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      type: "folder",
      title: "New Folder",
      items: [targetItemData, draggedItemData],
    };
    const insertIndex = nextShortcuts.findIndex((item) => item.id === targetId);
    nextShortcuts[insertIndex] = newFolder;
  }

  try {
    await saveShortcuts(nextShortcuts);
    shortcuts = nextShortcuts;
  } catch (error) {
    showShortcutSaveError(error);
  }
  renderGrid();
}

let openFolderId = null;
let folderDialogController = null;
let draggedFolderChild = null;

function setupFolderModal() {
  const modal = document.getElementById("folderModal");
  const nameInput = document.getElementById("folderNameInput");
  const closeBtn = document.getElementById("closeFolderBtn");

  folderDialogController = createSlidingDialog(modal);

  closeBtn.addEventListener("click", () => folderDialogController.close());

  modal.addEventListener("close", () => {
    openFolderId = null;
  });

  nameInput.addEventListener("change", () => {
    if (openFolderId) renameFolder(openFolderId, nameInput.value);
  });

  nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      nameInput.blur();
    }
  });
}

function openFolder(folderId, opts = {}) {
  const folder = findFolder(folderId);
  if (!folder) return;

  openFolderId = folderId;
  renderFolderModal(folder);
  folderDialogController.open();

  if (opts.focusName) {
    requestAnimationFrame(() => {
      const input = document.getElementById("folderNameInput");
      input.focus();
      input.select();
    });
  }
}

function closeFolderModal() {
  folderDialogController?.close();
}

function renderFolderModal(folder) {
  document.getElementById("folderNameInput").value = folder.title;

  const grid = document.getElementById("folderGrid");
  grid.innerHTML = "";

  if (!folder.items.length) {
    const empty = document.createElement("div");
    empty.className = "folder-grid-empty";
    empty.textContent = "Drag shortcuts here to add them";
    grid.appendChild(empty);
    return;
  }

  folder.items.forEach((child) => {
    grid.appendChild(createFolderChildEl(folder.id, child));
  });
}

function createFolderChildEl(folderId, child) {
  const container = document.createElement("div");
  container.className = "shortcut-item-container folder-child-item";
  container.draggable = true;
  container.dataset.id = child.id;

  const a = document.createElement("a");
  a.className = "shortcut-item";
  a.href = child.url;
  a.onclick = (e) => {
    if (container.classList.contains("dragging")) e.preventDefault();
  };

  const iconCircle = document.createElement("div");
  iconCircle.className = "icon-circle";
  iconCircle.appendChild(createFaviconImg(child));

  const titleDiv = document.createElement("div");
  titleDiv.className = "shortcut-title";
  titleDiv.textContent = child.title;

  a.appendChild(iconCircle);
  a.appendChild(titleDiv);
  container.appendChild(a);

  const moreBtn = document.createElement("button");
  moreBtn.className = "more-options-btn";
  moreBtn.innerHTML = '<span class="material-icons">more_vert</span>';
  container.appendChild(moreBtn);

  const menu = document.createElement("div");
  menu.className = "shortcut-menu";

  const removeMenu = document.createElement("div");
  removeMenu.className = "menu-item";
  removeMenu.textContent = "Remove from folder";
  removeMenu.onclick = (e) => {
    e.stopPropagation();
    closeAllMenus();
    removeItemFromFolder(folderId, child.id);
  };

  const deleteMenu = document.createElement("div");
  deleteMenu.className = "menu-item";
  deleteMenu.textContent = "Delete";
  deleteMenu.onclick = (e) => {
    e.stopPropagation();
    closeAllMenus();
    deleteItemInFolder(folderId, child.id);
  };

  menu.appendChild(removeMenu);
  menu.appendChild(deleteMenu);
  container.appendChild(menu);

  moreBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const isShowing = menu.classList.contains("show");
    closeAllMenus();
    if (!isShowing) menu.classList.add("show");
  });

  attachFolderChildDragAndDrop(container, folderId);

  return container;
}

function attachFolderChildDragAndDrop(container, folderId) {
  container.addEventListener("dragstart", () => {
    draggedFolderChild = container;
    setTimeout(() => container.classList.add("dragging"), 0);
  });

  container.addEventListener("dragend", () => {
    container.classList.remove("dragging");
    if (draggedFolderChild) {
      draggedFolderChild = null;
      reorderFolderAndSave(folderId);
    }
  });

  container.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (!draggedFolderChild || draggedFolderChild === container) return;

    const rect = container.getBoundingClientRect();
    const isRight = e.clientX - (rect.left + rect.width / 2) > 0;
    const grid = document.getElementById("folderGrid");

    const nextSibling = container.nextSibling;
    const prevSibling = container.previousSibling;

    let shouldMove = false;
    if (isRight && nextSibling !== draggedFolderChild) shouldMove = true;
    else if (!isRight && prevSibling !== draggedFolderChild) shouldMove = true;

    if (shouldMove) {
      animateDOMMove(grid, () => {
        if (isRight) grid.insertBefore(draggedFolderChild, container.nextSibling);
        else grid.insertBefore(draggedFolderChild, container);
      });
    }
  });
}

async function reorderFolderAndSave(folderId) {
  const folder = findFolder(folderId);
  if (!folder) return;

  const orderedIds = [
    ...document.querySelectorAll("#folderGrid .folder-child-item"),
  ].map((el) => Number(el.dataset.id));
  const newItems = orderedIds
    .map((id) => folder.items.find((item) => item.id === id))
    .filter(Boolean);

  const nextShortcuts = shortcuts.map((item) =>
    item.id === folderId ? { ...item, items: newItems } : item,
  );

  try {
    await saveShortcuts(nextShortcuts);
    shortcuts = nextShortcuts;
  } catch (error) {
    showShortcutSaveError(error);
  }
  renderFolderModal(findFolder(folderId));
  renderGrid(); // Folder preview thumbnails reflect the new order too.
}

async function removeItemFromFolder(folderId, itemId) {
  const folder = findFolder(folderId);
  if (!folder) return;

  if (shortcuts.length >= MAX_SHORTCUTS) {
    alert(
      `You can add up to ${MAX_SHORTCUTS} shortcuts. Delete one first to make room.`,
    );
    return;
  }

  const removedItem = folder.items.find((item) => item.id === itemId);
  if (!removedItem) return;

  const remainingItems = folder.items.filter((item) => item.id !== itemId);

  // An empty folder left behind is just clutter — drop it along with the
  // item's removal instead of leaving a folder with nothing in it.
  let nextShortcuts = remainingItems.length
    ? shortcuts.map((item) =>
        item.id === folderId ? { ...item, items: remainingItems } : item,
      )
    : shortcuts.filter((item) => item.id !== folderId);
  nextShortcuts = [...nextShortcuts, removedItem];

  try {
    await saveShortcuts(nextShortcuts);
    shortcuts = nextShortcuts;
  } catch (error) {
    showShortcutSaveError(error);
    return;
  }

  if (remainingItems.length) renderFolderModal(findFolder(folderId));
  else closeFolderModal();
  renderGrid();
}

async function deleteItemInFolder(folderId, itemId) {
  if (!confirm(t.menuDelete + "?")) return;

  const folder = findFolder(folderId);
  if (!folder) return;

  const remainingItems = folder.items.filter((item) => item.id !== itemId);
  const nextShortcuts = remainingItems.length
    ? shortcuts.map((item) =>
        item.id === folderId ? { ...item, items: remainingItems } : item,
      )
    : shortcuts.filter((item) => item.id !== folderId);

  try {
    await saveShortcuts(nextShortcuts);
    shortcuts = nextShortcuts;
  } catch (error) {
    showShortcutSaveError(error);
    return;
  }

  if (remainingItems.length) renderFolderModal(findFolder(folderId));
  else closeFolderModal();
  renderGrid();
}

async function renameFolder(folderId, title) {
  const trimmed = title.trim().slice(0, MAX_TITLE_LENGTH);
  if (!trimmed) return;

  const nextShortcuts = shortcuts.map((item) =>
    item.id === folderId ? { ...item, title: trimmed } : item,
  );

  try {
    await saveShortcuts(nextShortcuts);
    shortcuts = nextShortcuts;
  } catch (error) {
    showShortcutSaveError(error);
    return;
  }
  renderGrid();
}

async function ungroupFolder(folderId) {
  const folder = findFolder(folderId);
  if (!folder) return;

  const index = shortcuts.findIndex((item) => item.id === folderId);
  if (index === -1) return;

  const nextShortcuts = [...shortcuts];
  nextShortcuts.splice(index, 1, ...folder.items);

  if (nextShortcuts.length > MAX_SHORTCUTS) {
    alert(
      `Can't ungroup: that would leave ${nextShortcuts.length} shortcuts, more than the ${MAX_SHORTCUTS} limit. Delete something first.`,
    );
    return;
  }

  try {
    await saveShortcuts(nextShortcuts);
    shortcuts = nextShortcuts;
  } catch (error) {
    showShortcutSaveError(error);
    return;
  }

  if (openFolderId === folderId) closeFolderModal();
  renderGrid();
}

async function deleteFolder(folderId) {
  const folder = findFolder(folderId);
  if (!folder) return;

  const count = folder.items.length;
  const message = count
    ? `Delete "${folder.title}" and the ${count} shortcut${count === 1 ? "" : "s"} inside it?`
    : `Delete "${folder.title}"?`;
  if (!confirm(message)) return;

  const nextShortcuts = shortcuts.filter((item) => item.id !== folderId);

  try {
    await saveShortcuts(nextShortcuts);
    shortcuts = nextShortcuts;
  } catch (error) {
    showShortcutSaveError(error);
    return;
  }

  if (openFolderId === folderId) closeFolderModal();
  renderGrid();
}

function movePage(step) {
  const totalPages = document.querySelectorAll(".shortcut-page").length;
  const nextPage = currentPage + step;
  if (nextPage >= 0 && nextPage < totalPages) {
    currentPage = nextPage;
    const wrapper = document.getElementById("shortcutsWrapper");
    wrapper.style.transform = `translateX(-${currentPage * 100}%)`;

    document.querySelectorAll(".dot").forEach((dot, idx) => {
      dot.classList.toggle("active", idx === currentPage);
    });
  }
}

function goToPage(index) {
  currentPage = index;
  const wrapper = document.getElementById("shortcutsWrapper");
  wrapper.style.transform = `translateX(-${currentPage * 100}%)`;
  document.querySelectorAll(".dot").forEach((dot, idx) => {
    dot.classList.toggle("active", idx === currentPage);
  });
}

function serializeShortcutForExport(item) {
  if (item.type === "folder") {
    return {
      type: "folder",
      title: item.title,
      items: item.items.map(({ title, url }) => ({ title, url })),
    };
  }
  return { title: item.title, url: item.url };
}

function exportShortcuts() {
  const payload = {
    type: "more-shortcuts-newtab",
    version: 1,
    exportedAt: new Date().toISOString(),
    shortcuts: shortcuts.map(serializeShortcutForExport),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `shortcuts-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function normalizeImportedUrl(url) {
  const trimmed = url.trim();
  return trimmed.startsWith("http://") || trimmed.startsWith("https://")
    ? trimmed
    : `https://${trimmed}`;
}

async function importShortcutsFromFile(file) {
  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    alert(t.importInvalidFile || "This file could not be read as a shortcuts export.");
    return;
  }

  const isValidLink = (item) =>
    item &&
    typeof item.title === "string" &&
    typeof item.url === "string" &&
    item.title.trim() &&
    item.url.trim();

  const isValidFolder = (item) =>
    item &&
    item.type === "folder" &&
    typeof item.title === "string" &&
    item.title.trim() &&
    Array.isArray(item.items) &&
    item.items.length > 0 &&
    item.items.every(isValidLink);

  const imported = Array.isArray(parsed) ? parsed : parsed?.shortcuts;
  const validItems = Array.isArray(imported)
    ? imported.filter((item) => isValidFolder(item) || isValidLink(item))
    : [];

  if (!validItems.length) {
    alert(t.importInvalidFile || "This file could not be read as a shortcuts export.");
    return;
  }

  if (
    !confirm(
      t.importConfirm ||
        "This will replace your current shortcuts. Continue?",
    )
  )
    return;

  const nextShortcuts = validItems.slice(0, MAX_SHORTCUTS).map((item, index) => {
    const baseId = Date.now() + index;

    if (item.type === "folder") {
      return {
        id: baseId,
        type: "folder",
        title: item.title.trim().slice(0, MAX_TITLE_LENGTH),
        items: item.items.map((child, childIndex) => ({
          id: baseId + 1000 + childIndex,
          title: child.title.trim().slice(0, MAX_TITLE_LENGTH),
          url: normalizeImportedUrl(child.url),
        })),
      };
    }

    return {
      id: baseId,
      title: item.title.trim().slice(0, MAX_TITLE_LENGTH),
      url: normalizeImportedUrl(item.url),
    };
  });

  try {
    await saveShortcuts(nextShortcuts);
    shortcuts = nextShortcuts;
  } catch (error) {
    showShortcutSaveError(error);
  }
  currentPage = 0;
  renderGrid();
}
