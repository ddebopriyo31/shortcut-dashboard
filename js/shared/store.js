/* ==========================================================================
   Shortcut Dashboard — shared/store.js

   The single source of truth for state shape, validation/sanitization,
   and chrome.storage.local persistence (including the one-time V2.2/V1.1
   -> V3 migration). This is a plain ES module with no DOM dependencies at
   all, so it can be imported unchanged by both the dashboard
   (../app.js, loaded by dashboard.html) and the Options page
   (../../options/options.js) — neither one duplicates this logic, and
   both always read/write the exact same chrome.storage.local key.

   Nothing in this file touches the DOM. Nothing in this file is
   dashboard- or options-page-specific.
   ========================================================================== */

export const STORAGE_KEY_V1 = "shortcutDashboard.shortcuts.v1"; // legacy V1.1 key (read-only, never written)
export const STORAGE_KEY_V2 = "shortcutDashboardState"; // chrome.storage.local key holding the V2-shaped app state
export const MIGRATION_MARKER_KEY = "shortcutDashboardMigration"; // chrome.storage.local key: one-time V2.2 localStorage -> V3 migration record

export const MAX_NAME_LENGTH = 60;
export const MAX_CATEGORY_NAME_LENGTH = 40;
export const MAX_EMOJI_LENGTH = 16;
export const ALLOWED_PROTOCOLS = ["http:", "https:"];
export const ICON_TYPES = ["favicon", "image", "emoji", "letter"];
export const THEME_MODES = ["dark", "light", "system"];
export const CARD_SIZES = ["small", "medium", "large"];
export const ICON_SIZES = ["small", "medium", "large"];
export const GRID_DENSITIES = ["compact", "comfortable", "spacious"];
export const GRID_COLUMN_PREFS = ["more", "standard", "fewer"]; // column-width preference, not a fixed count — see js/app.js applyGridLayout()
export const BACKGROUND_TYPES = ["default", "color", "gradient", "image"];
const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

export function defaultSettings() {
  return {
    theme: "dark",
    cardSize: "medium",
    iconSize: "medium",
    gridDensity: "comfortable",
    gridColumns: "standard",
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

/**
 * Just the four Task 7 layout preferences (card size, icon size, grid
 * density, grid columns) at their defaults — used by the "Reset
 * Appearance" action so it can restore only these fields without
 * touching theme, background, display toggles, or (obviously) any
 * shortcut/category data.
 */
export function defaultLayoutSettings() {
  const { cardSize, iconSize, gridDensity, gridColumns } = defaultSettings();
  return { cardSize, iconSize, gridDensity, gridColumns };
}

export function generateId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  // Fallback for older browsers: timestamp + random suffix.
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
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
 * - Hostname must simply be present (intentionally allows single-label
 *   LAN/intranet hosts like "router" or "nas").
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
export function normalizeAndValidateUrl(input) {
  const parsed = parseUserUrl(input);
  if (!isAllowedUrl(parsed)) return null;
  return parsed.href;
}

/**
 * Key used to compare two already-normalized URLs for "is this the same
 * shortcut" purposes. Only protocol and host are lowercased (scheme names
 * and hostnames aren't case-sensitive); pathname/query/fragment are left
 * exactly as-is, since servers may treat those as case-sensitive.
 */
export function comparableUrlKey(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol.toLowerCase()}//${parsed.host.toLowerCase()}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch (err) {
    return url;
  }
}

export function getDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch (err) {
    return url;
  }
}

export function getFaviconUrl(url) {
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
 * itself disqualify the record — sanitizeState() assigns a fresh id.
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
    categoryId: isNonEmptyString(raw.categoryId) && validCategoryIds.has(raw.categoryId) ? raw.categoryId : null,
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
    imageUrl: isNonEmptyString(raw.imageUrl) ? normalizeAndValidateUrl(raw.imageUrl) || "" : "",
  };
}

