let shortcuts = [];
let currentPage = 0;
const ITEMS_PER_PAGE = 30;
let editingItemId = null;

const FAVICON_CACHE_PREFIX = "fav_";

// Chrome /_favicon/ 기본 아이콘 hex 지문 — 한 번만 fetch하고 재사용
let _chromeDefaultHexPromise = null;
async function getChromeFaviconDefaultHex() {
  if (!_chromeDefaultHexPromise) {
    _chromeDefaultHexPromise = (async () => {
      try {
        const src = `/_favicon/?pageUrl=${encodeURIComponent("https://xn--not-a-real-domain-xyz.invalid")}&size=64`;
        const buf = await fetch(src).then(r => r.arrayBuffer());
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
      } catch { return null; }
    })();
  }
  return _chromeDefaultHexPromise;
}

// --- 다국어 지원 ---
const translations = {
  ko: {
    searchPlaceholder: "Google 검색 또는 URL 입력",
    addShortcutTitle: "바로가기 추가",
    editShortcutTitle: "바로가기 수정",
    addBtnLabel: "추가",
    saveBtnLabel: "저장",
    cancelBtnLabel: "취소",
    modalHeaderAdd: "바로가기 추가",
    modalHeaderEdit: "바로가기 수정",
    nameLabel: "이름",
    urlLabel: "URL",
    themeTitle: "테마 변경",
    imgSearchTitle: "이미지 검색",
    aiModeTitle: "AI 검색 모드",
    menuEdit: "수정",
    menuDelete: "삭제",
    titleLoadingPlaceholder: "이름 자동 입력 중...",
    titleInputPlaceholder: "예: 유튜브",
  },
  en: {
    searchPlaceholder: "Search Google or type a URL",
    addShortcutTitle: "Add Shortcut",
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
  },
};

const userLang = navigator.language.startsWith("ko") ? "ko" : "en";
const t = translations[userLang];

// --- DnD 및 페이지 전환 관련 변수 ---
let draggedItem = null; // 드래그 중인 DOM 요소
let lastPageSwitchTime = 0; // 페이지 전환 쿨타임 체크용

document.addEventListener("DOMContentLoaded", () => {
  applyLocalization();
  initTheme();
  updateClock();
  setInterval(updateClock, 1000);
  initShortcuts();
  setupSearch();
  setupAddModal();

  // 전역 클릭: 메뉴 닫기
  document.addEventListener("click", (e) => {
    if (
      !e.target.closest(".more-options-btn") &&
      !e.target.closest(".shortcut-menu")
    ) {
      closeAllMenus();
    }
  });

  // 키보드 네비게이션
  document.addEventListener("keydown", (e) => {
    const modal = document.getElementById("addModal");
    const searchInput = document.getElementById("searchInput");
    if (!modal.open && !draggedItem) {
      // 드래그 중엔 키보드 이동 막기
      if (e.key === "ArrowRight") movePage(1);
      if (e.key === "ArrowLeft") movePage(-1);

      // "/" 키로 검색창 포커스 (입력 필드에 포커스 중이 아닐 때)
      if (e.key === "/" && document.activeElement !== searchInput) {
        e.preventDefault();
        searchInput.focus();
      }
    }

    // Escape 키로 검색창 포커스 해제
    if (e.key === "Escape" && document.activeElement === searchInput) {
      searchInput.blur();
    }
  });

  // 드래그 중 페이지 영역 밖으로 나갔을 때 처리 (선택 사항)
  document.addEventListener("dragover", handleGlobalDragOver);
});

// --- UI 텍스트 적용 ---
function applyLocalization() {
  document.getElementById("searchInput").placeholder = t.searchPlaceholder;
  document.getElementById("themeToggle").title = t.themeTitle;
  document.getElementById("imageSearchBtn").title = t.imgSearchTitle;
  document.getElementById("aiModeBtn").title = t.aiModeTitle;
  document.querySelector('#addModal label[for="modalTitle"]').textContent =
    t.nameLabel;
  document.getElementById("modalTitle").placeholder = t.titleInputPlaceholder;
  document.querySelector('#addModal label[for="modalUrl"]').textContent =
    t.urlLabel;
  document.getElementById("cancelBtn").textContent = t.cancelBtnLabel;
}

