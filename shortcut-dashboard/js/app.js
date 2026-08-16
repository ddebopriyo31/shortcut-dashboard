/* ==========================================================================
   Shortcut Dashboard — app.js (V2)
   Vanilla JS, no dependencies. Everything is stored in localStorage.

   V2 adds categories, favorites, custom icons, and improved search on top
   of the V1.1 foundation. The V1.1 URL validation/normalization, storage
   self-healing, modal focus-trap, toast, and event-delegation patterns are
   preserved unchanged — V2 extends them rather than replacing them.

   State shape (single source of truth, held in memory and mirrored to one
   localStorage key):

   {
     version: 2,
     settings: { theme, gridSize, showSearch, showDomain, showClock },
     categories: [ { id, name, icon, position } ],
     shortcuts: [
       {
         id, name, url,
         icon: { type: "favicon"|"image"|"emoji"|"letter", value },
         categoryId, favorite, position, createdAt, updatedAt
       }
     ]
   }
   ========================================================================== */

(function () {
  "use strict";

  // ------------------------------------------------------------------------
  // Constants
  // ------------------------------------------------------------------------
  const STORAGE_KEY_V1 = "shortcutDashboard.shortcuts.v1"; // legacy V1.1 key (read-only, never written)
  const STORAGE_KEY_V2 = "shortcutDashboardState";
  const MAX_NAME_LENGTH = 60;
  const MAX_CATEGORY_NAME_LENGTH = 40;
  const MAX_EMOJI_LENGTH = 16;
  const ALLOWED_PROTOCOLS = ["http:", "https:"];
  const ICON_TYPES = ["favicon", "image", "emoji", "letter"];

  // ------------------------------------------------------------------------
  // DOM references
  // ------------------------------------------------------------------------
  const grid = document.getElementById("shortcutGrid");
  const emptyState = document.getElementById("emptyState");
  const noResultsState = document.getElementById("noResultsState");
  const noResultsTitle = document.getElementById("noResultsTitle");
  const noResultsCopy = document.getElementById("noResultsCopy");
  const statusLine = document.getElementById("statusLine");
  const searchWrap = document.getElementById("searchWrap");
  const searchInput = document.getElementById("searchInput");
  const toast = document.getElementById("toast");

  const addShortcutBtn = document.getElementById("addShortcutBtn");
  const modalOverlay = document.getElementById("modalOverlay");
  const modalTitle = document.getElementById("modalTitle");
  const shortcutForm = document.getElementById("shortcutForm");
  const shortcutIdInput = document.getElementById("shortcutId");
  const nameInput = document.getElementById("nameInput");
  const urlInput = document.getElementById("urlInput");
  const categorySelect = document.getElementById("categorySelect");
  const iconTypeRow = document.getElementById("iconTypeRow");
  const iconValueInput = document.getElementById("iconValueInput");
  const iconHint = document.getElementById("iconHint");
  const favoriteInput = document.getElementById("favoriteInput");
  const formError = document.getElementById("formError");
  const submitBtn = document.getElementById("submitBtn");
  const cancelBtn = document.getElementById("cancelBtn");
  const modalClose = document.getElementById("modalClose");

  const deleteOverlay = document.getElementById("deleteOverlay");
  const deleteName = document.getElementById("deleteName");
  const deleteCancelBtn = document.getElementById("deleteCancelBtn");
  const deleteConfirmBtn = document.getElementById("deleteConfirmBtn");

  const sidebar = document.getElementById("sidebar");
  const sidebarToggle = document.getElementById("sidebarToggle");
  const sidebarBackdrop = document.getElementById("sidebarBackdrop");
  const viewList = document.getElementById("viewList");
  const categoryListEl = document.getElementById("categoryList");
  const newCategoryBtn = document.getElementById("newCategoryBtn");
  const countAll = document.getElementById("countAll");
  const countFavorites = document.getElementById("countFavorites");
  const countUncategorized = document.getElementById("countUncategorized");

  const categoryModalOverlay = document.getElementById("categoryModalOverlay");
  const categoryModalTitle = document.getElementById("categoryModalTitle");
  const categoryForm = document.getElementById("categoryForm");
  const categoryIdInput = document.getElementById("categoryId");
  const categoryIconInput = document.getElementById("categoryIconInput");
  const categoryNameInput = document.getElementById("categoryNameInput");
  const categoryFormError = document.getElementById("categoryFormError");
  const categorySubmitBtn = document.getElementById("categorySubmitBtn");
  const categoryCancelBtn = document.getElementById("categoryCancelBtn");
  const categoryModalClose = document.getElementById("categoryModalClose");

  const categoryDeleteOverlay = document.getElementById("categoryDeleteOverlay");
  const categoryDeleteName = document.getElementById("categoryDeleteName");
  const categoryDeleteCancelBtn = document.getElementById("categoryDeleteCancelBtn");
  const categoryDeleteConfirmBtn = document.getElementById("categoryDeleteConfirmBtn");

  const settingsBtn = document.getElementById("settingsBtn");
  const settingsOverlay = document.getElementById("settingsOverlay");
  const settingsClose = document.getElementById("settingsClose");
  const exportBtn = document.getElementById("exportBtn");
  const importBtn = document.getElementById("importBtn");
  const importFileInput = document.getElementById("importFileInput");

  // V2.2 — Settings tabs
  const settingsTabsEl = document.querySelector(".settings-tabs");
  const settingsTabs = Array.from(document.querySelectorAll(".settings-tab"));
  const settingsPanels = Array.from(document.querySelectorAll(".settings-panel"));

  // V2.2 — Appearance controls
  const themeControl = document.getElementById("themeControl");
  const gridSizeControl = document.getElementById("gridSizeControl");

  // V2.2 — Display controls
  const showSearchInput = document.getElementById("showSearchInput");
  const showDomainInput = document.getElementById("showDomainInput");
  const showClockInput = document.getElementById("showClockInput");

  // V2.2 — Background controls
  const backgroundTypeControl = document.getElementById("backgroundTypeControl");
  const bgColorFields = document.getElementById("bgColorFields");
  const bgGradientFields = document.getElementById("bgGradientFields");
  const bgImageFields = document.getElementById("bgImageFields");
  const bgColorInput = document.getElementById("bgColorInput");
  const bgGradientFromInput = document.getElementById("bgGradientFromInput");
  const bgGradientToInput = document.getElementById("bgGradientToInput");
  const bgImageUrlInput = document.getElementById("bgImageUrlInput");
  const bgImageError = document.getElementById("bgImageError");

  // V2.2 — Header clock
  const headerClock = document.getElementById("headerClock");
  const clockTimeEl = document.getElementById("clockTime");
  const clockDateEl = document.getElementById("clockDate");

  const importConfirmOverlay = document.getElementById("importConfirmOverlay");
  const importConfirmSummary = document.getElementById("importConfirmSummary");
  const importCancelBtn = document.getElementById("importCancelBtn");
  const importMergeBtn = document.getElementById("importMergeBtn");
  const importReplaceBtn = document.getElementById("importReplaceBtn");

  const contextMenu = document.getElementById("contextMenu");

  // ------------------------------------------------------------------------
  // State
  // ------------------------------------------------------------------------
  let state = { version: 2, settings: defaultSettings(), categories: [], shortcuts: [] };
  let currentView = { type: "all", categoryId: null }; // "all" | "favorites" | "uncategorized" | "category"
  let searchTerm = "";          // current search filter (lowercased, trimmed, whitespace-collapsed)
  let pendingDeleteId = null;   // shortcut id awaiting delete confirmation
  let pendingCategoryDeleteId = null;
  let toastTimer = null;
  let activeModal = null;       // overlay element currently open, or null
  let modalOpener = null;       // element to restore focus to when modal closes

  // V2.1 additions
  let draggingId = null;        // id of the shortcut currently being dragged, or null
  let pendingFocusId = null;    // shortcut id whose drag handle should regain focus after the next render
  let pendingImport = null;     // sanitized state parsed from an imported backup, awaiting Replace/Merge/Cancel
  let contextMenuTargetId = null; // shortcut id the open context menu applies to
  let contextMenuOpener = null;   // element to restore focus to when the context menu closes

  // V2.2 additions
  let clockIntervalId = null;         // single managed interval for the header clock, or null when stopped
  let systemThemeQuery = null;        // matchMedia("(prefers-color-scheme: light)"), created once in init()
  let bgImageLoadToken = 0;           // increments per background-image load attempt so a stale async result is ignored

  // Runtime-only: true when the currently *saved* background image failed
  // to load, so the page is visually showing the Default background as a
  // fallback. This is intentionally NOT part of state.settings — a broken
  // or temporarily unreachable image URL must never be deleted from the
  // user's saved configuration, only reflected as a transient display
  // problem. Recomputed by applyBackground() on every apply; read by
  // updateBackgroundImageErrorUI() so the Settings panel shows the same
  // failure state whether the user is looking at it live or reopens
  // Settings later (e.g. after a failure at page load).
  let backgroundImageLoadFailed = false;

  const THEME_MODES = ["dark", "light", "system"];
  const GRID_SIZES = ["small", "medium", "large"];
  const BACKGROUND_TYPES = ["default", "color", "gradient", "image"];
  const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

  function defaultSettings() {
    return {
      theme: "dark",
      gridSize: "medium",
      showSearch: true,
      showDomain: true,
      showClock: false,
      background: {
        type: "default",
        color: "#141822",
        gradientFrom: "#1b2030",
        gradientTo: "#0b0d12",
        imageUrl: "",
      },
    };
  }

  // ==========================================================================
  // URL helpers (unchanged from V1.1)
  // ==========================================================================

  /**
   * Parses free-form user input into a URL object.
   * - Adds "https://" when no protocol was given ("github.com" -> https://github.com/).
   * - Delegates everything else to the native URL parser. Note that the
   *   parser does its own normalization here (see comparableUrlKey below for
   *   what that means for comparisons) — it is not a passthrough of the raw
   *   input.
   * Returns null if the input can't be parsed into a URL at all.
   */
  function parseUserUrl(input) {
    if (typeof input !== "string") return null;
    let value = input.trim();
    if (!value) return null;

    // Only treat it as "already has a protocol" if it looks like a real
    // scheme (letters, digits, +, -, .) followed by "://". Otherwise prefix
    // https:// — this also means something like "javascript:alert(1)" gets
    // turned into "https://javascript:alert(1)" rather than accepted as-is
    // (it has a colon but no "//"). That reinterpreted string is then still
    // subject to the protocol/hostname checks below, and in practice fails
    // to parse as a valid URL at all — see isAllowedUrl().
    if (!/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(value)) {
      value = `https://${value}`;
    }

    try {
      return new URL(value);
    } catch (err) {
      return null;
    }
  }

  /**
   * Validates that a parsed URL is a normal, safe web address.
   * - Protocol must be http: or https: (rejects javascript:, data:, file:,
   *   ftp:, and anything else).
   * - Hostname must simply be present (see V1.1 note: intentionally allows
   *   single-label LAN/intranet hosts like "router" or "nas").
   */
  function isAllowedUrl(parsed) {
    if (!parsed) return false;
    if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) return false;
    return Boolean(parsed.hostname);
  }

  /**
   * Normalizes and validates raw user input in one step. Returns the
   * normalized, storable URL string (parsed.href), or null if the input is
   * not an acceptable URL. Used for both shortcut URLs and custom icon
   * image URLs — the acceptance rules (http/https, real hostname) are the
   * same for both.
   */
  function normalizeAndValidateUrl(input) {
    const parsed = parseUserUrl(input);
    if (!isAllowedUrl(parsed)) return null;
    return parsed.href;
  }

  /**
   * Key used to compare two already-normalized URLs for "is this the same
   * shortcut" purposes.
   *
   * Only the protocol and host are lowercased for comparison: per the URL
   * spec, scheme names and hostnames are not case-sensitive, so
   * "HTTPS://Example.com" and "https://example.com" are the same origin.
   * Pathname, query string, and fragment are deliberately preserved
   * exactly as-is — servers are free to treat those as case-sensitive
   * (e.g. "/Page" and "/page" can be two entirely different resources),
   * so lowercasing them could silently merge two distinct shortcuts into
   * one "duplicate". A full `url.toLowerCase()` would do exactly that.
   */
  function comparableUrlKey(url) {
    try {
      const parsed = new URL(url);
      return `${parsed.protocol.toLowerCase()}//${parsed.host.toLowerCase()}${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch (err) {
      // Not a parseable URL — shouldn't happen for values that already went
      // through normalizeAndValidateUrl(), but fall back to the raw string
      // so duplicate detection degrades gracefully instead of throwing.
      return url;
    }
  }

  function getDomain(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch (err) {
      return url;
    }
  }

  function getFaviconUrl(url) {
    try {
      const domain = getDomain(url);
      if (!domain) return null;
      return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
    } catch (err) {
      return null;
    }
  }

  // ==========================================================================
  // Data validation
  // ==========================================================================

  function isNonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0;
  }

  function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  /**
   * Validates a single category record. Returns a clean category object, or
   * null if unusable (missing/blank name). A missing/invalid id does not by
   * itself disqualify the record — loadState() assigns a fresh id.
   */
  function sanitizeCategory(raw) {
    if (!raw || typeof raw !== "object") return null;
    if (!isNonEmptyString(raw.name)) return null;
    return {
      id: isNonEmptyString(raw.id) ? String(raw.id) : null,
      name: raw.name.trim().slice(0, MAX_CATEGORY_NAME_LENGTH),
      icon: isNonEmptyString(raw.icon) ? String(raw.icon).trim().slice(0, 8) : "📁",
      position: isFiniteNumber(raw.position) ? raw.position : 0,
    };
  }

  /**
   * Validates a single icon record. Always returns a usable icon object —
   * falls back to automatic favicon rather than rejecting the whole
   * shortcut, since a bad icon shouldn't destroy an otherwise-valid record.
   */
  function sanitizeIcon(raw) {
    const fallback = { type: "favicon", value: "" };
    if (!raw || typeof raw !== "object") return fallback;
    const type = ICON_TYPES.includes(raw.type) ? raw.type : "favicon";
    const rawValue = isNonEmptyString(raw.value) ? String(raw.value).trim() : "";

    if (type === "image") {
      const validated = normalizeAndValidateUrl(rawValue);
      return validated ? { type: "image", value: validated } : fallback;
    }
    if (type === "emoji") {
      return rawValue ? { type: "emoji", value: rawValue.slice(0, MAX_EMOJI_LENGTH) } : fallback;
    }
    if (type === "letter") {
      return { type: "letter", value: "" };
    }
    return fallback;
  }

  /**
   * Validates and normalizes a single V2 shortcut record loaded from
   * storage. Returns a clean shortcut object, or null if the record is
   * unusable (missing/blank name, invalid URL, wrong shape). Malformed
   * records are skipped rather than allowed to break the app.
   *
   * `validCategoryIds` lets an orphaned category reference (e.g. the
   * category was deleted by hand-editing storage) degrade to "no category"
   * instead of invalidating the whole shortcut.
   */
  function sanitizeShortcut(raw, validCategoryIds) {
    if (!raw || typeof raw !== "object") return null;
    if (!isNonEmptyString(raw.name)) return null;
    if (!isNonEmptyString(raw.url)) return null;

    const url = normalizeAndValidateUrl(raw.url);
    if (!url) return null;

    const createdAt = isFiniteNumber(raw.createdAt) ? raw.createdAt : Date.now();

    return {
      id: isNonEmptyString(raw.id) ? String(raw.id) : null,
      name: raw.name.trim().slice(0, MAX_NAME_LENGTH),
      url,
      icon: sanitizeIcon(raw.icon),
      categoryId:
        isNonEmptyString(raw.categoryId) && validCategoryIds.has(raw.categoryId)
          ? raw.categoryId
          : null,
      favorite: raw.favorite === true,
      position: isFiniteNumber(raw.position) ? raw.position : 0,
      createdAt,
      updatedAt: isFiniteNumber(raw.updatedAt) ? raw.updatedAt : createdAt,
    };
  }

  /**
   * Validates a legacy V1.1 record using the same rules V1.1 itself used
   * (name/url/id/createdAt only — no V2 fields exist yet at this point).
   */
  function sanitizeV1Record(raw) {
    if (!raw || typeof raw !== "object") return null;
    if (!isNonEmptyString(raw.name)) return null;
    if (!isNonEmptyString(raw.url)) return null;

    const url = normalizeAndValidateUrl(raw.url);
    if (!url) return null;

    return {
      id: isNonEmptyString(raw.id) ? String(raw.id) : null,
      name: raw.name.trim().slice(0, MAX_NAME_LENGTH),
      url,
      createdAt: isFiniteNumber(raw.createdAt) ? raw.createdAt : Date.now(),
    };
  }

  function isValidHexColor(value) {
    return typeof value === "string" && HEX_COLOR_RE.test(value.trim());
  }

  /**
   * Validates the background sub-object. Each field falls back to its own
   * default independently — an invalid gradient color, for instance, never
   * discards a perfectly valid imageUrl the user also has stored, since
   * only one of these fields is ever "active" (per `type`) at a time.
   */
  function sanitizeBackground(raw) {
    const defaults = defaultSettings().background;
    if (!raw || typeof raw !== "object") return defaults;
    return {
      type: BACKGROUND_TYPES.includes(raw.type) ? raw.type : defaults.type,
      color: isValidHexColor(raw.color) ? raw.color.trim() : defaults.color,
      gradientFrom: isValidHexColor(raw.gradientFrom) ? raw.gradientFrom.trim() : defaults.gradientFrom,
      gradientTo: isValidHexColor(raw.gradientTo) ? raw.gradientTo.trim() : defaults.gradientTo,
      imageUrl: isNonEmptyString(raw.imageUrl) ? (normalizeAndValidateUrl(raw.imageUrl) || "") : "",
    };
  }

  function sanitizeSettings(raw) {
    const defaults = defaultSettings();
    if (!raw || typeof raw !== "object") return defaults;
    return {
      theme: THEME_MODES.includes(raw.theme) ? raw.theme : defaults.theme,
      gridSize: GRID_SIZES.includes(raw.gridSize) ? raw.gridSize : defaults.gridSize,
      showSearch: typeof raw.showSearch === "boolean" ? raw.showSearch : defaults.showSearch,
      showDomain: typeof raw.showDomain === "boolean" ? raw.showDomain : defaults.showDomain,
      showClock: typeof raw.showClock === "boolean" ? raw.showClock : defaults.showClock,
      background: sanitizeBackground(raw.background),
    };
  }

  // ==========================================================================
  // Migration: V1.1 -> V2
  // ==========================================================================

  /**
   * Reads the legacy V1.1 shortcut list (if any) and converts it into V2
   * shortcut records. Never writes to or clears the V1.1 key — the old data
   * is left in place untouched, so a failed or partial migration can never
   * destroy it. Applies the same validation V1.1 used, so nothing that was
   * previously considered valid gets dropped.
   */
  function migrateV1Shortcuts() {
    let raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY_V1);
    } catch (err) {
      console.error("localStorage is unavailable during migration:", err);
      return [];
    }
    if (!raw) return [];

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      console.error("Legacy V1.1 data was corrupted JSON; skipping migration for it.", err);
      return [];
    }
    if (!Array.isArray(parsed)) return [];

    const seenIds = new Set();
    const seenUrls = new Set();
    const result = [];
    let position = 0;

    for (const item of parsed) {
      const record = sanitizeV1Record(item);
      if (!record) continue; // malformed V1.1 entry — nothing valid to preserve

      if (!record.id || seenIds.has(record.id)) {
        record.id = generateId();
      }
      const urlKey = comparableUrlKey(record.url);
      if (seenUrls.has(urlKey)) continue; // duplicate URL — first one wins, same as V1.1

      seenIds.add(record.id);
      seenUrls.add(urlKey);

      result.push({
        id: record.id,
        name: record.name,
        url: record.url,
        icon: { type: "favicon", value: "" },
        categoryId: null,
        favorite: false,
        position: position++,
        createdAt: record.createdAt,
        updatedAt: record.createdAt,
      });
    }

    return result;
  }

  // ==========================================================================
  // Storage layer
  // ==========================================================================

  /**
   * Validates a full parsed V2 state object. Drops malformed categories and
   * shortcuts individually rather than discarding the whole state — a
   * single corrupted record must never take the rest of a person's data
   * down with it. Returns a clean state object (never null — an
   * unparseable/non-object payload just yields an empty-but-valid state).
   */
  function sanitizeState(parsed) {
    const isObject = parsed && typeof parsed === "object" && !Array.isArray(parsed);
    const rawCategories = isObject && Array.isArray(parsed.categories) ? parsed.categories : [];
    const rawShortcuts = isObject && Array.isArray(parsed.shortcuts) ? parsed.shortcuts : [];
    const settings = sanitizeSettings(isObject ? parsed.settings : null);

    const seenCategoryIds = new Set();
    const categories = [];
    for (const item of rawCategories) {
      const cat = sanitizeCategory(item);
      if (!cat) continue;
      if (!cat.id || seenCategoryIds.has(cat.id)) cat.id = generateId();
      seenCategoryIds.add(cat.id);
      categories.push(cat);
    }

    const validCategoryIds = new Set(categories.map((c) => c.id));
    const seenShortcutIds = new Set();
    const seenUrls = new Set();
    const shortcuts = [];
    for (const item of rawShortcuts) {
      const sc = sanitizeShortcut(item, validCategoryIds);
      if (!sc) continue;
      if (!sc.id || seenShortcutIds.has(sc.id)) sc.id = generateId();
      const urlKey = comparableUrlKey(sc.url);
      if (seenUrls.has(urlKey)) continue;
      seenShortcutIds.add(sc.id);
      seenUrls.add(urlKey);
      shortcuts.push(sc);
    }

    return { version: 2, settings, categories, shortcuts };
  }

  /**
   * Loads the V2 state. If no V2 state exists yet, migrates from V1.1
   * (producing an empty-but-valid state if there was nothing to migrate).
   * Malformed stored data is self-healing: whenever the cleaned state
   * differs from what was on disk, the cleaned version is written back so
   * the same corruption doesn't resurface on the next load — mirroring the
   * V1.1 loadShortcuts() behavior.
   */
  function loadState() {
    let raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY_V2);
    } catch (err) {
      console.error("localStorage is unavailable:", err);
      return { version: 2, settings: defaultSettings(), categories: [], shortcuts: migrateV1Shortcuts() };
    }

    if (!raw) {
      // First run on V2, or V2 key was cleared. Migrate whatever V1.1 data
      // exists (if any) and persist the result as the new V2 state.
      const migrated = { version: 2, settings: defaultSettings(), categories: [], shortcuts: migrateV1Shortcuts() };
      persistState(migrated);
      return migrated;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      console.error("Stored V2 state was corrupted JSON; resetting.", err);
      const fallback = { version: 2, settings: defaultSettings(), categories: [], shortcuts: [] };
      persistState(fallback, { silent: true });
      return fallback;
    }

    const clean = sanitizeState(parsed);
    const cleanJson = JSON.stringify(clean);
    if (cleanJson !== JSON.stringify(parsed)) {
      persistState(clean, { silent: true });
    }
    return clean;
  }

  /**
   * Persists the given state to localStorage. Never throws — storage
   * failures (quota exceeded, disabled storage, private-mode restrictions,
   * etc.) are caught and logged, and the function returns false instead so
   * callers can show an accurate message rather than falsely claiming the
   * change was saved.
   */
  function persistState(nextState) {
    try {
      localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(nextState));
      return true;
    } catch (err) {
      console.error("Failed to save state:", err);
      return false;
    }
  }

  function generateId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    // Fallback for older browsers: timestamp + random suffix.
    return `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  // ==========================================================================
  // V2.2 — Appearance / display / background application
  //
  // Each apply* function is pure UI: it reads state.settings and updates the
  // DOM. Nothing here touches storage — callers (settings control handlers,
  // and init()) are responsible for persisting state.settings first, then
  // calling the relevant apply* function so the interface actually reflects
  // what was just saved.
  // ==========================================================================

  /**
   * Resolves "system" against the browser's current color-scheme
   * preference. "dark"/"light" pass through unchanged.
   */
  function resolveEffectiveTheme(theme) {
    if (theme !== "system") return theme;
    return systemThemeQuery && systemThemeQuery.matches ? "light" : "dark";
  }

  function applyTheme() {
    const effective = resolveEffectiveTheme(state.settings.theme);
    document.documentElement.setAttribute("data-theme", effective);
  }

  /**
   * Re-applies the theme when the OS preference changes, but only while
   * "System" is actually selected — otherwise an explicit Dark/Light choice
   * would silently flip when the OS theme changes.
   */
  function handleSystemThemeChange() {
    if (state.settings.theme === "system") applyTheme();
  }

  function applyGridSize() {
    grid.classList.remove("grid-small", "grid-medium", "grid-large");
    grid.classList.add(`grid-${state.settings.gridSize}`);
  }

  function applyDisplayOptions() {
    searchWrap.hidden = !state.settings.showSearch;
    document.body.classList.toggle("hide-domain", !state.settings.showDomain);

    if (state.settings.showClock) startClock();
    else stopClock();
  }

  // --------------------------------------------------------------------
  // Clock — one managed interval for the whole app. startClock() is a
  // no-op if already running, so toggling the setting on repeatedly can
  // never create duplicate intervals; stopClock() always clears it.
  // --------------------------------------------------------------------

  function updateClock() {
    const now = new Date();
    clockTimeEl.textContent = now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    clockDateEl.textContent = now.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  function startClock() {
    headerClock.hidden = false;
    updateClock(); // paint immediately, don't wait a full second for the first tick
    if (clockIntervalId) return; // already running — never stack a second interval
    clockIntervalId = window.setInterval(updateClock, 1000);
  }

  function stopClock() {
    headerClock.hidden = true;
    if (clockIntervalId) {
      window.clearInterval(clockIntervalId);
      clockIntervalId = null;
    }
  }

  // --------------------------------------------------------------------
  // Background
  // --------------------------------------------------------------------

  function clearBackgroundClasses() {
    document.body.classList.remove("bg-custom-color", "bg-custom-gradient", "bg-custom-image");
  }

  /** Syncs the Settings > Background error message to backgroundImageLoadFailed. */
  function updateBackgroundImageErrorUI() {
    if (backgroundImageLoadFailed) {
      bgImageError.textContent = "Couldn't load that image. Showing the default background instead.";
      bgImageError.hidden = false;
    } else {
      bgImageError.hidden = true;
    }
  }

  /**
   * Applies state.settings.background. Image loading is validated with a
   * throwaway Image() before it's ever committed to the page background —
   * a broken/unreachable URL falls back to the Default background (and
   * shows a toast) instead of leaving a broken-looking page.
   *
   * Failure is tracked only in the runtime `backgroundImageLoadFailed`
   * flag, never in state.settings — the user's configured type and
   * imageUrl are left exactly as saved, so a temporary network hiccup (or
   * a URL that's simply offline right now) can't silently overwrite or
   * discard their setting. bgImageLoadToken guards against a slow, now-
   * stale load resolving after the user has since switched to a
   * different URL/type — every new attempt bumps the token and
   * optimistically clears the previous failure state immediately, so a
   * fresh attempt is never left showing a stale error from the last one.
   */
  function applyBackground() {
    const bg = state.settings.background;
    clearBackgroundClasses();
    bgImageLoadToken++;

    if (bg.type === "color") {
      backgroundImageLoadFailed = false;
      updateBackgroundImageErrorUI();
      document.documentElement.style.setProperty("--bg-override-color", bg.color);
      document.body.classList.add("bg-custom-color");
      return;
    }

    if (bg.type === "gradient") {
      backgroundImageLoadFailed = false;
      updateBackgroundImageErrorUI();
      document.documentElement.style.setProperty(
        "--bg-override-gradient",
        `linear-gradient(135deg, ${bg.gradientFrom}, ${bg.gradientTo})`
      );
      document.body.classList.add("bg-custom-gradient");
      return;
    }

    if (bg.type === "image") {
      if (!bg.imageUrl) {
        // No URL saved yet — behave as Default until one is entered. This
        // isn't a load failure (nothing was attempted), so clear any
        // leftover failure state from a previously-configured URL.
        backgroundImageLoadFailed = false;
        updateBackgroundImageErrorUI();
        return;
      }

      // Starting a fresh attempt: clear the previous failure state right
      // away (per-requirement — changing the URL/type clears it) rather
      // than waiting for this attempt to resolve.
      backgroundImageLoadFailed = false;
      updateBackgroundImageErrorUI();

      const token = bgImageLoadToken;
      const preload = new Image();
      preload.onload = () => {
        if (token !== bgImageLoadToken) return; // superseded by a newer settings change
        document.documentElement.style.setProperty("--bg-override-image", `url("${bg.imageUrl}")`);
        document.body.classList.add("bg-custom-image");
      };
      preload.onerror = () => {
        if (token !== bgImageLoadToken) return;
        clearBackgroundClasses(); // fall back to the Default background — state.settings is untouched
        backgroundImageLoadFailed = true;
        updateBackgroundImageErrorUI();
        showToast("Background image couldn't be loaded — using the default background.", "error");
      };
      preload.src = bg.imageUrl;
      return;
    }

    // type === "default" — classes already cleared above. Not an image
    // load outcome, so any stale failure state from a previous "image"
    // configuration no longer applies.
    backgroundImageLoadFailed = false;
    updateBackgroundImageErrorUI();
  }

  function applyAllAppearance() {
    applyTheme();
    applyGridSize();
    applyDisplayOptions();
    applyBackground();
  }

  // ==========================================================================
  // Toast (non-blocking status messages)
  // ==========================================================================

  function showToast(message, kind) {
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    toast.textContent = message;
    toast.classList.remove("toast-success", "toast-error");
    if (kind === "success") toast.classList.add("toast-success");
    if (kind === "error") toast.classList.add("toast-error");
    toast.hidden = false;
    toastTimer = setTimeout(() => {
      toast.hidden = true;
    }, 4000);
  }

  // ==========================================================================
  // Lookups
  // ==========================================================================

  function getCategoryById(id) {
    if (!id) return null;
    return state.categories.find((c) => c.id === id) || null;
  }

  // ==========================================================================
  // Filtering
  // ==========================================================================

  function normalizeSearchText(value) {
    return value.trim().toLowerCase().replace(/\s+/g, " ");
  }

  function getViewLabel() {
    if (currentView.type === "favorites") return "Favorites";
    if (currentView.type === "uncategorized") return "Uncategorized";
    if (currentView.type === "category") {
      const cat = getCategoryById(currentView.categoryId);
      return cat ? cat.name : "this category";
    }
    return "All";
  }

  function getShortcutsInView() {
    if (currentView.type === "favorites") {
      return state.shortcuts.filter((sc) => sc.favorite);
    }
    if (currentView.type === "uncategorized") {
      return state.shortcuts.filter((sc) => !sc.categoryId);
    }
    if (currentView.type === "category") {
      return state.shortcuts.filter((sc) => sc.categoryId === currentView.categoryId);
    }
    return state.shortcuts;
  }

  function getFilteredShortcuts() {
    const inView = getShortcutsInView();
    if (!searchTerm) return inView;
    return inView.filter((sc) => {
      const category = getCategoryById(sc.categoryId);
      const haystack = normalizeSearchText(
        `${sc.name} ${sc.url} ${getDomain(sc.url)} ${category ? category.name : ""}`
      );
      return haystack.includes(searchTerm);
    });
  }

  // ==========================================================================
  // Rendering — sidebar
  // ==========================================================================

  function renderSidebarCounts() {
    countAll.textContent = String(state.shortcuts.length);
    countFavorites.textContent = String(state.shortcuts.filter((sc) => sc.favorite).length);
    countUncategorized.textContent = String(state.shortcuts.filter((sc) => !sc.categoryId).length);
  }

  function setActiveViewAttr(button, isActive) {
    if (isActive) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  }

  function renderSidebar() {
    renderSidebarCounts();

    // Built-in system views.
    viewList.querySelectorAll(".view-item").forEach((btn) => {
      const isActive = currentView.type === btn.dataset.view;
      setActiveViewAttr(btn, isActive);
    });

    // User categories.
    while (categoryListEl.firstChild) categoryListEl.removeChild(categoryListEl.firstChild);

    if (state.categories.length === 0) {
      const empty = document.createElement("li");
      empty.className = "sidebar-empty";
      empty.textContent = "No categories yet.";
      categoryListEl.appendChild(empty);
      return;
    }

    const sorted = [...state.categories].sort((a, b) => a.position - b.position);
    const fragment = document.createDocumentFragment();

    sorted.forEach((cat) => {
      const li = document.createElement("li");

      const row = document.createElement("div");
      row.className = "category-row";

      const count = state.shortcuts.filter((sc) => sc.categoryId === cat.id).length;
      const isActive = currentView.type === "category" && currentView.categoryId === cat.id;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "view-item";
      btn.dataset.action = "select-view";
      btn.dataset.view = "category";
      btn.dataset.categoryId = cat.id;
      setActiveViewAttr(btn, isActive);

      const iconSpan = document.createElement("span");
      iconSpan.className = "view-icon";
      iconSpan.setAttribute("aria-hidden", "true");
      iconSpan.textContent = cat.icon || "📁";
      btn.appendChild(iconSpan);

      const nameSpan = document.createElement("span");
      nameSpan.className = "view-name";
      nameSpan.textContent = cat.name;
      btn.appendChild(nameSpan);

      const countSpan = document.createElement("span");
      countSpan.className = "view-count";
      countSpan.textContent = String(count);
      btn.appendChild(countSpan);

      row.appendChild(btn);

      const actions = document.createElement("div");
      actions.className = "category-row-actions";

      const renameBtn = document.createElement("button");
      renameBtn.type = "button";
      renameBtn.className = "icon-btn";
      renameBtn.dataset.action = "rename-category";
      renameBtn.dataset.categoryId = cat.id;
      renameBtn.setAttribute("aria-label", `Rename ${cat.name} category`);
      renameBtn.textContent = "✎";
      actions.appendChild(renameBtn);

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "icon-btn";
      deleteBtn.dataset.action = "delete-category";
      deleteBtn.dataset.categoryId = cat.id;
      deleteBtn.setAttribute("aria-label", `Delete ${cat.name} category`);
      deleteBtn.textContent = "✕";
      actions.appendChild(deleteBtn);

      row.appendChild(actions);
      li.appendChild(row);
      fragment.appendChild(li);
    });

    categoryListEl.appendChild(fragment);
  }

  // ==========================================================================
  // Rendering — main grid
  // ==========================================================================

  function buildNoResultsMessage() {
    if (searchTerm) {
      const label = getViewLabel();
      noResultsTitle.textContent = "No shortcuts found";
      noResultsCopy.textContent =
        label === "All"
          ? `Nothing found for "${searchInput.value.trim()}". Try a different search.`
          : `Nothing found for "${searchInput.value.trim()}" in ${label}. Try a different search.`;
      return;
    }
    if (currentView.type === "favorites") {
      noResultsTitle.textContent = "No favorites yet";
      noResultsCopy.textContent = "Star a shortcut to pin it here.";
      return;
    }
    if (currentView.type === "uncategorized") {
      noResultsTitle.textContent = "Nothing uncategorized";
      noResultsCopy.textContent = "Every shortcut you have is already sorted into a category.";
      return;
    }
    if (currentView.type === "category") {
      noResultsTitle.textContent = "No shortcuts here yet";
      noResultsCopy.textContent = `Add a shortcut to ${getViewLabel()}, or move one in from Edit.`;
      return;
    }
    noResultsTitle.textContent = "No shortcuts found";
    noResultsCopy.textContent = "Try a different search.";
  }

  function render() {
    renderSidebar();

    const inView = getShortcutsInView();
    const filtered = getFilteredShortcuts();

    grid.innerHTML = "";

    // No shortcuts saved at all yet, anywhere.
    if (state.shortcuts.length === 0) {
      emptyState.hidden = false;
      noResultsState.hidden = true;
      grid.hidden = true;
      statusLine.textContent = "";
      return;
    }

    grid.hidden = false;
    emptyState.hidden = true;

    // Shortcuts exist, but none match the current view + search.
    if (filtered.length === 0) {
      noResultsState.hidden = false;
      buildNoResultsMessage();
      statusLine.textContent = searchTerm
        ? `0 of ${inView.length} shortcuts`
        : `0 shortcuts`;
      return;
    }

    noResultsState.hidden = true;

    const fragment = document.createDocumentFragment();
    const ordered = [...filtered].sort((a, b) => a.position - b.position);
    ordered.forEach((sc, index) => {
      fragment.appendChild(buildCard(sc, index));
    });
    fragment.appendChild(buildAddTile());
    grid.appendChild(fragment);

    statusLine.textContent = searchTerm
      ? `${filtered.length} of ${inView.length} shortcuts`
      : `${inView.length} shortcut${inView.length === 1 ? "" : "s"}`;

    if (pendingFocusId) {
      const id = pendingFocusId;
      pendingFocusId = null;
      // Find the handle by comparing dataset.id directly rather than
      // interpolating the id into a CSS attribute-selector string. That
      // would need CSS.escape() to stay safe for ids containing quotes,
      // brackets, etc. — and CSS.escape() isn't available in every
      // environment. A plain iteration needs no escaping at all.
      const handle = Array.from(grid.querySelectorAll(".card-drag-handle")).find(
        (el) => el.dataset.id === id
      );
      if (handle) handle.focus();
    }
  }

  /**
   * Builds a shortcut card using real semantic controls: a <button> that
   * fills the card and opens the site, plus sibling <button>s for
   * Favorite/Edit/Delete layered on top via CSS so they always receive
   * their own clicks even though they visually sit over the open button.
   * Actions are wired via event delegation on the grid (see init()), not
   * per-card listeners, so re-rendering never accumulates listeners.
   */
  function buildCard(shortcut, index) {
    const card = document.createElement("div");
    card.className = "shortcut-card";
    card.dataset.id = shortcut.id;

    const indexBadge = document.createElement("span");
    indexBadge.className = "card-index";
    indexBadge.setAttribute("aria-hidden", "true");
    indexBadge.textContent = index < 9 ? String(index + 1) : "·";
    card.appendChild(indexBadge);

    // Favorite / edit / delete actions.
    const actions = document.createElement("div");
    actions.className = "card-actions";

    // Drag-and-drop handle. This is the only draggable element on the
    // card, so a drag can only ever start here — clicking Favorite/Edit/
    // Delete never triggers one. It also doubles as the keyboard reorder
    // control: focus it, then Arrow Up/Down/Home/End.
    const dragHandle = document.createElement("button");
    dragHandle.type = "button";
    dragHandle.className = "card-drag-handle";
    dragHandle.draggable = true;
    dragHandle.dataset.action = "drag-handle";
    dragHandle.dataset.id = shortcut.id;
    dragHandle.title = "Drag to reorder";
    dragHandle.setAttribute(
      "aria-label",
      `Reorder ${shortcut.name}. Drag to move, or use Arrow Up, Arrow Down, Home, and End keys.`
    );
    dragHandle.textContent = "⠿";
    actions.appendChild(dragHandle);

    const favBtn = document.createElement("button");
    favBtn.className = "card-favorite-btn";
    favBtn.type = "button";
    favBtn.dataset.action = "toggle-favorite";
    favBtn.dataset.id = shortcut.id;
    favBtn.setAttribute("aria-pressed", shortcut.favorite ? "true" : "false");
    favBtn.setAttribute(
      "aria-label",
      shortcut.favorite ? `Remove ${shortcut.name} from favorites` : `Add ${shortcut.name} to favorites`
    );
    favBtn.title = shortcut.favorite ? "Unfavorite" : "Favorite";
    favBtn.textContent = shortcut.favorite ? "★" : "☆";

    const editBtn = document.createElement("button");
    editBtn.className = "card-action-btn";
    editBtn.type = "button";
    editBtn.title = "Edit";
    editBtn.setAttribute("aria-label", `Edit ${shortcut.name}`);
    editBtn.dataset.action = "edit";
    editBtn.dataset.id = shortcut.id;
    editBtn.textContent = "✎";

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "card-action-btn danger";
    deleteBtn.type = "button";
    deleteBtn.title = "Delete";
    deleteBtn.setAttribute("aria-label", `Delete ${shortcut.name}`);
    deleteBtn.dataset.action = "delete";
    deleteBtn.dataset.id = shortcut.id;
    deleteBtn.textContent = "✕";

    actions.appendChild(favBtn);
    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);
    card.appendChild(actions);

    // The main "open this site" control — covers the rest of the card.
    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "card-open";
    openBtn.dataset.action = "open";
    openBtn.dataset.id = shortcut.id;
    openBtn.setAttribute("aria-label", `Open ${shortcut.name}`);

    openBtn.appendChild(buildIcon(shortcut));

    const name = document.createElement("p");
    name.className = "card-name";
    name.textContent = shortcut.name;
    openBtn.appendChild(name);

    const domain = document.createElement("p");
    domain.className = "card-domain";
    domain.textContent = getDomain(shortcut.url);
    openBtn.appendChild(domain);

    const category = getCategoryById(shortcut.categoryId);
    if (category) {
      const tag = document.createElement("p");
      tag.className = "card-category-tag";
      tag.textContent = `${category.icon || ""} ${category.name}`.trim();
      openBtn.appendChild(tag);
    }

    card.appendChild(openBtn);

    return card;
  }

  /**
   * Builds the icon element for a shortcut according to its icon.type.
   * User-controlled values (custom image URLs, emoji) are always inserted
   * via textContent / element properties — never innerHTML — and image
   * loads fail over silently to the letter fallback so a broken or
   * unreachable custom icon never breaks the card.
   */
  function buildIcon(shortcut) {
    const wrap = document.createElement("span");
    wrap.className = "card-icon-wrap";

    const showFallback = () => {
      while (wrap.firstChild) wrap.removeChild(wrap.firstChild);
      const fallback = document.createElement("span");
      fallback.className = "card-icon-fallback";
      fallback.textContent = (shortcut.name.trim()[0] || "?").toUpperCase();
      wrap.appendChild(fallback);
    };

    const icon = shortcut.icon || { type: "favicon", value: "" };

    if (icon.type === "letter") {
      showFallback();
      return wrap;
    }

    if (icon.type === "emoji") {
      const span = document.createElement("span");
      span.className = "card-icon-emoji";
      span.textContent = icon.value;
      wrap.appendChild(span);
      return wrap;
    }

    if (icon.type === "image") {
      const revalidated = normalizeAndValidateUrl(icon.value);
      if (!revalidated) {
        showFallback();
        return wrap;
      }
      const img = document.createElement("img");
      img.className = "icon-cover";
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      img.referrerPolicy = "no-referrer";
      img.style.opacity = "0";
      img.addEventListener("load", () => {
        img.style.opacity = "1";
      });
      img.addEventListener("error", showFallback);
      img.setAttribute("src", revalidated);
      wrap.appendChild(img);
      return wrap;
    }

    // Default: automatic favicon. Starts hidden and only fades in once it
    // has actually loaded, so a slow/failing favicon service never flashes
    // a broken-image icon — it swaps straight to the letter fallback.
    const faviconUrl = getFaviconUrl(shortcut.url);
    if (!faviconUrl) {
      showFallback();
      return wrap;
    }

    const img = document.createElement("img");
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    img.style.opacity = "0";
    img.addEventListener("load", () => {
      img.style.opacity = "1";
    });
    img.addEventListener("error", showFallback);
    img.setAttribute("src", faviconUrl);

    wrap.appendChild(img);
    return wrap;
  }

  function buildAddTile() {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "add-tile";
    tile.dataset.action = "open-add-modal";
    const plus = document.createElement("span");
    plus.className = "plus";
    plus.setAttribute("aria-hidden", "true");
    plus.textContent = "+";
    const label = document.createElement("span");
    label.textContent = "Add shortcut";
    tile.appendChild(plus);
    tile.appendChild(label);
    return tile;
  }

  // ==========================================================================
  // Favorites
  // ==========================================================================

  function toggleFavorite(id) {
    const shortcut = state.shortcuts.find((sc) => sc.id === id);
    if (!shortcut) return;

    shortcut.favorite = !shortcut.favorite;
    shortcut.updatedAt = Date.now();

    const savedOk = persistState(state);
    render();

    if (!savedOk) {
      showToast("Favorite updated for this session, but it could not be saved permanently.", "error");
    }
  }

  // ==========================================================================
  // Reordering (shared core for drag-and-drop and keyboard reordering)
  // ==========================================================================

  /**
   * Moves `draggedId` to sit immediately before or after `targetId`, then
   * renumbers `position` sequentially (0..n-1) across the *entire* shortcut
   * list. Both drag-and-drop and keyboard reordering funnel through this
   * one function so ordering logic — and its persistence — lives in exactly
   * one place.
   *
   * Working from the full list (not just the current filtered view) keeps
   * position globally consistent while still doing the right thing "inside
   * the selected category": since only shortcuts visible in the active view
   * are ever offered as drag/keyboard targets, an item's neighbors in the
   * full order are, by construction, its neighbors in that filtered view
   * too — so reordering within a category never disturbs other categories'
   * relative order.
   *
   * Returns true if the shortcut moved, false if the move was a no-op or
   * either id no longer exists (e.g. deleted in another tab mid-drag).
   */
  function moveShortcut(draggedId, targetId, placeBefore) {
    if (!draggedId || !targetId || draggedId === targetId) return false;

    const dragged = state.shortcuts.find((sc) => sc.id === draggedId);
    if (!dragged) return false;
    if (!state.shortcuts.some((sc) => sc.id === targetId)) return false;

    const ordered = [...state.shortcuts].sort((a, b) => a.position - b.position);
    const fromIndex = ordered.findIndex((sc) => sc.id === draggedId);
    if (fromIndex === -1) return false;
    ordered.splice(fromIndex, 1);

    let toIndex = ordered.findIndex((sc) => sc.id === targetId);
    if (toIndex === -1) return false;
    if (!placeBefore) toIndex += 1;
    ordered.splice(toIndex, 0, dragged);

    // ordered holds the same object references as state.shortcuts, so this
    // mutates the real records in place — no need to reassign the array.
    ordered.forEach((sc, i) => {
      sc.position = i;
    });

    return true;
  }

  /**
   * Persists a successful reorder and reports the outcome. Shared by drag
   * drop and keyboard reordering so both get identical persistence
   * hardening and messaging.
   */
  function commitReorder() {
    const savedOk = persistState(state);
    render();
    if (!savedOk) {
      showToast("Order changed for this session, but could not be saved permanently.", "error");
    }
    return savedOk;
  }

  /**
   * Keyboard alternative to drag-and-drop. Operates on the shortcut's
   * position within the currently *visible* (filtered) list — the same set
   * a mouse-drag would offer as targets — so keyboard and drag reordering
   * always agree on what "up"/"down"/"start"/"end" mean.
   */
  function reorderWithKeyboard(id, key) {
    const visible = [...getFilteredShortcuts()].sort((a, b) => a.position - b.position);
    const index = visible.findIndex((sc) => sc.id === id);
    if (index === -1) return;

    let moved = false;
    if (key === "ArrowUp" && index > 0) {
      moved = moveShortcut(id, visible[index - 1].id, true);
    } else if (key === "ArrowDown" && index < visible.length - 1) {
      moved = moveShortcut(id, visible[index + 1].id, false);
    } else if (key === "Home" && index > 0) {
      moved = moveShortcut(id, visible[0].id, true);
    } else if (key === "End" && index < visible.length - 1) {
      moved = moveShortcut(id, visible[visible.length - 1].id, false);
    } else {
      return; // already at that boundary — nothing to do
    }

    if (!moved) return;
    pendingFocusId = id;
    commitReorder();
  }

  function clearDragIndicators() {
    grid.querySelectorAll(".drag-over-before, .drag-over-after").forEach((el) => {
      el.classList.remove("drag-over-before", "drag-over-after");
    });
  }

  function handleGridDragStart(e) {
    const handle = e.target.closest('[data-action="drag-handle"]');
    if (!handle) return; // draggable is only ever set on the handle itself
    const card = handle.closest(".shortcut-card");
    if (!card || !card.dataset.id) {
      e.preventDefault();
      return;
    }
    draggingId = card.dataset.id;
    e.dataTransfer.effectAllowed = "move";
    try {
      e.dataTransfer.setData("text/plain", draggingId);
    } catch (err) {
      // Some browsers restrict setData in certain contexts; the drag still
      // works via the in-memory draggingId, so this is safe to ignore.
    }
    // Adding the class synchronously would make the drag ghost image
    // reflect the faded state; deferring one frame avoids that.
    window.requestAnimationFrame(() => card.classList.add("dragging"));
  }

  function handleGridDragOver(e) {
    if (!draggingId) return;
    const card = e.target.closest(".shortcut-card");
    if (!card || !grid.contains(card)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (card.dataset.id === draggingId) {
      clearDragIndicators();
      return;
    }
    const rect = card.getBoundingClientRect();
    const before = e.clientY - rect.top < rect.height / 2;
    clearDragIndicators();
    card.classList.add(before ? "drag-over-before" : "drag-over-after");
  }

  function handleGridDrop(e) {
    if (!draggingId) return;
    const card = e.target.closest(".shortcut-card");
    clearDragIndicators();
    if (!card || !grid.contains(card)) {
      draggingId = null;
      return;
    }
    e.preventDefault();

    const targetId = card.dataset.id;
    const sourceId = draggingId;
    draggingId = null;

    if (!targetId || targetId === sourceId) return;

    const rect = card.getBoundingClientRect();
    const before = e.clientY - rect.top < rect.height / 2;
    const moved = moveShortcut(sourceId, targetId, before);
    if (moved) commitReorder();
  }

  function handleGridDragEnd() {
    draggingId = null;
    clearDragIndicators();
    grid.querySelectorAll(".shortcut-card.dragging").forEach((el) => el.classList.remove("dragging"));
  }

  function handleGridHandleKeydown(e) {
    const handle = e.target.closest('[data-action="drag-handle"]');
    if (!handle) return;
    if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    reorderWithKeyboard(handle.dataset.id, e.key);
  }

  // ==========================================================================
  // Views (sidebar navigation)
  // ==========================================================================

  function selectView(type, categoryId) {
    currentView = { type, categoryId: categoryId || null };
    closeSidebarDrawer();
    render();
  }

  // ==========================================================================
  // Modal: add / edit shortcut
  // ==========================================================================

  function populateCategorySelect(selectedId) {
    while (categorySelect.firstChild) categorySelect.removeChild(categorySelect.firstChild);

    const noneOption = document.createElement("option");
    noneOption.value = "";
    noneOption.textContent = "No category";
    categorySelect.appendChild(noneOption);

    const sorted = [...state.categories].sort((a, b) => a.position - b.position);
    sorted.forEach((cat) => {
      const opt = document.createElement("option");
      opt.value = cat.id;
      opt.textContent = `${cat.icon || ""} ${cat.name}`.trim();
      categorySelect.appendChild(opt);
    });

    categorySelect.value = selectedId || "";
  }

  function updateIconValueVisibility() {
    const selected = shortcutForm.querySelector('input[name="iconType"]:checked');
    const type = selected ? selected.value : "favicon";

    if (type === "image") {
      iconValueInput.hidden = false;
      iconValueInput.placeholder = "https://example.com/icon.png";
      iconHint.hidden = false;
      iconHint.textContent = "Paste a direct link to an image. Falls back to a letter if it can't load.";
    } else if (type === "emoji") {
      iconValueInput.hidden = false;
      iconValueInput.placeholder = "e.g. 🚀";
      iconHint.hidden = false;
      iconHint.textContent = "Paste a single emoji.";
    } else if (type === "letter") {
      iconValueInput.hidden = true;
      iconHint.hidden = false;
      iconHint.textContent = "Uses the first letter of the name.";
    } else {
      iconValueInput.hidden = true;
      iconHint.hidden = false;
      iconHint.textContent = "Loads the site's favicon automatically.";
    }
  }

  function setIconTypeRadio(type) {
    const radios = shortcutForm.querySelectorAll('input[name="iconType"]');
    radios.forEach((r) => {
      r.checked = r.value === type;
    });
  }

  function openAddModal(opener) {
    shortcutForm.reset();
    shortcutIdInput.value = "";
    modalTitle.textContent = "Add Shortcut";
    submitBtn.textContent = "Add";
    clearFieldErrors();
    hideFormError();

    // Convenience: if the user is currently browsing a specific category,
    // preselect it for the new shortcut.
    const preselectCategory = currentView.type === "category" ? currentView.categoryId : "";
    populateCategorySelect(preselectCategory);

    setIconTypeRadio("favicon");
    iconValueInput.value = "";
    updateIconValueVisibility();
    favoriteInput.checked = currentView.type === "favorites";

    showModal(modalOverlay, nameInput, opener);
  }

  function openEditModal(id, opener) {
    const shortcut = state.shortcuts.find((sc) => sc.id === id);
    if (!shortcut) return;

    shortcutIdInput.value = shortcut.id;
    nameInput.value = shortcut.name;
    urlInput.value = shortcut.url;
    modalTitle.textContent = "Edit Shortcut";
    submitBtn.textContent = "Save Changes";
    clearFieldErrors();
    hideFormError();

    populateCategorySelect(shortcut.categoryId);

    const icon = shortcut.icon || { type: "favicon", value: "" };
    setIconTypeRadio(icon.type);
    iconValueInput.value = icon.type === "image" || icon.type === "emoji" ? icon.value : "";
    updateIconValueVisibility();

    favoriteInput.checked = shortcut.favorite;

    showModal(modalOverlay, nameInput, opener);
  }

  function closeAddEditModal() {
    hideModal(modalOverlay);
  }

  function showFormError(message, field) {
    formError.textContent = message;
    formError.hidden = false;
    clearFieldErrors();
    if (field) field.setAttribute("aria-invalid", "true");
  }

  function hideFormError() {
    formError.hidden = true;
    formError.textContent = "";
  }

  function clearFieldErrors() {
    nameInput.removeAttribute("aria-invalid");
    urlInput.removeAttribute("aria-invalid");
    iconValueInput.removeAttribute("aria-invalid");
  }

  function handleFormSubmit(e) {
    e.preventDefault();
    hideFormError();

    const id = shortcutIdInput.value || null;
    const name = nameInput.value.trim();
    const rawUrl = urlInput.value.trim();

    if (!name) {
      showFormError("Please enter a name for this shortcut.", nameInput);
      nameInput.focus();
      return;
    }

    if (!rawUrl) {
      showFormError("Please enter a URL.", urlInput);
      urlInput.focus();
      return;
    }

    const url = normalizeAndValidateUrl(rawUrl);
    if (!url) {
      showFormError(
        "That doesn't look like a valid web address. Try something like \"example.com\" or \"router\".",
        urlInput
      );
      urlInput.focus();
      return;
    }

    // If we're editing, confirm the shortcut still exists *before* doing
    // anything else — it could have been deleted (e.g. in another tab)
    // while this modal was open. In that case we must not modify anything,
    // must not touch localStorage, and must not claim a successful update.
    let target = null;
    if (id) {
      target = state.shortcuts.find((sc) => sc.id === id);
      if (!target) {
        closeAddEditModal();
        showToast("This shortcut no longer exists.", "error");
        return;
      }
    }

    // Duplicate check — based on the full normalized URL, not just the
    // domain, so different paths on the same site are allowed. The
    // shortcut currently being edited is excluded from the check.
    const urlKey = comparableUrlKey(url);
    const duplicate = state.shortcuts.find(
      (sc) => sc.id !== id && comparableUrlKey(sc.url) === urlKey
    );
    if (duplicate) {
      showFormError(`You already have a shortcut for this URL ("${duplicate.name}").`, urlInput);
      return;
    }

    // Category — the select is always populated from state.categories, so
    // any non-empty value is already known-valid.
    const categoryId = categorySelect.value || null;

    // Icon.
    const selectedIconType = shortcutForm.querySelector('input[name="iconType"]:checked');
    const iconType = selectedIconType ? selectedIconType.value : "favicon";
    let icon = { type: "favicon", value: "" };

    if (iconType === "image") {
      const rawIconValue = iconValueInput.value.trim();
      if (!rawIconValue) {
        showFormError("Enter an image URL, or choose a different icon type.", iconValueInput);
        iconValueInput.focus();
        return;
      }
      const validatedIconUrl = normalizeAndValidateUrl(rawIconValue);
      if (!validatedIconUrl) {
        showFormError("That doesn't look like a valid image URL (http/https).", iconValueInput);
        iconValueInput.focus();
        return;
      }
      icon = { type: "image", value: validatedIconUrl };
    } else if (iconType === "emoji") {
      const rawEmoji = iconValueInput.value.trim();
      if (!rawEmoji) {
        showFormError("Enter an emoji, or choose a different icon type.", iconValueInput);
        iconValueInput.focus();
        return;
      }
      icon = { type: "emoji", value: rawEmoji.slice(0, MAX_EMOJI_LENGTH) };
    } else if (iconType === "letter") {
      icon = { type: "letter", value: "" };
    } else {
      icon = { type: "favicon", value: "" };
    }

    const trimmedName = name.slice(0, MAX_NAME_LENGTH);
    const favorite = favoriteInput.checked;
    const now = Date.now();

    if (target) {
      // Editing an existing shortcut — same id, same position, same
      // createdAt. Everything else updates in place.
      target.name = trimmedName;
      target.url = url;
      target.categoryId = categoryId;
      target.favorite = favorite;
      target.icon = icon;
      target.updatedAt = now;
    } else {
      state.shortcuts.push({
        id: generateId(),
        name: trimmedName,
        url,
        icon,
        categoryId,
        favorite,
        position: state.shortcuts.length,
        createdAt: now,
        updatedAt: now,
      });
    }

    const savedOk = persistState(state);

    render();
    closeAddEditModal();

    if (target) {
      showToast(
        savedOk ? "Shortcut updated." : "Your changes were made for this session, but could not be saved permanently.",
        savedOk ? "success" : "error"
      );
    } else {
      showToast(
        savedOk ? "Shortcut added." : "Your shortcut was added, but it could not be saved permanently.",
        savedOk ? "success" : "error"
      );
    }
  }

  // ==========================================================================
  // Modal: delete shortcut confirmation
  // ==========================================================================

  function openDeleteConfirm(id, opener) {
    const shortcut = state.shortcuts.find((sc) => sc.id === id);
    if (!shortcut) return;
    pendingDeleteId = id;
    deleteName.textContent = shortcut.name;
    showModal(deleteOverlay, deleteCancelBtn, opener);
  }

  function closeDeleteConfirm() {
    pendingDeleteId = null;
    hideModal(deleteOverlay);
  }

  function confirmDelete() {
    if (!pendingDeleteId) {
      closeDeleteConfirm();
      return;
    }

    const existed = state.shortcuts.some((sc) => sc.id === pendingDeleteId);
    if (!existed) {
      closeDeleteConfirm();
      return;
    }

    state.shortcuts = state.shortcuts.filter((sc) => sc.id !== pendingDeleteId);
    const savedOk = persistState(state);

    render();
    closeDeleteConfirm();

    showToast(
      savedOk ? "Shortcut deleted." : "Shortcut deleted for this session, but the change could not be saved permanently.",
      savedOk ? "success" : "error"
    );
  }

  // ==========================================================================
  // Modal: add / rename category
  // ==========================================================================

  function openCategoryAddModal(opener) {
    categoryForm.reset();
    categoryIdInput.value = "";
    categoryModalTitle.textContent = "New Category";
    categorySubmitBtn.textContent = "Create";
    categoryIconInput.value = "📁";
    hideCategoryFormError();
    showModal(categoryModalOverlay, categoryIconInput, opener);
  }

  function openCategoryRenameModal(id, opener) {
    const category = getCategoryById(id);
    if (!category) return;
    categoryIdInput.value = category.id;
    categoryModalTitle.textContent = "Rename Category";
    categorySubmitBtn.textContent = "Save Changes";
    categoryIconInput.value = category.icon || "";
    categoryNameInput.value = category.name;
    hideCategoryFormError();
    showModal(categoryModalOverlay, categoryNameInput, opener);
  }

  function closeCategoryModal() {
    hideModal(categoryModalOverlay);
  }

  function showCategoryFormError(message) {
    categoryFormError.textContent = message;
    categoryFormError.hidden = false;
    categoryNameInput.setAttribute("aria-invalid", "true");
  }

  function hideCategoryFormError() {
    categoryFormError.hidden = true;
    categoryFormError.textContent = "";
    categoryNameInput.removeAttribute("aria-invalid");
  }

  function handleCategoryFormSubmit(e) {
    e.preventDefault();
    hideCategoryFormError();

    const id = categoryIdInput.value || null;
    const name = categoryNameInput.value.trim();
    const icon = categoryIconInput.value.trim().slice(0, 8) || "📁";

    if (!name) {
      showCategoryFormError("Please enter a category name.");
      categoryNameInput.focus();
      return;
    }

    const trimmedName = name.slice(0, MAX_CATEGORY_NAME_LENGTH);

    const duplicate = state.categories.find(
      (c) => c.id !== id && c.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicate) {
      showCategoryFormError(`A category named "${duplicate.name}" already exists.`);
      categoryNameInput.focus();
      return;
    }

    let savedOk;

    if (id) {
      const target = state.categories.find((c) => c.id === id);
      if (!target) {
        closeCategoryModal();
        showToast("This category no longer exists.", "error");
        return;
      }
      target.name = trimmedName;
      target.icon = icon;
      savedOk = persistState(state);
    } else {
      state.categories.push({
        id: generateId(),
        name: trimmedName,
        icon,
        position: state.categories.length,
      });
      savedOk = persistState(state);
    }

    render();
    closeCategoryModal();

    showToast(
      savedOk ? "Category saved." : "Category saved for this session, but could not be saved permanently.",
      savedOk ? "success" : "error"
    );
  }

  // ==========================================================================
  // Modal: delete category confirmation
  // ==========================================================================

  function openCategoryDeleteConfirm(id, opener) {
    const category = getCategoryById(id);
    if (!category) return;
    pendingCategoryDeleteId = id;
    categoryDeleteName.textContent = category.name;
    showModal(categoryDeleteOverlay, categoryDeleteCancelBtn, opener);
  }

  function closeCategoryDeleteConfirm() {
    pendingCategoryDeleteId = null;
    hideModal(categoryDeleteOverlay);
  }

  function confirmCategoryDelete() {
    if (!pendingCategoryDeleteId) {
      closeCategoryDeleteConfirm();
      return;
    }

    const existed = state.categories.some((c) => c.id === pendingCategoryDeleteId);
    if (!existed) {
      closeCategoryDeleteConfirm();
      return;
    }

    // Deleting a category never deletes its shortcuts — they become
    // uncategorized instead.
    state.categories = state.categories.filter((c) => c.id !== pendingCategoryDeleteId);
    state.shortcuts.forEach((sc) => {
      if (sc.categoryId === pendingCategoryDeleteId) sc.categoryId = null;
    });

    // If the deleted category was being viewed, fall back to All.
    if (currentView.type === "category" && currentView.categoryId === pendingCategoryDeleteId) {
      currentView = { type: "all", categoryId: null };
    }

    const savedOk = persistState(state);

    render();
    closeCategoryDeleteConfirm();

    showToast(
      savedOk
        ? "Category deleted. Its shortcuts are now uncategorized."
        : "Category deleted for this session, but the change could not be saved permanently.",
      savedOk ? "success" : "error"
    );
  }

  // ==========================================================================
  // Move shortcut to a different category (context menu action)
  // ==========================================================================

  function moveShortcutToCategory(id, categoryId) {
    const shortcut = state.shortcuts.find((sc) => sc.id === id);
    if (!shortcut) return;
    if (shortcut.categoryId === (categoryId || null)) return; // already there

    shortcut.categoryId = categoryId || null;
    shortcut.updatedAt = Date.now();

    const savedOk = persistState(state);
    render();

    const category = getCategoryById(categoryId);
    const label = category ? category.name : "Uncategorized";
    showToast(
      savedOk
        ? `Moved to ${label}.`
        : `Moved to ${label} for this session, but it could not be saved permanently.`,
      savedOk ? "success" : "error"
    );
  }

  // ==========================================================================
  // Open behavior — current tab vs new tab are genuinely different actions
  // ==========================================================================

  function openShortcutNewTab(id) {
    const shortcut = state.shortcuts.find((sc) => sc.id === id);
    if (!shortcut) return;
    window.open(shortcut.url, "_blank", "noopener,noreferrer");
  }

  function openShortcutCurrentTab(id) {
    const shortcut = state.shortcuts.find((sc) => sc.id === id);
    if (!shortcut) return;
    window.location.assign(shortcut.url);
  }

  // ==========================================================================
  // Export
  // ==========================================================================

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function exportState() {
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const now = new Date();
    const filename = `shortcut-dashboard-backup-${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}.json`;

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast("Backup exported.", "success");
  }

  // ==========================================================================
  // Import: validation, Replace, and Merge
  // ==========================================================================

  function handleImportFileChange(e) {
    const file = e.target.files && e.target.files[0];
    importFileInput.value = ""; // allow re-selecting the same file later
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => processImportedText(String(reader.result || ""));
    reader.onerror = () => showToast("That file could not be read.", "error");
    reader.readAsText(file);
  }

  /**
   * Validates and sanitizes an imported backup's raw text, then — if it
   * contains anything usable — opens the Replace/Merge/Cancel confirmation.
   * Nothing is written to state or storage here; this function only reads
   * and validates.
   */
  function processImportedText(text) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      showToast("That file is not valid JSON.", "error");
      return;
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      showToast("That file isn't a recognized backup format.", "error");
      return;
    }

    if (parsed.version !== 2) {
      showToast("That backup's version isn't supported by this version of the app.", "error");
      return;
    }

    // sanitizeState() does the heavy lifting: validates structure, URLs,
    // and categories field-by-field, drops individually malformed records
    // instead of failing the whole import, and resolves duplicate ids /
    // duplicate normalized URLs within the file itself.
    const clean = sanitizeState(parsed);

    if (clean.categories.length === 0 && clean.shortcuts.length === 0) {
      showToast("That backup didn't contain any usable shortcuts or categories.", "error");
      return;
    }

    pendingImport = clean;
    openImportConfirm(clean);
  }

  function openImportConfirm(clean) {
    const shortcutWord = clean.shortcuts.length === 1 ? "shortcut" : "shortcuts";
    const categoryWord = clean.categories.length === 1 ? "category" : "categories";
    importConfirmSummary.textContent =
      `This backup has ${clean.shortcuts.length} ${shortcutWord} and ${clean.categories.length} ${categoryWord}. ` +
      "Choose how to bring it in:";

    // Only one modal is ever "active" at a time (single focus-trap state);
    // close Settings first rather than stacking two overlays.
    if (activeModal === settingsOverlay) hideModal(settingsOverlay);
    showModal(importConfirmOverlay, importMergeBtn, settingsBtn);
  }

  function closeImportConfirm() {
    pendingImport = null;
    hideModal(importConfirmOverlay);
  }

  function confirmImportReplace() {
    if (!pendingImport) {
      closeImportConfirm();
      return;
    }
    const next = pendingImport;
    const savedOk = persistState(next);
    state = next;
    currentView = { type: "all", categoryId: null };
    searchTerm = "";
    searchInput.value = "";

    render();
    applyAllAppearance(); // a Replace swaps in the backup's settings too (theme, grid size, background, ...)
    closeImportConfirm();

    showToast(
      savedOk
        ? `Import complete. Replaced with ${next.shortcuts.length} shortcuts.`
        : "Import applied for this session, but could not be saved permanently.",
      savedOk ? "success" : "error"
    );
  }

  /**
   * Merges an imported (already-sanitized) state into the current one.
   * Existing data always wins on conflict and is never modified or
   * removed — merge only ever adds:
   *  - Categories are matched by case-insensitive name; a match reuses the
   *    existing category (resolves "conflicting categories") instead of
   *    creating a duplicate. New categories whose id collides with an
   *    existing one are assigned a fresh id.
   *  - Shortcuts whose normalized URL already exists are skipped (resolves
   *    duplicate normalized URLs — the existing shortcut is kept as-is).
   *    Surviving shortcuts whose id collides with an existing one are
   *    assigned a fresh id (resolves duplicate IDs).
   */
  function mergeStates(current, imported) {
    const nextCategories = current.categories.map((c) => ({ ...c }));
    const nameToId = new Map(nextCategories.map((c) => [c.name.toLowerCase(), c.id]));
    const categoryIdMap = new Map(); // imported category id -> resolved id in nextCategories
    let nextCategoryPosition = nextCategories.length
      ? Math.max(...nextCategories.map((c) => c.position)) + 1
      : 0;
    let addedCategories = 0;

    imported.categories.forEach((cat) => {
      const key = cat.name.toLowerCase();
      if (nameToId.has(key)) {
        categoryIdMap.set(cat.id, nameToId.get(key));
        return;
      }
      const newId = nextCategories.some((c) => c.id === cat.id) ? generateId() : cat.id;
      const newCategory = { id: newId, name: cat.name, icon: cat.icon, position: nextCategoryPosition++ };
      nextCategories.push(newCategory);
      nameToId.set(key, newId);
      categoryIdMap.set(cat.id, newId);
      addedCategories++;
    });

    const nextShortcuts = current.shortcuts.map((sc) => ({ ...sc }));
    const existingUrlKeys = new Set(nextShortcuts.map((sc) => comparableUrlKey(sc.url)));
    const existingIds = new Set(nextShortcuts.map((sc) => sc.id));
    let nextPosition = nextShortcuts.length ? Math.max(...nextShortcuts.map((sc) => sc.position)) + 1 : 0;
    let addedShortcuts = 0;
    let skippedShortcuts = 0;

    imported.shortcuts.forEach((sc) => {
      const urlKey = comparableUrlKey(sc.url);
      if (existingUrlKeys.has(urlKey)) {
        skippedShortcuts++; // existing shortcut for this URL always wins
        return;
      }
      const newId = existingIds.has(sc.id) ? generateId() : sc.id;
      const mappedCategoryId =
        sc.categoryId && categoryIdMap.has(sc.categoryId) ? categoryIdMap.get(sc.categoryId) : null;

      nextShortcuts.push({ ...sc, id: newId, categoryId: mappedCategoryId, position: nextPosition++ });
      existingUrlKeys.add(urlKey);
      existingIds.add(newId);
      addedShortcuts++;
    });

    return {
      state: { version: 2, settings: current.settings, categories: nextCategories, shortcuts: nextShortcuts },
      addedShortcuts,
      addedCategories,
      skippedShortcuts,
    };
  }

  function confirmImportMerge() {
    if (!pendingImport) {
      closeImportConfirm();
      return;
    }
    const result = mergeStates(state, pendingImport);
    const savedOk = persistState(result.state);
    state = result.state;

    render();
    closeImportConfirm();

    const skippedNote = result.skippedShortcuts
      ? ` ${result.skippedShortcuts} duplicate shortcut${result.skippedShortcuts === 1 ? "" : "s"} skipped.`
      : "";
    showToast(
      savedOk
        ? `Merged: added ${result.addedShortcuts} shortcuts, ${result.addedCategories} categories.${skippedNote}`
        : "Merge applied for this session, but could not be saved permanently.",
      savedOk ? "success" : "error"
    );
  }

  // ==========================================================================
  // Settings modal
  // ==========================================================================

  /**
   * Activates one settings tab (and its panel), deactivating the rest.
   * `focusTab` additionally moves keyboard focus to the newly active tab
   * button — used for arrow-key navigation, but not for the initial open
   * (where a mouse click already placed focus, or the dialog itself should
   * receive focus instead).
   */
  function selectSettingsTab(tabBtn, focusTab) {
    settingsTabs.forEach((tab) => {
      const isActive = tab === tabBtn;
      tab.setAttribute("aria-selected", isActive ? "true" : "false");
      tab.tabIndex = isActive ? 0 : -1;
    });
    settingsPanels.forEach((panel) => {
      panel.hidden = panel.id !== tabBtn.dataset.panel;
    });
    if (focusTab) tabBtn.focus();
  }

  function handleSettingsTabsClick(e) {
    const tabBtn = e.target.closest(".settings-tab");
    if (!tabBtn) return;
    selectSettingsTab(tabBtn, false);
  }

  function handleSettingsTabsKeydown(e) {
    const currentTab = e.target.closest(".settings-tab");
    if (!currentTab) return;
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const index = settingsTabs.indexOf(currentTab);
    let nextIndex;
    if (e.key === "ArrowRight") nextIndex = (index + 1) % settingsTabs.length;
    else if (e.key === "ArrowLeft") nextIndex = (index - 1 + settingsTabs.length) % settingsTabs.length;
    else if (e.key === "Home") nextIndex = 0;
    else nextIndex = settingsTabs.length - 1;
    selectSettingsTab(settingsTabs[nextIndex], true);
  }

  function updateBackgroundFieldsVisibility(type) {
    bgColorFields.hidden = type !== "color";
    bgGradientFields.hidden = type !== "gradient";
    bgImageFields.hidden = type !== "image";
  }

  /** Reflects the current state.settings into every settings control. */
  function populateSettingsControls() {
    themeControl.querySelectorAll('input[name="theme"]').forEach((r) => {
      r.checked = r.value === state.settings.theme;
    });
    gridSizeControl.querySelectorAll('input[name="gridSize"]').forEach((r) => {
      r.checked = r.value === state.settings.gridSize;
    });

    showSearchInput.checked = state.settings.showSearch;
    showDomainInput.checked = state.settings.showDomain;
    showClockInput.checked = state.settings.showClock;

    const bg = state.settings.background;
    backgroundTypeControl.querySelectorAll('input[name="backgroundType"]').forEach((r) => {
      r.checked = r.value === bg.type;
    });
    bgColorInput.value = bg.color;
    bgGradientFromInput.value = bg.gradientFrom;
    bgGradientToInput.value = bg.gradientTo;
    bgImageUrlInput.value = bg.imageUrl;
    // Reflect the actual runtime load state (e.g. a failure that happened
    // at page load, before Settings was ever opened) rather than blindly
    // hiding the message — otherwise reopening Settings would hide a
    // still-relevant error about the saved URL.
    updateBackgroundImageErrorUI();
    updateBackgroundFieldsVisibility(bg.type);
  }

  /**
   * Persists a mutation already applied to state.settings, re-applies the
   * affected UI, and surfaces a save failure the same way every other
   * mutation in the app does. Settings changes don't get a success toast
   * (there are too many of them for that to stay useful) — only failures
   * are worth interrupting the user for.
   */
  function commitSettingsChange(applyFn) {
    const savedOk = persistState(state);
    applyFn();
    if (!savedOk) {
      showToast("Setting changed for this session, but could not be saved permanently.", "error");
    }
  }

  function handleThemeChange(e) {
    if (e.target.name !== "theme") return;
    state.settings.theme = e.target.value;
    commitSettingsChange(applyTheme);
  }

  function handleGridSizeChange(e) {
    if (e.target.name !== "gridSize") return;
    state.settings.gridSize = e.target.value;
    commitSettingsChange(applyGridSize);
  }

  function handleShowSearchChange() {
    state.settings.showSearch = showSearchInput.checked;
    commitSettingsChange(applyDisplayOptions);
  }

  function handleShowDomainChange() {
    state.settings.showDomain = showDomainInput.checked;
    commitSettingsChange(applyDisplayOptions);
  }

  function handleShowClockChange() {
    state.settings.showClock = showClockInput.checked;
    commitSettingsChange(applyDisplayOptions);
  }

  function handleBackgroundTypeChange(e) {
    if (e.target.name !== "backgroundType") return;
    state.settings.background.type = e.target.value;
    updateBackgroundFieldsVisibility(e.target.value);
    commitSettingsChange(applyBackground);
  }

  function handleBgColorChange() {
    state.settings.background.color = bgColorInput.value;
    commitSettingsChange(applyBackground);
  }

  function handleBgGradientChange() {
    state.settings.background.gradientFrom = bgGradientFromInput.value;
    state.settings.background.gradientTo = bgGradientToInput.value;
    commitSettingsChange(applyBackground);
  }

  function handleBgImageUrlChange() {
    const raw = bgImageUrlInput.value.trim();
    if (!raw) {
      state.settings.background.imageUrl = "";
      commitSettingsChange(applyBackground); // applyBackground() clears the error message for us
      return;
    }
    const validated = normalizeAndValidateUrl(raw);
    if (!validated) {
      // Format-invalid input (not even a well-formed http/https URL) is a
      // distinct, pre-save concern from backgroundImageLoadFailed: nothing
      // was saved or attempted over the network, so the runtime
      // load-failure flag is untouched. This message is purely about the
      // text currently in the field, and — like that text — won't survive
      // closing Settings without a valid save.
      bgImageError.textContent = "That doesn't look like a valid http/https image URL.";
      bgImageError.hidden = false;
      return;
    }
    state.settings.background.imageUrl = validated;
    bgImageUrlInput.value = validated;
    commitSettingsChange(applyBackground);
  }

  function openSettings(opener) {
    populateSettingsControls();
    selectSettingsTab(settingsTabs[0], false);
    showModal(settingsOverlay, settingsTabs[0], opener || settingsBtn);
  }

  function closeSettings() {
    hideModal(settingsOverlay);
  }

  // ==========================================================================
  // Context menu (right-click on a shortcut card)
  // ==========================================================================

  function isContextMenuOpen() {
    return !contextMenu.hidden;
  }

  function closeContextMenu() {
    if (contextMenu.hidden) return;
    contextMenu.hidden = true;
    contextMenu.innerHTML = "";
    contextMenuTargetId = null;
    document.removeEventListener("click", handleContextMenuOutsideClick, true);
    document.removeEventListener("keydown", handleContextMenuKeydown, true);
    if (contextMenuOpener && typeof contextMenuOpener.focus === "function") {
      contextMenuOpener.focus();
    }
    contextMenuOpener = null;
  }

  function handleContextMenuOutsideClick(e) {
    if (!contextMenu.contains(e.target)) closeContextMenu();
  }

  function handleContextMenuKeydown(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      closeContextMenu();
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const items = Array.from(contextMenu.querySelectorAll(".context-menu-item"));
    if (items.length === 0) return;
    e.preventDefault();
    const currentIndex = items.indexOf(document.activeElement);
    let nextIndex;
    if (currentIndex === -1) {
      nextIndex = 0;
    } else if (e.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % items.length;
    } else {
      nextIndex = (currentIndex - 1 + items.length) % items.length;
    }
    items[nextIndex].focus();
  }

  function buildContextMenuItem({ label, danger, checked, onSelect }) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "context-menu-item" + (danger ? " danger" : "");
    btn.setAttribute("role", "menuitem");
    if (typeof checked === "boolean") btn.setAttribute("aria-checked", String(checked));
    btn.textContent = label;
    btn.addEventListener("click", () => {
      closeContextMenu();
      onSelect();
    });
    return btn;
  }

  function openContextMenu(id, x, y, opener) {
    const shortcut = state.shortcuts.find((sc) => sc.id === id);
    if (!shortcut) return;

    // Close first in case a different card's menu was already open.
    closeContextMenu();

    contextMenuTargetId = id;
    contextMenuOpener = opener || null;
    contextMenu.innerHTML = "";

    contextMenu.appendChild(
      buildContextMenuItem({ label: "Open", onSelect: () => openShortcutCurrentTab(id) })
    );
    contextMenu.appendChild(
      buildContextMenuItem({ label: "Open in new tab", onSelect: () => openShortcutNewTab(id) })
    );
    contextMenu.appendChild(
      buildContextMenuItem({ label: "Edit", onSelect: () => openEditModal(id, grid) })
    );
    contextMenu.appendChild(
      buildContextMenuItem({
        label: shortcut.favorite ? "Unfavorite" : "Favorite",
        onSelect: () => toggleFavorite(id),
      })
    );

    const divider1 = document.createElement("div");
    divider1.className = "context-menu-divider";
    contextMenu.appendChild(divider1);

    // "Move to category" submenu — inline list of every category plus
    // "No category", with the current one checked.
    const submenuLabel = document.createElement("div");
    submenuLabel.className = "context-menu-label";
    submenuLabel.setAttribute("role", "presentation");
    submenuLabel.textContent = "Move to category";
    contextMenu.appendChild(submenuLabel);

    const submenu = document.createElement("div");
    submenu.className = "context-submenu";

    const noneItem = buildContextMenuItem({
      label: "No category",
      checked: !shortcut.categoryId,
      onSelect: () => moveShortcutToCategory(id, null),
    });
    noneItem.classList.add("context-submenu-item");
    submenu.appendChild(noneItem);

    const sortedCategories = [...state.categories].sort((a, b) => a.position - b.position);
    sortedCategories.forEach((cat) => {
      const item = buildContextMenuItem({
        label: `${cat.icon || ""} ${cat.name}`.trim(),
        checked: shortcut.categoryId === cat.id,
        onSelect: () => moveShortcutToCategory(id, cat.id),
      });
      item.classList.add("context-submenu-item");
      submenu.appendChild(item);
    });
    contextMenu.appendChild(submenu);

    const divider2 = document.createElement("div");
    divider2.className = "context-menu-divider";
    contextMenu.appendChild(divider2);

    contextMenu.appendChild(
      buildContextMenuItem({ label: "Delete", danger: true, onSelect: () => openDeleteConfirm(id, grid) })
    );

    // Position first (off-screen-safe), then reveal.
    contextMenu.style.left = "0px";
    contextMenu.style.top = "0px";
    contextMenu.hidden = false;

    const menuRect = contextMenu.getBoundingClientRect();
    const maxLeft = window.innerWidth - menuRect.width - 8;
    const maxTop = window.innerHeight - menuRect.height - 8;
    contextMenu.style.left = `${Math.max(8, Math.min(x, maxLeft))}px`;
    contextMenu.style.top = `${Math.max(8, Math.min(y, maxTop))}px`;

    document.addEventListener("click", handleContextMenuOutsideClick, true);
    document.addEventListener("keydown", handleContextMenuKeydown, true);

    const firstItem = contextMenu.querySelector(".context-menu-item");
    if (firstItem) firstItem.focus();
  }

  function handleGridContextMenu(e) {
    const card = e.target.closest(".shortcut-card");
    if (!card || !grid.contains(card)) return;
    e.preventDefault();
    openContextMenu(card.dataset.id, e.clientX, e.clientY, card.querySelector(".card-open"));
  }

  // ==========================================================================
  // Generic modal show/hide + focus management (extended for 4 overlays)
  // ==========================================================================

  const MODAL_CLOSE_FNS = new Map(); // populated in init() once all close fns exist

  function getFocusableElements(container) {
    const selector = [
      "a[href]",
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      '[tabindex]:not([tabindex="-1"])',
    ].join(",");
    return Array.from(container.querySelectorAll(selector)).filter(
      (el) => el.offsetParent !== null || el === document.activeElement
    );
  }

  function handleModalKeydown(e) {
    if (!activeModal) return;

    if (e.key === "Escape") {
      e.preventDefault();
      const closeFn = MODAL_CLOSE_FNS.get(activeModal);
      if (closeFn) closeFn();
      return;
    }

    if (e.key !== "Tab") return;

    const dialog = activeModal.querySelector('[role="dialog"]');
    const focusable = getFocusableElements(dialog);
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function anyOverlayOpen() {
    return (
      !modalOverlay.hidden ||
      !deleteOverlay.hidden ||
      !categoryModalOverlay.hidden ||
      !categoryDeleteOverlay.hidden ||
      !settingsOverlay.hidden ||
      !importConfirmOverlay.hidden
    );
  }

  function showModal(overlay, focusEl, opener) {
    activeModal = overlay;
    modalOpener = opener || document.activeElement;
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleModalKeydown, true);
    window.setTimeout(() => {
      if (focusEl) focusEl.focus();
    }, 0);
  }

  function hideModal(overlay) {
    overlay.hidden = true;
    activeModal = null;
    document.removeEventListener("keydown", handleModalKeydown, true);

    if (!anyOverlayOpen()) {
      document.body.style.overflow = "";
    }

    if (modalOpener && typeof modalOpener.focus === "function") {
      modalOpener.focus();
    }
    modalOpener = null;
  }

  // ==========================================================================
  // Sidebar (mobile drawer)
  // ==========================================================================

  function openSidebarDrawer() {
    sidebar.classList.add("sidebar-open");
    sidebarBackdrop.hidden = false;
    sidebarToggle.setAttribute("aria-expanded", "true");
  }

  function closeSidebarDrawer() {
    sidebar.classList.remove("sidebar-open");
    sidebarBackdrop.hidden = true;
    sidebarToggle.setAttribute("aria-expanded", "false");
  }

  function toggleSidebarDrawer() {
    if (sidebar.classList.contains("sidebar-open")) closeSidebarDrawer();
    else openSidebarDrawer();
  }

  // ==========================================================================
  // Event wiring
  // ==========================================================================

  /**
   * Single delegated listener for everything inside the shortcut grid
   * (open / favorite / edit / delete / the "add shortcut" tile). Cards are
   * rebuilt on every render(), but because there is only ever one listener
   * attached to the stable `grid` container, re-rendering never
   * accumulates duplicate listeners.
   */
  function handleGridClick(e) {
    const target = e.target.closest("[data-action]");
    if (!target || !grid.contains(target)) return;

    const { action, id } = target.dataset;
    if (action === "open") openShortcutNewTab(id);
    else if (action === "toggle-favorite") toggleFavorite(id);
    else if (action === "edit") openEditModal(id, target);
    else if (action === "delete") openDeleteConfirm(id, target);
    else if (action === "open-add-modal") openAddModal(target);
  }

  /**
   * Single delegated listener for the sidebar (system views, categories,
   * and their rename/delete controls).
   */
  function handleSidebarClick(e) {
    const target = e.target.closest("[data-action]");
    if (!target || !sidebar.contains(target)) return;

    const { action, view, categoryId } = target.dataset;
    if (action === "select-view") selectView(view, categoryId);
    else if (action === "rename-category") openCategoryRenameModal(categoryId, target);
    else if (action === "delete-category") openCategoryDeleteConfirm(categoryId, target);
  }

  function init() {
    state = loadState();
    render();

    // V2.2 — Appearance/display/background apply on load, and a listener so
    // "System" theme tracks OS changes live without a page refresh.
    systemThemeQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null;
    if (systemThemeQuery) {
      if (typeof systemThemeQuery.addEventListener === "function") {
        systemThemeQuery.addEventListener("change", handleSystemThemeChange);
      } else if (typeof systemThemeQuery.addListener === "function") {
        systemThemeQuery.addListener(handleSystemThemeChange); // older Safari
      }
    }
    applyAllAppearance();

    // V2.2 — Settings tabs (click + arrow-key navigation).
    settingsTabsEl.addEventListener("click", handleSettingsTabsClick);
    settingsTabsEl.addEventListener("keydown", handleSettingsTabsKeydown);

    // V2.2 — Appearance, Display, and Background controls. Each applies and
    // persists immediately — there's no separate "Save" step.
    themeControl.addEventListener("change", handleThemeChange);
    gridSizeControl.addEventListener("change", handleGridSizeChange);
    showSearchInput.addEventListener("change", handleShowSearchChange);
    showDomainInput.addEventListener("change", handleShowDomainChange);
    showClockInput.addEventListener("change", handleShowClockChange);
    backgroundTypeControl.addEventListener("change", handleBackgroundTypeChange);
    bgColorInput.addEventListener("input", handleBgColorChange);
    bgGradientFromInput.addEventListener("input", handleBgGradientChange);
    bgGradientToInput.addEventListener("input", handleBgGradientChange);
    bgImageUrlInput.addEventListener("change", handleBgImageUrlChange);

    // Search — real-time filter as the user types. Tolerant of whitespace
    // and any characters, since it's a plain substring match (no regex).
    searchInput.addEventListener("input", () => {
      searchTerm = normalizeSearchText(searchInput.value);
      render();
    });

    // Header "Add Shortcut" button.
    addShortcutBtn.addEventListener("click", () => openAddModal(addShortcutBtn));

    // Delegated handling for shortcut cards, the add-tile, and the
    // empty-state "add your first shortcut" button.
    grid.addEventListener("click", handleGridClick);
    emptyState.addEventListener("click", handleGridClick);

    // Drag-and-drop reordering (delegated on the grid; see buildCard() for
    // the handle that's the only draggable element on a card).
    grid.addEventListener("dragstart", handleGridDragStart);
    grid.addEventListener("dragover", handleGridDragOver);
    grid.addEventListener("drop", handleGridDrop);
    grid.addEventListener("dragend", handleGridDragEnd);

    // Keyboard alternative to drag-and-drop: Arrow Up/Down/Home/End while
    // a card's drag handle is focused.
    grid.addEventListener("keydown", handleGridHandleKeydown);

    // Right-click context menu.
    grid.addEventListener("contextmenu", handleGridContextMenu);

    // Add/edit modal controls.
    shortcutForm.addEventListener("submit", handleFormSubmit);
    cancelBtn.addEventListener("click", closeAddEditModal);
    modalClose.addEventListener("click", closeAddEditModal);
    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) closeAddEditModal();
    });
    iconTypeRow.addEventListener("change", updateIconValueVisibility);

    // Delete shortcut modal controls.
    deleteCancelBtn.addEventListener("click", closeDeleteConfirm);
    deleteConfirmBtn.addEventListener("click", confirmDelete);
    deleteOverlay.addEventListener("click", (e) => {
      if (e.target === deleteOverlay) closeDeleteConfirm();
    });

    // Sidebar: views + category rename/delete (delegated).
    sidebar.addEventListener("click", handleSidebarClick);
    newCategoryBtn.addEventListener("click", () => openCategoryAddModal(newCategoryBtn));

    // Category add/rename modal controls.
    categoryForm.addEventListener("submit", handleCategoryFormSubmit);
    categoryCancelBtn.addEventListener("click", closeCategoryModal);
    categoryModalClose.addEventListener("click", closeCategoryModal);
    categoryModalOverlay.addEventListener("click", (e) => {
      if (e.target === categoryModalOverlay) closeCategoryModal();
    });

    // Category delete modal controls.
    categoryDeleteCancelBtn.addEventListener("click", closeCategoryDeleteConfirm);
    categoryDeleteConfirmBtn.addEventListener("click", confirmCategoryDelete);
    categoryDeleteOverlay.addEventListener("click", (e) => {
      if (e.target === categoryDeleteOverlay) closeCategoryDeleteConfirm();
    });

    // Settings modal (Export / Import / keyboard shortcuts reference).
    settingsBtn.addEventListener("click", () => openSettings(settingsBtn));
    settingsClose.addEventListener("click", closeSettings);
    settingsOverlay.addEventListener("click", (e) => {
      if (e.target === settingsOverlay) closeSettings();
    });
    exportBtn.addEventListener("click", exportState);
    importBtn.addEventListener("click", () => importFileInput.click());
    importFileInput.addEventListener("change", handleImportFileChange);

    // Import Replace/Merge/Cancel confirmation.
    importCancelBtn.addEventListener("click", closeImportConfirm);
    importMergeBtn.addEventListener("click", confirmImportMerge);
    importReplaceBtn.addEventListener("click", confirmImportReplace);
    importConfirmOverlay.addEventListener("click", (e) => {
      if (e.target === importConfirmOverlay) closeImportConfirm();
    });

    // Register Escape-close handlers now that every close fn exists.
    MODAL_CLOSE_FNS.set(modalOverlay, closeAddEditModal);
    MODAL_CLOSE_FNS.set(deleteOverlay, closeDeleteConfirm);
    MODAL_CLOSE_FNS.set(categoryModalOverlay, closeCategoryModal);
    MODAL_CLOSE_FNS.set(categoryDeleteOverlay, closeCategoryDeleteConfirm);
    MODAL_CLOSE_FNS.set(settingsOverlay, closeSettings);
    MODAL_CLOSE_FNS.set(importConfirmOverlay, closeImportConfirm);

    // Mobile sidebar drawer.
    sidebarToggle.addEventListener("click", toggleSidebarDrawer);
    sidebarBackdrop.addEventListener("click", closeSidebarDrawer);

    // Advanced keyboard shortcuts. All of them (other than Escape) are
    // suppressed while the user is typing in a field or a modal/menu is
    // open, so they never interfere with normal text entry.
    document.addEventListener("keydown", (e) => {
      const isTypingElsewhere = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName);

      if (e.key === "Escape") {
        // Context menu and modal Escape-handling are already registered
        // as their own listeners (see openContextMenu / showModal); this
        // only needs to cover the mobile sidebar drawer.
        if (!activeModal && !isContextMenuOpen() && !isTypingElsewhere && sidebar.classList.contains("sidebar-open")) {
          closeSidebarDrawer();
        }
        return;
      }

      if (activeModal || isContextMenuOpen()) return;

      if (e.key === "/" && !isTypingElsewhere) {
        if (searchWrap.hidden) return; // search is turned off in Settings > Display
        e.preventDefault();
        searchInput.focus();
        return;
      }

      const mod = e.ctrlKey || e.metaKey;
      if (!mod || isTypingElsewhere) return;
      const key = e.key.toLowerCase();

      if (!e.shiftKey && !e.altKey && key === "k") {
        if (searchWrap.hidden) return;
        e.preventDefault();
        searchInput.focus();
      } else if (!e.shiftKey && !e.altKey && key === "n") {
        e.preventDefault();
        openAddModal(addShortcutBtn);
      } else if (e.shiftKey && !e.altKey && key === "f") {
        e.preventDefault();
        selectView("favorites", null);
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