function sanitizeSettings(raw) {
  const defaults = defaultSettings();
  if (!raw || typeof raw !== "object") return defaults;

  // One-time soft migration: Tasks 1-6 had a single combined "gridSize"
  // (small/medium/large) controlling card size, icon size, spacing, and
  // column width all together. Task 7 splits that into four independent
  // settings. A legacy gridSize value (if present, and only if the new
  // fields aren't already set) becomes the starting point for the two
  // fields it most directly corresponded to — card size and icon size —
  // so an upgrading user's dashboard doesn't visually jump on next load.
  // Density/columns have no old equivalent to inherit, so they just take
  // the new defaults. This never writes anything itself — sanitizeState()
  // already writes back a self-healing save when needed.
  const legacyGridSize = CARD_SIZES.includes(raw.gridSize) ? raw.gridSize : null;

  return {
    theme: THEME_MODES.includes(raw.theme) ? raw.theme : defaults.theme,
    cardSize: CARD_SIZES.includes(raw.cardSize) ? raw.cardSize : legacyGridSize || defaults.cardSize,
    iconSize: ICON_SIZES.includes(raw.iconSize) ? raw.iconSize : legacyGridSize || defaults.iconSize,
    gridDensity: GRID_DENSITIES.includes(raw.gridDensity) ? raw.gridDensity : defaults.gridDensity,
    gridColumns: GRID_COLUMN_PREFS.includes(raw.gridColumns) ? raw.gridColumns : defaults.gridColumns,
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
export function sanitizeState(parsed) {
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
    if (seenUrls.has(urlKey)) continue; // duplicate URL within the same file/state — first one wins
    seenShortcutIds.add(sc.id);
    seenUrls.add(urlKey);
    shortcuts.push(sc);
  }

  return { version: 2, settings, categories, shortcuts };
}

/**
 * Deep-clones a state object synchronously, so a snapshot taken "right
 * now" can never be mutated by later code that goes on to change a
 * shared, in-place-mutated state object. Used by persistState() to freeze
 * exactly what should be written before that write is queued.
 */
function cloneState(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)); // fallback for older engines
}

/**
 * Thin promise-based wrapper around chrome.storage.local. This is the
 * only code in the module that talks to chrome.storage.local directly.
 *
 * Writes are serialized through a single chained queue (`writeQueue`).
 * chrome.storage.local.set() callbacks are not guaranteed to fire in the
 * order the calls were made — without serializing, a slow early write
 * could finish *after* a fast later one and clobber newer data with
 * older data. Chaining every set() onto the previous one guarantees they
 * land in call order, so the last write requested is always the last
 * write applied.
 *
 * Each page (dashboard, popup, Options) that imports this module gets its
 * own StorageLayer instance (and its own writeQueue) — ES modules are
 * re-instantiated per document/execution context. That's fine: the queue
 * only needs to serialize writes made from within the same page: two
 * writes from two different open pages can't be interleaved into a
 * corrupt single write either way, since each individual
 * chrome.storage.local.set() call is atomic.
 */
const StorageLayer = (function () {
  let writeQueue = Promise.resolve();

  function get(key) {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.get(key, (result) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(result ? result[key] : undefined);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  function set(key, value) {
    const write = writeQueue.then(
      () =>
        new Promise((resolve) => {
          try {
            chrome.storage.local.set({ [key]: value }, () => {
              if (chrome.runtime.lastError) {
                console.error("chrome.storage.local.set failed:", chrome.runtime.lastError.message);
                resolve(false);
                return;
              }
              resolve(true);
            });
          } catch (err) {
            console.error("chrome.storage.local.set threw:", err);
            resolve(false);
          }
        })
    );
    // Swallow rejections in the queue chain itself so one failed write
    // can never break the chain for writes queued after it — each
    // write's own caller still gets its own true/false via `write`.
    writeQueue = write.catch(() => false);
    return write;
  }

  return { get, set };
})();

// ==========================================================================
// Migration: V2.2 localStorage -> V3 chrome.storage.local
// ==========================================================================

/**
 * Reads whatever legacy data is sitting in localStorage — V2.2's state
 * key first, falling back to the older V1.1 key — and returns a clean V2
 * state object to seed chrome.storage.local with. Never writes to or
 * clears anything in localStorage; the old data is left in place
 * untouched so a failed or partial migration can never destroy it.
 *
 * Returns { state, source } where `source` records which legacy key (if
 * any) the data came from, for the migration marker.
 */
function migrateFromLocalStorage() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY_V2);
  } catch (err) {
    console.error("localStorage is unavailable during V2.2 -> V3 migration check:", err);
    raw = null;
  }

  if (raw) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      console.error("V2.2 localStorage data was corrupted JSON; skipping migration for it.", err);
      parsed = null;
    }
    if (parsed) {
      return { state: sanitizeState(parsed), source: "v2.2-localStorage" };
    }
  }

  // No valid V2.2 data. Fall back one level further: a V1.1 (pre-category)
  // install that never got upgraded to V2.2.
  const v1Shortcuts = migrateV1Shortcuts();
  return {
    state: { version: 2, settings: defaultSettings(), categories: [], shortcuts: v1Shortcuts },
    source: v1Shortcuts.length ? "v1.1-localStorage" : "fresh-install",
  };
}

