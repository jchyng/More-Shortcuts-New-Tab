const FAVICON_CACHE_PREFIX = "fav_";

// Chrome's /_favicon/ endpoint returns a default icon fingerprint for
// unknown domains; fetched once and reused for comparison.
let _chromeDefaultHexPromise = null;
async function getChromeFaviconDefaultHex() {
  if (!_chromeDefaultHexPromise) {
    _chromeDefaultHexPromise = (async () => {
      try {
        const src = `/_favicon/?pageUrl=${encodeURIComponent("https://xn--not-a-real-domain-xyz.invalid")}&size=64`;
        const buf = await fetch(src).then((r) => r.arrayBuffer());
        return Array.from(new Uint8Array(buf))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
      } catch {
        return null;
      }
    })();
  }
  return _chromeDefaultHexPromise;
}

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
    probe.onload = () =>
      resolve(probe.naturalWidth > 1 && probe.naturalHeight > 1);
    probe.onerror = () => resolve(false);
    probe.src = dataUrl;
  });
}

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

function applyFavicon(img, dataUrl) {
  img.addEventListener("load", () => img.classList.remove("favicon-loading"), { once: true });
  img.addEventListener("error", () => img.classList.remove("favicon-loading"), { once: true });
  img.src = dataUrl;
}

async function loadFaviconWithFallback(img, item, hostname) {
  // 1. Local cache from a previous successful fetch.
  const cached = await getCachedFavicon(hostname);
  if (cached) {
    applyFavicon(img, cached);
    return;
  }

  // 2. Chrome's local favicon cache. /_favicon/ returns a default icon
  //    (1x1 GIF or globe PNG) for uncached domains, so compare bytes
  //    against a fingerprint from a known-fake domain to detect that.
  try {
    const chromeSrc = `/_favicon/?pageUrl=${encodeURIComponent(item.url)}&size=64`;
    const buf = await fetch(chromeSrc).then((r) => r.arrayBuffer());
    if (buf.byteLength > 1) {
      const hex = Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const defaultHex = await getChromeFaviconDefaultHex();
      if (!defaultHex || hex !== defaultHex) {
        const dataUrl = await blobToBase64(new Blob([buf], { type: "image/png" }));
        setCachedFavicon(hostname, dataUrl);
        applyFavicon(img, dataUrl);
        return;
      }
    }
  } catch {}

  // 3-5. Try external sources in order, caching the first success.
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

  // 6. Letter fallback.
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
