let draggedItem = null;
let lastPageSwitchTime = 0;

function attachDragAndDrop(container) {
  container.addEventListener("dragstart", (e) => {
    draggedItem = container;

    // Add a class to body so CSS can suppress hover effects while dragging.
    document.body.classList.add("is-dragging");

    // 1. Compute cursor offset within the item.
    const rect = container.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    // 2. Build a drag ghost image (clone).
    const ghost = container.cloneNode(true);

    ghost.style.position = "absolute";
    ghost.style.top = "-9999px";
    ghost.style.left = "-9999px";
    ghost.style.width = "112px";
    ghost.style.height = "112px";

    // Match the hover background so the ghost looks consistent.
    ghost.style.background = "var(--hover-bg)";
    ghost.style.borderRadius = "8px";

    ghost.classList.remove("dragging");

    document.body.appendChild(ghost);

    // 3. Use the ghost as the custom drag image.
    e.dataTransfer.setDragImage(ghost, offsetX, offsetY);
    e.dataTransfer.effectAllowed = "move";

    // 4. Mark the original as dragging and discard the ghost.
    setTimeout(() => {
      container.classList.add("dragging");
      document.body.removeChild(ghost);
    }, 0);
  });

  container.addEventListener("dragend", () => {
    document.body.classList.remove("is-dragging");

    container.classList.remove("dragging");
    draggedItem = null;
    reorderAndSave();
  });

  // Dragging over another item: swap position and rebalance pages.
  container.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (!draggedItem || draggedItem === container) return;

    const pageDiv = container.parentElement;
    const wrapper = document.getElementById("shortcutsWrapper");

    const bounding = container.getBoundingClientRect();
    const offset = bounding.x + bounding.width / 2;
    const isRight = e.clientX - offset > 0;

    const nextSibling = container.nextSibling;
    const prevSibling = container.previousSibling;

    let shouldMove = false;
    if (isRight && nextSibling !== draggedItem) shouldMove = true;
    else if (!isRight && prevSibling !== draggedItem) shouldMove = true;

    if (shouldMove) {
      // Animate against the whole wrapper so moves across pages animate too.
      animateDOMMove(wrapper, () => {
        if (isRight) {
          pageDiv.insertBefore(draggedItem, container.nextSibling);
        } else {
          pageDiv.insertBefore(draggedItem, container);
        }

        balanceGrid();
      });
    }
  });
}

// Handles page switching (edge scrolling) while dragging over empty space.
function handleGlobalDragOver(e) {
  e.preventDefault();
  if (!draggedItem) return;

  const screenWidth = window.innerWidth;
  const edgeThreshold = 80;
  const now = Date.now();

  // 0.8s cooldown between page switches.
  if (now - lastPageSwitchTime > 800) {
    if (e.clientX < edgeThreshold) {
      if (currentPage > 0) {
        movePage(-1);
        lastPageSwitchTime = now;
        moveDraggedItemToCurrentPage();
      }
    } else if (e.clientX > screenWidth - edgeThreshold) {
      const totalPages = document.querySelectorAll(".shortcut-page").length;
      if (currentPage < totalPages - 1) {
        movePage(1);
        lastPageSwitchTime = now;
        moveDraggedItemToCurrentPage();
      }
    }
  }
}

// Moves the dragged item onto the page that just became active.
function moveDraggedItemToCurrentPage() {
  if (!draggedItem) return;
  const pages = document.querySelectorAll(".shortcut-page");
  const targetPage = pages[currentPage];

  // Insert before the add button if present, otherwise append.
  const addBtn = targetPage.querySelector(".add-btn-container");
  if (addBtn) {
    targetPage.insertBefore(draggedItem, addBtn);
  } else {
    targetPage.appendChild(draggedItem);
  }
}

// FLIP-style animation: record positions, run the DOM change, animate the delta.
function animateDOMMove(container, moveAction) {
  const items = [...container.querySelectorAll(".shortcut-item-container")];
  const positions = new Map();

  items.forEach((item) => {
    if (item.getBoundingClientRect().width > 0) {
      const rect = item.getBoundingClientRect();
      positions.set(item, { left: rect.left, top: rect.top });
    }
  });

  moveAction();

  items.forEach((item) => {
    const oldPos = positions.get(item);
    if (!oldPos || item.getBoundingClientRect().width === 0) return;

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

// Keeps item counts balanced across pages after a drag reorder.
function balanceGrid() {
  const pages = document.querySelectorAll(".shortcut-page");

  for (let i = 0; i < pages.length - 1; i++) {
    const currentPageEl = pages[i];
    const nextPage = pages[i + 1];

    const currentItems = [...currentPageEl.querySelectorAll(".draggable-item")];
    const nextItems = [...nextPage.querySelectorAll(".draggable-item")];

    // Only pull from the next page when this one has room; pushing overflow
    // (>30 items) is left to CSS and gets cleaned up once the drag ends.
    if (currentItems.length < ITEMS_PER_PAGE && nextItems.length > 0) {
      let moveCandidate = nextItems[0];

      if (moveCandidate.classList.contains("dragging") && nextItems.length > 1) {
        moveCandidate = nextItems[1];
      }

      if (!moveCandidate.classList.contains("dragging")) {
        const addBtn = currentPageEl.querySelector(".add-btn-container");
        if (addBtn) currentPageEl.insertBefore(moveCandidate, addBtn);
        else currentPageEl.appendChild(moveCandidate);
      }
    }
  }
}