// --- 시계 ---
function updateClock() {
  const now = new Date();
  const timeString = now.toLocaleTimeString(navigator.language, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateString = now.toLocaleDateString(navigator.language, {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
  document.getElementById("digitalClock").textContent = timeString;
  document.getElementById("dateText").textContent = dateString;
}

/* --- 테마 관리 --- */
function initTheme() {
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  const savedTheme = localStorage.getItem("theme") || systemTheme;
  document.body.setAttribute("data-theme", savedTheme);
  updateThemeIcon(savedTheme);
  document.getElementById("themeToggle").addEventListener("click", () => {
    const current = document.body.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.body.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    updateThemeIcon(next);
  });
}
function updateThemeIcon(theme) {
  document.querySelector("#themeToggle span").textContent =
    theme === "dark" ? "light_mode" : "dark_mode";
}

/* --- 데이터 로드 및 저장 --- */
async function initShortcuts() {
  const result = await chrome.storage.sync.get(["myShortcuts"]);
  shortcuts = result.myShortcuts ?? [];
  renderGrid();
}
function saveShortcuts() {
  chrome.storage.sync.set({ myShortcuts: shortcuts });
}

/* --- 그리드 렌더링 --- */
function renderGrid() {
  const wrapper = document.getElementById("shortcutsWrapper");
  const dotContainer = document.getElementById("paginationDots");
  wrapper.innerHTML = "";
  dotContainer.innerHTML = "";

  const totalPages = Math.ceil((shortcuts.length + 1) / ITEMS_PER_PAGE) || 1;

  // 현재 페이지가 전체 페이지보다 크면 조정
  if (currentPage >= totalPages) currentPage = totalPages - 1;

  for (let i = 0; i < totalPages; i++) {
    const pageDiv = document.createElement("div");
    pageDiv.className = "shortcut-page";
    // 드래그 이벤트를 페이지 단위로도 받을 수 있게 (빈 공간 드롭용)
    pageDiv.dataset.pageIndex = i;

    const pageItems = shortcuts.slice(
      i * ITEMS_PER_PAGE,
      (i + 1) * ITEMS_PER_PAGE,
    );

    pageItems.forEach((item) => {
      // 실제 아이템 생성
      pageDiv.appendChild(createItemEl(item));
    });

    // 마지막 페이지에 '+' 버튼 추가
    if (i === totalPages - 1 && pageItems.length < ITEMS_PER_PAGE) {
      pageDiv.appendChild(createAddBtn());
    }

    wrapper.appendChild(pageDiv);

    // 페이지네이션 점 - 2페이지 이상일 때만 표시
    if (totalPages > 1) {
      const dot = document.createElement("div");
      dot.className = `dot ${i === currentPage ? "active" : ""}`;
      dot.onclick = () => goToPage(i);
      dotContainer.appendChild(dot);
    }
  }
  wrapper.style.transform = `translateX(-${currentPage * 100}%)`;
}

// --- Favicon 캐시 헬퍼 ---
async function getCachedFavicon(hostname) {
  const res = await chrome.storage.local.get(FAVICON_CACHE_PREFIX + hostname);
  return res[FAVICON_CACHE_PREFIX + hostname] ?? null;
}

function setCachedFavicon(hostname, dataUrl) {
  chrome.storage.local.set({ [FAVICON_CACHE_PREFIX + hostname]: dataUrl });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function fetchAsBase64(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return blobToBase64(await res.blob());
}

async function validateDataUrl(dataUrl) {
  return new Promise((resolve) => {
    const probe = new Image();
    probe.onload = () => resolve(probe.naturalWidth > 1 && probe.naturalHeight > 1);
    probe.onerror = () => resolve(false);
    probe.src = dataUrl;
  });
}

// --- Favicon 생성 (폴백 체인 포함) ---
function createFaviconImg(item) {
  const img = document.createElement("img");
  img.alt = item.title;

  let hostname;
  try {
    hostname = new URL(item.url).hostname;
  } catch {
    setTimeout(() => showLetterFallback(img, item.title), 0);
    return img;
  }

  img.classList.add("favicon-loading");
  loadFaviconWithFallback(img, item, hostname);
  return img;
}

// img.src를 설정하고 로드 완료 후 로딩 클래스 제거
function applyFavicon(img, dataUrl) {
  img.addEventListener("load",  () => img.classList.remove("favicon-loading"), { once: true });
  img.addEventListener("error", () => img.classList.remove("favicon-loading"), { once: true });
  img.src = dataUrl;
}

async function loadFaviconWithFallback(img, item, hostname) {
  // 1. 로컬 캐시 확인 (이전 fetch 성공 결과)
  const cached = await getCachedFavicon(hostname);
  if (cached) {
    applyFavicon(img, cached);
    return;
  }

  // 2. Chrome 로컬 파비콘 캐시: blob 바이트 비교로 기본 아이콘 여부 감지
  //    /_favicon/ 은 미캐시 도메인에 기본 아이콘(1×1 GIF or 지구본 PNG)을 반환
  //    → 가짜 도메인으로 기본 아이콘 지문을 미리 얻어서 비교
  try {
    const chromeSrc = `/_favicon/?pageUrl=${encodeURIComponent(item.url)}&size=64`;
    const buf = await fetch(chromeSrc).then(r => r.arrayBuffer());
    if (buf.byteLength > 1) {
      const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
      const defaultHex = await getChromeFaviconDefaultHex();
      if (!defaultHex || hex !== defaultHex) {
        // 기본 아이콘과 다름 → 실제 파비콘
        const dataUrl = await blobToBase64(new Blob([buf], { type: "image/png" }));
        setCachedFavicon(hostname, dataUrl);
        applyFavicon(img, dataUrl);
        return;
      }
    }
  } catch {}

  // 3~5. 외부 소스 순서대로 시도, 성공 시 base64로 캐시
  const sources = [
    `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(item.url)}&size=64`,
    `https://${hostname}/favicon.ico`,
    `https://icons.duckduckgo.com/ip3/${hostname}.ico`,
  ];

  for (const src of sources) {
    try {
      const dataUrl = await fetchAsBase64(src);
      if (await validateDataUrl(dataUrl)) {
        setCachedFavicon(hostname, dataUrl);
        applyFavicon(img, dataUrl);
        return;
      }
    } catch {}
  }

  // 6. 글자 fallback
  img.classList.remove("favicon-loading");
  showLetterFallback(img, item.title);
}

function showLetterFallback(img, title) {
  if (!img.parentNode) return;
  const span = document.createElement("span");
  span.className = "favicon-letter";
  span.textContent = (title || "?")[0].toUpperCase();
  img.parentNode.replaceChild(span, img);
}

// --- 아이템 생성 (DnD 포함) ---
function createItemEl(item) {
  const container = document.createElement("div");
  container.className = "shortcut-item-container draggable-item";
  container.draggable = true; // 드래그 가능
  container.dataset.id = item.id; // ID 저장 (재정렬 시 식별용)

  // --- HTML 구조 ---
  const a = document.createElement("a");
  a.className = "shortcut-item";
  a.href = item.url;

  // 드래그 중 클릭 방지
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

  // 더보기 버튼
  const moreBtn = document.createElement("button");
  moreBtn.className = "more-options-btn";
  moreBtn.innerHTML = '<span class="material-icons">more_vert</span>';
  container.appendChild(moreBtn);

  // 메뉴
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

  // --- DnD 이벤트 리스너 ---
  container.addEventListener("dragstart", (e) => {
    draggedItem = container;

    // [핵심 수정] 드래그 시작 시 body에 클래스 추가 -> CSS에서 호버 차단 작동 시작
    document.body.classList.add("is-dragging");

    // 1. 커서 오프셋 계산
    const rect = container.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    // 2. 드래그 고스트 이미지(Clone) 생성
    const ghost = container.cloneNode(true);

    // 스타일 강제 적용
    ghost.style.position = "absolute";
    ghost.style.top = "-9999px";
    ghost.style.left = "-9999px";
    ghost.style.width = "112px";
    ghost.style.height = "112px";

    // Hover 상태와 동일한 배경색 강제 적용
    ghost.style.background = "var(--hover-bg)";
    ghost.style.borderRadius = "8px";

    // 복제된 요소에는 'dragging' 클래스가 없어야 함
    ghost.classList.remove("dragging");

    // DOM에 잠시 추가
    document.body.appendChild(ghost);

    // 3. 커스텀 드래그 이미지 설정
    e.dataTransfer.setDragImage(ghost, offsetX, offsetY);
    e.dataTransfer.effectAllowed = "move";

    // 4. 원본 처리 및 고스트 삭제
    setTimeout(() => {
      container.classList.add("dragging");
      document.body.removeChild(ghost);
    }, 0);
  });

  container.addEventListener("dragend", () => {
    // [핵심 수정] 드래그 종료 시 클래스 제거 -> 호버 기능 복구
    document.body.classList.remove("is-dragging");

    container.classList.remove("dragging");
    draggedItem = null;
    reorderAndSave();
  });

  // 아이템 위로 드래그 시 (자리 교체 + 페이지 균형 맞추기)
  container.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (!draggedItem || draggedItem === container) return;

    const pageDiv = container.parentElement;
    const wrapper = document.getElementById("shortcutsWrapper"); // 전체 영역 기준

    // 마우스 위치 체크
    const bounding = container.getBoundingClientRect();
    const offset = bounding.x + bounding.width / 2;
    const isRight = e.clientX - offset > 0;

    const nextSibling = container.nextSibling;
    const prevSibling = container.previousSibling;

    let shouldMove = false;
    if (isRight && nextSibling !== draggedItem) shouldMove = true;
    else if (!isRight && prevSibling !== draggedItem) shouldMove = true;

    if (shouldMove) {
      // [중요] 전체 래퍼를 기준으로 애니메이션 실행 (페이지 간 이동 포함)
      animateDOMMove(wrapper, () => {
        // 1. 현재 페이지 내에서 자리 교체
        if (isRight) {
          pageDiv.insertBefore(draggedItem, container.nextSibling);
        } else {
          pageDiv.insertBefore(draggedItem, container);
        }

        // 2. [추가] 페이지 간 아이템 개수 균형 맞추기
        balanceGrid();
      });
    }
  });

  return container;
}

function createAddBtn() {
  const container = document.createElement("div");
  container.className = "shortcut-item-container add-btn-container";
  // 추가 버튼은 드래그 대상이 아니지만, 순서상 마지막에 위치해야 함

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

// --- 전역 드래그 오버 핸들러 (페이지 전환 및 빈 공간 처리) ---
function handleGlobalDragOver(e) {
  e.preventDefault();
  if (!draggedItem) return;

  // 1. 페이지 전환 (Edge Scrolling)
  const screenWidth = window.innerWidth;
  const edgeThreshold = 80; // 가장자리 감지 범위 (px)
  const now = Date.now();

  // 쿨타임(0.8초) 체크
  if (now - lastPageSwitchTime > 800) {
    if (e.clientX < edgeThreshold) {
      // 왼쪽 끝
      if (currentPage > 0) {
        movePage(-1);
        lastPageSwitchTime = now;
        moveDraggedItemToCurrentPage();
      }
    } else if (e.clientX > screenWidth - edgeThreshold) {
      // 오른쪽 끝
      const totalPages = document.querySelectorAll(".shortcut-page").length;
      if (currentPage < totalPages - 1) {
        movePage(1);
        lastPageSwitchTime = now;
        moveDraggedItemToCurrentPage();
      }
    }
  }
}

// 페이지가 바뀌었을 때 드래그 중인 아이템을 새 페이지로 이동
function moveDraggedItemToCurrentPage() {
  if (!draggedItem) return;
  const pages = document.querySelectorAll(".shortcut-page");
  const targetPage = pages[currentPage];

  // 추가 버튼이 있다면 그 앞에, 없다면 맨 뒤에 추가
  const addBtn = targetPage.querySelector(".add-btn-container");
  if (addBtn) {
    targetPage.insertBefore(draggedItem, addBtn);
  } else {
    targetPage.appendChild(draggedItem);
  }
}

// --- 드롭 후 데이터 저장 ---
function reorderAndSave() {
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

  shortcuts = newShortcuts;
  saveShortcuts();
  renderGrid(); // 인덱스 등 재정비를 위해 다시 렌더링
}

/* --- 메뉴 및 데이터 관리 --- */
function closeAllMenus() {
  document
    .querySelectorAll(".shortcut-menu.show")
    .forEach((menu) => menu.classList.remove("show"));
}

function deleteShortcut(id) {
  if (confirm(t.menuDelete + "?")) {
    shortcuts = shortcuts.filter((item) => item.id !== id);
    saveShortcuts();
    renderGrid();
  }
}

/* --- 모달 (추가/수정) --- */
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

  // URL 입력 중 600ms 멈추면 자동 fetch
  urlInput.addEventListener("input", () => {
    clearTimeout(titleFetchTimeout);
    const url = urlInput.value.trim();
    if (!url || titleInput.value.trim() || !url.includes(".")) return;
    titleFetchTimeout = setTimeout(fetchPageTitle, 600);
  });

  // URL 필드에서 나갈 때 즉시 fetch
  urlInput.addEventListener("blur", () => {
    clearTimeout(titleFetchTimeout);
    fetchPageTitle();
  });

  form.onsubmit = (e) => {
    e.preventDefault();
    const title = titleInput.value;
    let url = urlInput.value;

    if (!url.startsWith("http://") && !url.startsWith("https://"))
      url = "https://" + url;

    if (title && url) {
      if (editingItemId) {
        const item = shortcuts.find((i) => i.id === editingItemId);
        if (item) {
          item.title = title;
          item.url = url;
        }
      } else {
        shortcuts.push({
          title,
          url,
          id: Date.now() + Math.floor(Math.random() * 1000),
        });
      }
      saveShortcuts();
      renderGrid();
      modal.close();
    }
  };
}

function openAddModal() {
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

/* --- 페이지 이동 --- */
function movePage(step) {
  const totalPages = document.querySelectorAll(".shortcut-page").length;
  // 스와이프 애니메이션을 위해 범위 체크
  const nextPage = currentPage + step;
  if (nextPage >= 0 && nextPage < totalPages) {
    currentPage = nextPage;
    const wrapper = document.getElementById("shortcutsWrapper");
    wrapper.style.transform = `translateX(-${currentPage * 100}%)`;

    // 페이지네이션 업데이트
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

/* --- 검색 --- */
function setupSearch() {
  const input = document.getElementById("searchInput");
  const suggestionsList = document.getElementById("searchSuggestions");
  const searchBar = document.getElementById("searchBar");
  let debounceTimeout;

  input.addEventListener("input", (e) => {
    const query = input.value.trim();

    clearTimeout(debounceTimeout);

    if (!query) {
      hideSuggestions();
      return;
    }

    debounceTimeout = setTimeout(() => {
      fetchSuggestions(query);
    }, 150); // debounce to avoid too many API calls
  });

  let selectedIndex = -1;
  let originalInput = "";

  input.addEventListener("keydown", (e) => {
    if (suggestionsList.classList.contains("show")) {
      const items = suggestionsList.querySelectorAll(".suggestion-item");
      if (items.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          if (selectedIndex === -1) {
            originalInput = input.value;
          }
          selectedIndex = selectedIndex + 1;
          if (selectedIndex >= items.length) {
            selectedIndex = -1;
          }
          updateSelection(items, true);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          if (selectedIndex === -1) {
            originalInput = input.value;
            selectedIndex = items.length - 1;
          } else {
            selectedIndex = selectedIndex - 1;
          }
          updateSelection(items, true);
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < items.length) {
            const suggestion = items[selectedIndex].querySelector("span:last-child").textContent;
            input.value = suggestion;
            chrome.search.query({ text: suggestion });
            hideSuggestions();
          } else {
            const query = input.value.trim();
            if (query) {
              chrome.search.query({ text: query });
            }
          }
        }
      }
    } else if (e.key === "Enter") {
      const query = input.value.trim();
      if (query) {
        chrome.search.query({ text: query });
      }
    }
  });

  function updateSelection(items, updateInput = false) {
    items.forEach((item, index) => {
      if (index === selectedIndex) {
        item.classList.add("selected");
        if (updateInput) {
          input.value = item.querySelector("span:last-child").textContent;
        }
      } else {
        item.classList.remove("selected");
      }
    });

    if (selectedIndex === -1 && updateInput) {
      input.value = originalInput;
    }
  }

  async function fetchSuggestions(query) {
    try {
      const response = await fetch(`https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();

      const suggestions = data[1] || [];
      renderSuggestions(suggestions);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      hideSuggestions();
    }
  }

  function renderSuggestions(suggestions) {
    suggestionsList.innerHTML = '';
    selectedIndex = -1; // Reset selection on new suggestions

    if (suggestions.length === 0) {
      hideSuggestions();
      return;
    }

    suggestions.slice(0, 8).forEach((suggestion, index) => {
      const li = document.createElement('li');
      li.className = 'suggestion-item';

      const iconSpan = document.createElement('span');
      iconSpan.className = 'material-icons';
      iconSpan.textContent = 'search';

      const textSpan = document.createElement('span');
      textSpan.textContent = suggestion;

      li.appendChild(iconSpan);
      li.appendChild(textSpan);

      li.addEventListener('click', () => {
        input.value = suggestion;
        chrome.search.query({ text: suggestion });
        hideSuggestions();
      });

      li.addEventListener('mouseenter', () => {
        selectedIndex = index;
        updateSelection(suggestionsList.querySelectorAll(".suggestion-item"), false);
      });

      suggestionsList.appendChild(li);
    });

    showSuggestions();
  }

  function showSuggestions() {
    suggestionsList.classList.add('show');
    searchBar.classList.add('has-suggestions');
  }

  function hideSuggestions() {
    suggestionsList.classList.remove('show');
    searchBar.classList.remove('has-suggestions');
  }

  // Hide suggestions when clicking outside
  document.addEventListener("click", (e) => {
    if (!searchBar.contains(e.target)) {
      hideSuggestions();
    }
  });

  // Re-show suggestions when input is focused if there's text
  input.addEventListener("focus", () => {
    if (input.value.trim() && suggestionsList.children.length > 0) {
      showSuggestions();
    }
  });

  document.getElementById("imageSearchBtn").addEventListener("click", () => {
    const query = input.value.trim();
    window.location.href = query
      ? `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`
      : `https://www.google.com/imghp`;
  });
  document.getElementById("aiModeBtn").addEventListener("click", () => {
    window.location.href =
      "https://www.google.com/search?sourceid=chrome&udm=50&aep=42";
  });
}

/* --- 부드러운 이동(FLIP) 애니메이션 함수 (최종) --- */
function animateDOMMove(container, moveAction) {
  // container 내의 모든 아이템 위치 저장
  const items = [...container.querySelectorAll(".shortcut-item-container")];
  const positions = new Map();

  items.forEach((item) => {
    // 현재 화면에 렌더링 된 요소만 추적
    if (item.getBoundingClientRect().width > 0) {
      const rect = item.getBoundingClientRect();
      positions.set(item, { left: rect.left, top: rect.top });
    }
  });

  // DOM 변경 실행
  moveAction();

  // 변경 후 위치 비교 및 애니메이션
  items.forEach((item) => {
    const oldPos = positions.get(item);
    // 이전에 위치 정보가 없거나, 지금 화면에서 사라진 경우(display: none) 패스
    if (!oldPos || item.getBoundingClientRect().width === 0) return;

    const rect = item.getBoundingClientRect();
    const deltaX = oldPos.left - rect.left;
    const deltaY = oldPos.top - rect.top;

    if (deltaX === 0 && deltaY === 0) return;

    item.style.transition = "none";
    item.style.transform = `translate(${deltaX}px, ${deltaY}px)`;

    requestAnimationFrame(() => {
      // 강제 리플로우
      item.getBoundingClientRect();
      item.style.transition = "";
      item.style.transform = "";
    });
  });
}

/* --- 페이지 간 아이템 균형 맞추기 (수정됨) --- */
function balanceGrid() {
  const pages = document.querySelectorAll(".shortcut-page");

  // 모든 페이지 순회
  for (let i = 0; i < pages.length - 1; i++) {
    const currentPage = pages[i];
    const nextPage = pages[i + 1];

    const currentItems = [...currentPage.querySelectorAll(".draggable-item")];
    const nextItems = [...nextPage.querySelectorAll(".draggable-item")];

    // [수정] 현재 페이지가 30개 '미만'일 때만 뒷 페이지에서 가져옴 (Pull)
    // 30개보다 많을 때(Push)는 CSS가 처리하도록 둠 (드래그 끝날 때 정리됨)
    if (currentItems.length < ITEMS_PER_PAGE && nextItems.length > 0) {
      let moveCandidate = nextItems[0];

      // 드래그 중인 아이템은 건너뛰고 그 다음 걸 가져옴
      if (
        moveCandidate.classList.contains("dragging") &&
        nextItems.length > 1
      ) {
        moveCandidate = nextItems[1];
      }

      // 이동 실행
      if (!moveCandidate.classList.contains("dragging")) {
        const addBtn = currentPage.querySelector(".add-btn-container");
        if (addBtn) currentPage.insertBefore(moveCandidate, addBtn);
        else currentPage.appendChild(moveCandidate);
      }
    }
  }
}
