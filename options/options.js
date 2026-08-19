/* ==========================================================================
   Shortcut Dashboard — options.js

   Wires this page's own controls to the exact same shared logic the
   dashboard uses (js/shared/store.js for state/persistence,
   js/shared/appearance.js for theme/background rendering) — see those
   files for the actual settings implementation. Nothing here duplicates
   validation, sanitization, persistence, or appearance logic; this file
   only owns what's specific to the Options page: its DOM, its modals, and
   its own small live preview.
   ========================================================================== */

import {
  defaultSettings,
  defaultLayoutSettings,
  loadState,
  persistState,
  mergeStates,
  parseImportedBackup,
  getExtensionVersion,
  sanitizeState,
} from "../js/shared/store.js";
import { resolveEffectiveTheme, createBackgroundApplier } from "../js/shared/appearance.js";

(function () {
  "use strict";

  // ------------------------------------------------------------------------
  // DOM references
  // ------------------------------------------------------------------------
  const themeControl = document.getElementById("themeControl");
  const cardSizeControl = document.getElementById("cardSizeControl");
  const iconSizeControl = document.getElementById("iconSizeControl");
  const gridDensityControl = document.getElementById("gridDensityControl");
  const gridColumnsControl = document.getElementById("gridColumnsControl");
  const resetAppearanceBtn = document.getElementById("resetAppearanceBtn");
  const showSearchInput = document.getElementById("showSearchInput");
  const showDomainInput = document.getElementById("showDomainInput");
  const showClockInput = document.getElementById("showClockInput");

  const backgroundTypeControl = document.getElementById("backgroundTypeControl");
  const bgColorFields = document.getElementById("bgColorFields");
  const bgGradientFields = document.getElementById("bgGradientFields");
  const bgImageFields = document.getElementById("bgImageFields");
  const bgColorInput = document.getElementById("bgColorInput");
  const bgGradientFromInput = document.getElementById("bgGradientFromInput");
  const bgGradientToInput = document.getElementById("bgGradientToInput");
  const bgImageUrlInput = document.getElementById("bgImageUrlInput");
  const bgImageError = document.getElementById("bgImageError");

  const exportBtn = document.getElementById("exportBtn");
  const importBtn = document.getElementById("importBtn");
  const importFileInput = document.getElementById("importFileInput");

  const importConfirmOverlay = document.getElementById("importConfirmOverlay");
  const importConfirmSummary = document.getElementById("importConfirmSummary");
  const importCancelBtn = document.getElementById("importCancelBtn");
  const importMergeBtn = document.getElementById("importMergeBtn");
  const importReplaceBtn = document.getElementById("importReplaceBtn");

  const resetBtn = document.getElementById("resetBtn");
  const resetConfirmOverlay = document.getElementById("resetConfirmOverlay");
  const resetCancelBtn = document.getElementById("resetCancelBtn");
  const resetConfirmBtn = document.getElementById("resetConfirmBtn");

  const shortcutStatus = document.getElementById("shortcutStatus");
  const openShortcutSettingsBtn = document.getElementById("openShortcutSettingsBtn");
  const refreshShortcutBtn = document.getElementById("refreshShortcutBtn");

  const versionText = document.getElementById("versionText");
  const toast = document.getElementById("toast");

  // ------------------------------------------------------------------------
  // State
  // ------------------------------------------------------------------------
  let state = { version: 2, settings: defaultSettings(), categories: [], shortcuts: [] };
  let pendingImport = null;
  let toastTimer = null;
  let systemThemeQuery = null;
  let activeModal = null;
  let modalOpener = null;
  let backgroundImageLoadFailed = false;

  // ==========================================================================
  // Toast (same small pattern as the dashboard's own — see js/app.js)
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
  // Minimal modal open/close + focus handling — this page only ever has one
  // of two small confirmation modals open at a time, so this is
  // intentionally simpler than the dashboard's own (which manages many
  // more overlays). Not shared with app.js: this is generic modal
  // plumbing, not settings logic.
  // ==========================================================================
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
    document.body.style.overflow = "";
    document.removeEventListener("keydown", handleModalKeydown, true);
    if (modalOpener && typeof modalOpener.focus === "function") modalOpener.focus();
    modalOpener = null;
  }

  function handleModalKeydown(e) {
    if (!activeModal) return;
    if (e.key === "Escape") {
      e.preventDefault();
      if (activeModal === importConfirmOverlay) closeImportConfirm();
      else if (activeModal === resetConfirmOverlay) closeResetConfirm();
      return;
    }
    if (e.key !== "Tab") return;
    const focusable = Array.from(
      activeModal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    ).filter((el) => !el.disabled && el.offsetParent !== null);
    if (!focusable.length) return;
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

  // ==========================================================================
  // Appearance — theme resolution and background rendering both delegate to
  // js/shared/appearance.js, the exact same logic the dashboard uses.
  // ==========================================================================
  function applyTheme() {
    const effective = resolveEffectiveTheme(state.settings.theme, Boolean(systemThemeQuery && systemThemeQuery.matches));
    document.documentElement.setAttribute("data-theme", effective);
  }

  function handleSystemThemeChange() {
    if (state.settings.theme === "system") applyTheme();
  }

  function updateBackgroundImageErrorUI() {
    if (backgroundImageLoadFailed) {
      bgImageError.textContent = "Couldn't load that image. Showing the default background instead.";
      bgImageError.hidden = false;
    } else {
      bgImageError.hidden = true;
    }
  }

  const backgroundApplier = createBackgroundApplier({
    docEl: document.documentElement,
    bodyEl: document.body,
    onImageSettled: () => {
      backgroundImageLoadFailed = false;
      updateBackgroundImageErrorUI();
    },
    onImageError: () => {
      backgroundImageLoadFailed = true;
      updateBackgroundImageErrorUI();
      showToast("Background image couldn't be loaded — using the default background.", "error");
    },
  });

  function applyBackground() {
    backgroundApplier.apply(state.settings.background);
  }

  function applyAllAppearance() {
    applyTheme();
    applyBackground();
  }

  // ==========================================================================
  // Populate controls from state
  // ==========================================================================
  function updateBackgroundFieldsVisibility(type) {
    bgColorFields.hidden = type !== "color";
    bgGradientFields.hidden = type !== "gradient";
    bgImageFields.hidden = type !== "image";
  }

  function populateControls() {
    themeControl.querySelectorAll('input[name="theme"]').forEach((r) => {
      r.checked = r.value === state.settings.theme;
    });
    cardSizeControl.querySelectorAll('input[name="cardSize"]').forEach((r) => {
      r.checked = r.value === state.settings.cardSize;
    });
    iconSizeControl.querySelectorAll('input[name="iconSize"]').forEach((r) => {
      r.checked = r.value === state.settings.iconSize;
    });
    gridDensityControl.querySelectorAll('input[name="gridDensity"]').forEach((r) => {
      r.checked = r.value === state.settings.gridDensity;
    });
    gridColumnsControl.querySelectorAll('input[name="gridColumns"]').forEach((r) => {
      r.checked = r.value === state.settings.gridColumns;
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
    updateBackgroundImageErrorUI();
    updateBackgroundFieldsVisibility(bg.type);
  }

  // ==========================================================================
  // Save — every control here saves immediately (per the task's own
  // guidance: "For settings that can safely save immediately, save".
  // persistState() (js/shared/store.js) already serializes/queues writes
  // and snapshots synchronously, so rapid changes (e.g. dragging a color
  // picker) can't race or corrupt what's saved — see that file for why.
  // ==========================================================================
  function commitSettingsChange(applyFn) {
    if (applyFn) applyFn();
    persistState(state).then((savedOk) => {
      if (!savedOk) {
        showToast("Setting changed for this session, but could not be saved permanently.", "error");
      }
    });
  }

  function handleThemeChange(e) {
    if (e.target.name !== "theme") return;
    state.settings.theme = e.target.value;
    commitSettingsChange(applyTheme);
  }

  function handleCardSizeChange(e) {
    if (e.target.name !== "cardSize") return;
    state.settings.cardSize = e.target.value;
    commitSettingsChange();
  }

  function handleIconSizeChange(e) {
    if (e.target.name !== "iconSize") return;
    state.settings.iconSize = e.target.value;
    commitSettingsChange();
  }

  function handleGridDensityChange(e) {
    if (e.target.name !== "gridDensity") return;
    state.settings.gridDensity = e.target.value;
    commitSettingsChange();
  }

  function handleGridColumnsChange(e) {
    if (e.target.name !== "gridColumns") return;
    state.settings.gridColumns = e.target.value;
    commitSettingsChange();
  }

  /**
   * Restores card size, icon size, grid density, and grid columns to
   * their V3 defaults. Does not touch theme, background, display
   * toggles, or any shortcut/category/favorite data — see
   * defaultLayoutSettings() (js/shared/store.js), which returns only
   * these four fields for exactly this reason.
   */
  function handleResetAppearance() {
    Object.assign(state.settings, defaultLayoutSettings());
    populateControls();
    persistState(state).then((savedOk) => {
      showToast(
        savedOk ? "Appearance settings reset to defaults." : "Appearance reset for this session, but could not be saved permanently.",
        savedOk ? "success" : "error"
      );
    });
  }

  function handleShowSearchChange() {
    state.settings.showSearch = showSearchInput.checked;
    commitSettingsChange();
  }

  function handleShowDomainChange() {
    state.settings.showDomain = showDomainInput.checked;
    commitSettingsChange();
  }

  function handleShowClockChange() {
    state.settings.showClock = showClockInput.checked;
    commitSettingsChange();
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
      commitSettingsChange(applyBackground);
      return;
    }
    // normalizeAndValidateUrl isn't imported here directly — the shared
    // background applier already validates by attempting to load the
    // image, and reports success/failure via onImageSettled/onImageError
    // above, which is the same source of truth the dashboard uses for
    // this exact field. A clearly-malformed (non-URL) string will simply
    // fail to load and surface the same "couldn't load" message.
    state.settings.background.imageUrl = raw;
    bgImageUrlInput.value = raw;
    commitSettingsChange(applyBackground);
  }

  // ==========================================================================
  // Export / Import — parseImportedBackup() and mergeStates() are the exact
  // functions the dashboard uses (js/shared/store.js); Replace/Merge/
  // duplicate-handling/category-handling behavior is identical.
  // ==========================================================================
  async function exportState() {
    let dataToExport = state;
    try {
      dataToExport = await loadState();
    } catch (err) {
      console.error("Could not read chrome.storage.local for export; exporting the in-memory state instead.", err);
    }

    const json = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const now = new Date();
    const pad2 = (n) => String(n).padStart(2, "0");
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

  function handleImportFileChange(e) {
    const file = e.target.files && e.target.files[0];
    importFileInput.value = "";
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => processImportedText(String(reader.result || ""));
    reader.onerror = () => showToast("That file could not be read.", "error");
    reader.readAsText(file);
  }

  function processImportedText(text) {
    const result = parseImportedBackup(text);
    if (!result.ok) {
      showToast(result.message, "error");
      return;
    }
    pendingImport = result.state;
    openImportConfirm(result.state);
  }

  function openImportConfirm(clean) {
    const shortcutWord = clean.shortcuts.length === 1 ? "shortcut" : "shortcuts";
    const categoryWord = clean.categories.length === 1 ? "category" : "categories";
    importConfirmSummary.textContent =
      `This backup has ${clean.shortcuts.length} ${shortcutWord} and ${clean.categories.length} ${categoryWord}. ` +
      "Choose how to bring it in:";
    showModal(importConfirmOverlay, importMergeBtn, importBtn);
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
    state = next;
    populateControls();
    applyAllAppearance();
    closeImportConfirm();

    persistState(next).then((savedOk) => {
      showToast(
        savedOk
          ? `Import complete. Replaced with ${next.shortcuts.length} shortcuts.`
          : "Import applied for this session, but could not be saved permanently.",
        savedOk ? "success" : "error"
      );
    });
  }

  function confirmImportMerge() {
    if (!pendingImport) {
      closeImportConfirm();
      return;
    }
    const result = mergeStates(state, pendingImport);
    state = result.state;
    closeImportConfirm();

    const skippedNote = result.skippedShortcuts
      ? ` ${result.skippedShortcuts} duplicate shortcut${result.skippedShortcuts === 1 ? "" : "s"} skipped.`
      : "";
    persistState(result.state).then((savedOk) => {
      showToast(
        savedOk
          ? `Merged: added ${result.addedShortcuts} shortcuts, ${result.addedCategories} categories.${skippedNote}`
          : "Merge applied for this session, but could not be saved permanently.",
        savedOk ? "success" : "error"
      );
    });
  }

  // ==========================================================================
  // Reset — uses the exact same persistState() as every other save on this
  // page; "resetting" is simply persisting a fresh empty-but-valid V2
  // state, the same shape a brand-new install starts with. No second
  // storage system, no direct localStorage/chrome.storage access here.
  // ==========================================================================
  function openResetConfirm() {
    showModal(resetConfirmOverlay, resetCancelBtn, resetBtn);
  }

  function closeResetConfirm() {
    hideModal(resetConfirmOverlay);
  }

  // ==========================================================================
  // Dashboard Shortcut (v3.0.9)
  //
  // Chrome — not this extension — owns registering and validating keyboard
  // shortcuts for extension commands. There is no extension API to set or
  // change one programmatically; the only real control surface is Chrome's
  // own chrome://extensions/shortcuts page. This section is deliberately a
  // read-only status display (chrome.commands.getAll(), which reports the
  // shortcut Chrome actually has registered right now) plus a link to that
  // page — never a fake picker that would have to guess whether Chrome
  // would accept a combination.
  // ==========================================================================
  async function refreshShortcutStatus() {
    if (!(window.chrome && chrome.commands && chrome.commands.getAll)) {
      shortcutStatus.textContent = "Couldn't check your current shortcut.";
      return;
    }
    try {
      const commands = await chrome.commands.getAll();
      const command = commands.find((c) => c.name === "open-dashboard");
      const shortcut = command && command.shortcut;
      shortcutStatus.textContent = shortcut
        ? `Enabled — ${shortcut}`
        : "Not set — choose one on Chrome's Shortcuts page.";
    } catch (err) {
      console.error("Could not read the current keyboard shortcut:", err);
      shortcutStatus.textContent = "Couldn't check your current shortcut.";
    }
  }

  function openChromeShortcutSettings() {
    if (window.chrome && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
    }
  }

  function confirmReset() {
    const fresh = { version: 2, settings: defaultSettings(), categories: [], shortcuts: [] };
    state = fresh;
    populateControls();
    applyAllAppearance();
    closeResetConfirm();

    persistState(fresh).then((savedOk) => {
      showToast(
        savedOk ? "All data has been reset." : "Reset for this session, but could not be saved permanently.",
        savedOk ? "success" : "error"
      );
    });
  }

  // ==========================================================================
  // Init
  // ==========================================================================
  async function init() {
    versionText.textContent = `Version ${getExtensionVersion() || "3.0.9"}`;

    state = await loadState();
    populateControls();

    systemThemeQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null;
    if (systemThemeQuery) {
      if (typeof systemThemeQuery.addEventListener === "function") {
        systemThemeQuery.addEventListener("change", handleSystemThemeChange);
      } else if (typeof systemThemeQuery.addListener === "function") {
        systemThemeQuery.addListener(handleSystemThemeChange);
      }
    }
    applyAllAppearance();

    themeControl.addEventListener("change", handleThemeChange);
    cardSizeControl.addEventListener("change", handleCardSizeChange);
    iconSizeControl.addEventListener("change", handleIconSizeChange);
    gridDensityControl.addEventListener("change", handleGridDensityChange);
    gridColumnsControl.addEventListener("change", handleGridColumnsChange);
    resetAppearanceBtn.addEventListener("click", handleResetAppearance);
    showSearchInput.addEventListener("change", handleShowSearchChange);
    showDomainInput.addEventListener("change", handleShowDomainChange);
    showClockInput.addEventListener("change", handleShowClockChange);

    backgroundTypeControl.addEventListener("change", handleBackgroundTypeChange);
    bgColorInput.addEventListener("input", handleBgColorChange);
    bgGradientFromInput.addEventListener("input", handleBgGradientChange);
    bgGradientToInput.addEventListener("input", handleBgGradientChange);
    bgImageUrlInput.addEventListener("change", handleBgImageUrlChange);

    exportBtn.addEventListener("click", exportState);
    importBtn.addEventListener("click", () => importFileInput.click());
    importFileInput.addEventListener("change", handleImportFileChange);
    importCancelBtn.addEventListener("click", closeImportConfirm);
    importMergeBtn.addEventListener("click", confirmImportMerge);
    importReplaceBtn.addEventListener("click", confirmImportReplace);

    resetBtn.addEventListener("click", openResetConfirm);
    resetCancelBtn.addEventListener("click", closeResetConfirm);
    resetConfirmBtn.addEventListener("click", confirmReset);

    refreshShortcutStatus();
    openShortcutSettingsBtn.addEventListener("click", openChromeShortcutSettings);
    refreshShortcutBtn.addEventListener("click", refreshShortcutStatus);
    // Chrome's Shortcuts page opens in a separate tab — re-check when the
    // user comes back here, so a change they just made shows up without
    // needing to remember to click Refresh.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") refreshShortcutStatus();
    });

    // Live sync: if the dashboard (or another Options tab) changes
    // something while this page is open, reflect it here — mirrors the
    // dashboard's own chrome.storage.onChanged listener (js/app.js).
    if (window.chrome && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "local" || !changes.shortcutDashboardState) return;
        const incoming = changes.shortcutDashboardState.newValue;
        if (incoming === undefined) return;
        if (JSON.stringify(incoming) === JSON.stringify(state)) return; // our own write echoing back
        if (activeModal) return; // don't yank controls out from under an open confirmation
        state = sanitizeState(incoming); // defensive — mirrors app.js's own listener; no extra storage read needed
        populateControls();
        applyAllAppearance();
      });
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
