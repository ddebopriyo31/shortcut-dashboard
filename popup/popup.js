/* ==========================================================================
   Shortcut Dashboard — popup.js

   The popup is its own top-level document/context, separate from
   newtab.html — it can't reach into app.js's closures directly, so it
   reads the same chrome.storage.local key (STORAGE_KEY, shared with
   app.js) directly. That IS the storage abstraction Task 2 built: this
   file talks to nothing but chrome.storage.local, never touches
   localStorage, and never writes anything (read-only, display only).

   The small per-field checks below (isNonEmptyString, safeShortcuts,
   safeCategories) are NOT a second sanitization/storage system — they
   exist only so a corrupted or unexpected record can't throw while the
   popup is rendering. All real validation, sanitization, persistence, and
   migration logic remains owned by app.js and runs only there.
   ========================================================================== */
(function () {
  "use strict";

  const STORAGE_KEY = "shortcutDashboardState";

  const openDashboardBtn = document.getElementById("openDashboardBtn");
  const settingsBtn = document.getElementById("settingsBtn");
  const favoritesList = document.getElementById("favoritesList");
  const favoritesEmpty = document.getElementById("favoritesEmpty");
  const popupError = document.getElementById("popupError");
  const statShortcuts = document.getElementById("statShortcuts");
  const statFavorites = document.getElementById("statFavorites");
  const statCategories = document.getElementById("statCategories");

  function isNonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0;
  }

  function safeShortcuts(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.filter((sc) => sc && typeof sc === "object" && isNonEmptyString(sc.name) && isNonEmptyString(sc.url));
  }

  function safeCategories(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.filter((c) => c && typeof c === "object" && isNonEmptyString(c.name));
  }

  function getFaviconUrl(url) {
    try {
      const domain = new URL(url).hostname.replace(/^www\./, "");
      if (!domain) return null;
      return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
    } catch (err) {
      return null;
    }
  }

  /**
   * Opens a page bundled with the extension in a new tab and closes the
   * popup. chrome.tabs.create() works here without the "tabs" permission
   * because nothing in this file reads the created Tab's url/title back —
   * that's the only part of chrome.tabs that permission gates.
   */
  function openExtensionPage(path) {
    chrome.tabs.create({ url: chrome.runtime.getURL(path) });
    window.close();
  }

  function openUrlInNewTab(url) {
    if (!isNonEmptyString(url)) return;
    // Only ever opens a URL that was already validated and stored by the
    // dashboard itself (see app.js's normalizeAndValidateUrl) — this file
    // never builds or executes a URL of its own.
    chrome.tabs.create({ url });
    window.close();
  }

  function buildFavoriteIcon(shortcut) {
    const wrap = document.createElement("span");
    wrap.className = "popup-fav-icon";

    const showFallback = () => {
      while (wrap.firstChild) wrap.removeChild(wrap.firstChild);
      const span = document.createElement("span");
      span.className = "popup-fav-icon-fallback";
      span.textContent = (shortcut.name.trim()[0] || "?").toUpperCase();
      wrap.appendChild(span);
    };

    const icon = shortcut.icon && typeof shortcut.icon === "object" ? shortcut.icon : { type: "favicon", value: "" };

    if (icon.type === "emoji" && isNonEmptyString(icon.value)) {
      const span = document.createElement("span");
      span.className = "popup-fav-icon-emoji";
      span.textContent = icon.value;
      wrap.appendChild(span);
      return wrap;
    }

    if (icon.type === "letter") {
      showFallback();
      return wrap;
    }

    // "image" and the default "favicon" both resolve to a <img>, just from
    // a different source URL — same fallback-on-error behavior either way.
    const src = icon.type === "image" && isNonEmptyString(icon.value) ? icon.value : getFaviconUrl(shortcut.url);
    if (!src) {
      showFallback();
      return wrap;
    }
    const img = document.createElement("img");
    img.alt = "";
    img.loading = "lazy";
    img.referrerPolicy = "no-referrer";
    img.style.opacity = "0";
    img.addEventListener("load", () => {
      img.style.opacity = "1";
    });
    img.addEventListener("error", showFallback);
    img.src = src;
    wrap.appendChild(img);
    return wrap;
  }

  function renderFavorites(shortcuts) {
    const favorites = shortcuts
      .filter((sc) => sc.favorite === true)
      .sort((a, b) => (typeof a.position === "number" ? a.position : 0) - (typeof b.position === "number" ? b.position : 0));

    favoritesList.innerHTML = "";

    if (favorites.length === 0) {
      favoritesEmpty.hidden = false;
      favoritesList.hidden = true;
      return;
    }

    favoritesEmpty.hidden = true;
    favoritesList.hidden = false;

    favorites.forEach((shortcut) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "popup-fav-item";
      btn.setAttribute("aria-label", `Open ${shortcut.name}`);

      btn.appendChild(buildFavoriteIcon(shortcut));

      const label = document.createElement("span");
      label.className = "popup-fav-name";
      label.textContent = shortcut.name;
      btn.appendChild(label);

      btn.addEventListener("click", () => openUrlInNewTab(shortcut.url));

      li.appendChild(btn);
      favoritesList.appendChild(li);
    });
  }

  function renderStats(shortcuts, categories) {
    statShortcuts.textContent = String(shortcuts.length);
    statFavorites.textContent = String(shortcuts.filter((sc) => sc.favorite === true).length);
    statCategories.textContent = String(categories.length);
  }

  function showLoadError() {
    popupError.hidden = false;
    favoritesEmpty.hidden = true;
    favoritesList.hidden = true;
    statShortcuts.textContent = "–";
    statFavorites.textContent = "–";
    statCategories.textContent = "–";
  }

  function loadAndRender() {
    if (!(window.chrome && chrome.storage && chrome.storage.local)) {
      showLoadError();
      return;
    }

    chrome.storage.local.get(STORAGE_KEY, (result) => {
      if (chrome.runtime.lastError) {
        console.error("Popup: could not read chrome.storage.local:", chrome.runtime.lastError.message);
        showLoadError();
        return;
      }
      try {
        const stored = result && result[STORAGE_KEY];
        const shortcuts = safeShortcuts(stored && stored.shortcuts);
        const categories = safeCategories(stored && stored.categories);
        renderFavorites(shortcuts);
        renderStats(shortcuts, categories);
      } catch (err) {
        console.error("Popup: failed to render stored data:", err);
        showLoadError();
      }
    });
  }

  function init() {
    openDashboardBtn.addEventListener("click", () => openExtensionPage("newtab.html"));
    // V3.0 Task 4 — a dedicated Options page now exists; Settings opens it
    // directly instead of the dashboard's Settings modal.
    settingsBtn.addEventListener("click", () => openExtensionPage("options/options.html"));

    loadAndRender();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
