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

    // Add the "+" button to the last page if there's room.
    if (
      shortcuts.length < MAX_SHORTCUTS &&
      i === totalPages - 1 &&
      pageItems.length < ITEMS_PER_PAGE
    ) {
      pageDiv.appendChild(createAddBtn());
    }

    wrapper.appendChild(pageDiv);

    // Pagination dots only show once there's more than one page.
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
  const container = document.createElement("div");
  container.className = "shortcut-item-container draggable-item";
  container.draggable = true;
  container.dataset.id = item.id;

  const a = document.createElement("a");
  a.className = "shortcut-item";
  a.href = item.url;

  // Suppress the click that would otherwise fire right after a drag/drop.
  a.onclick = (e) => {
    if (
      container.classList.contains("dragging") ||
      container.classList.contains("dropped")
    ) {
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
  if (confirm(t.menuDelete + "?")) {
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