/**
 * Loads the V3 state from chrome.storage.local.
 *
 *  - If chrome.storage.local already holds V2-shaped state, that's
 *    authoritative — an already-migrated (or already-native-V3) install
 *    is never migrated again, even if old localStorage data is still
 *    sitting around. Malformed stored data is self-healing: whenever the
 *    cleaned state differs from what was on disk, the cleaned version is
 *    written back so the same corruption doesn't resurface next time.
 *  - If chrome.storage.local is empty, this is either a brand-new
 *    install or an existing V2.2 user's first run of V3: migrate
 *    whatever legacy localStorage data exists (if any), persist it as
 *    the new V3 state, and record a migration marker.
 *  - If chrome.storage.local is unavailable entirely, fall back to a
 *    safe empty in-memory state rather than crashing.
 */
export async function loadState() {
  let stored;
  try {
    stored = await StorageLayer.get(STORAGE_KEY_V2);
  } catch (err) {
    console.error("chrome.storage.local is unavailable:", err);
    return { version: 2, settings: defaultSettings(), categories: [], shortcuts: [] };
  }

  if (stored !== undefined) {
    const clean = sanitizeState(stored);
    if (JSON.stringify(clean) !== JSON.stringify(stored)) {
      persistState(clean);
    }
    return clean;
  }

  const { state: migrated, source } = migrateFromLocalStorage();
  await persistState(migrated);
  StorageLayer.set(MIGRATION_MARKER_KEY, { migrated: true, migratedAt: Date.now(), source });
  return migrated;
}

/**
 * Persists the given state to chrome.storage.local. Never throws —
 * storage failures (quota exceeded, disabled storage, the extension
 * context going away mid-write, etc.) are caught and logged, and the
 * returned promise resolves to false instead, so callers can show an
 * accurate message rather than falsely claiming the change was saved.
 *
 * A synchronous deep-cloned snapshot of nextState is taken immediately —
 * before this write is queued — so a later synchronous mutation to a
 * shared, in-place-mutated state object can never retroactively change
 * what *this* write persists. The actual chrome.storage.local.set() call
 * is then serialized through StorageLayer's write queue, so concurrent
 * saves always land in the order they were requested.
 */
export function persistState(nextState) {
  const snapshot = cloneState(nextState);
  return StorageLayer.set(STORAGE_KEY_V2, snapshot);
}

/**
 * Merges an imported (already-sanitized) state into the current one.
 * Existing data always wins on conflict and is never modified or
 * removed — merge only ever adds:
 *  - Categories are matched by case-insensitive name; a match reuses the
 *    existing category instead of creating a duplicate. New categories
 *    whose id collides with an existing one are assigned a fresh id.
 *  - Shortcuts whose normalized URL already exists are skipped (the
 *    existing shortcut is kept as-is). Surviving shortcuts whose id
 *    collides with an existing one are assigned a fresh id.
 */
export function mergeStates(current, imported) {
  const nextCategories = current.categories.map((c) => ({ ...c }));
  const nameToId = new Map(nextCategories.map((c) => [c.name.toLowerCase(), c.id]));
  const categoryIdMap = new Map(); // imported category id -> resolved id in nextCategories
  let nextCategoryPosition = nextCategories.length ? Math.max(...nextCategories.map((c) => c.position)) + 1 : 0;
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
      skippedShortcuts++;
      return;
    }
    const newId = existingIds.has(sc.id) ? generateId() : sc.id;
    const mappedCategoryId = sc.categoryId && categoryIdMap.has(sc.categoryId) ? categoryIdMap.get(sc.categoryId) : null;

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

/**
 * Parses and validates an imported backup's raw JSON text into a clean V2
 * state object. Returns { ok: true, state } on success, or
 * { ok: false, message } with a user-facing reason on failure. Never
 * writes to storage — purely validation, same as app.js's V2.2 behavior.
 */
export function parseImportedBackup(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return { ok: false, message: "That file is not valid JSON." };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, message: "That file isn't a recognized backup format." };
  }

  if (parsed.version !== 2) {
    return { ok: false, message: "That backup's version isn't supported by this version of the app." };
  }

  const clean = sanitizeState(parsed);
  if (clean.categories.length === 0 && clean.shortcuts.length === 0) {
    return { ok: false, message: "That backup didn't contain any usable shortcuts or categories." };
  }

  return { ok: true, state: clean };
}

/** The extension's version, straight from manifest.json (single source of truth — never hardcoded elsewhere). */
export function getExtensionVersion() {
  try {
    return chrome.runtime.getManifest().version;
  } catch (err) {
    return null;
  }
}
