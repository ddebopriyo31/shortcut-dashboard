// Applies the saved theme (or resolves "system") as early as possible, so
// there's as little flash of the wrong theme as the platform allows. Reads
// the same storage key and settings shape app.js uses; never writes
// anything.
//
// Extracted from an inline <script> in index.html during the V3.0 Task 1
// Chrome Extension conversion, since Manifest V3's CSP doesn't allow
// inline scripts on extension pages.
//
// Updated in V3.0 Task 2 (storage migration) to read from
// chrome.storage.local instead of localStorage, since that's where theme
// data now actually lives once the app has migrated. This does trade away
// a guarantee V2.2 had: localStorage is synchronous, so V2.2 could resolve
// and apply the theme before the browser painted anything, with zero
// flash. chrome.storage.local has no synchronous equivalent — this script
// still runs first in <head>, but the theme can only be applied once its
// callback fires, which is very fast (same-process, no network) but not
// guaranteed to land before first paint. In practice this means an
// occasional brief flash of the default (dark) styling for users on a
// light or system-light theme, rather than the flash-free swap V2.2 had.
// That's an inherent trade-off of moving off localStorage, not a bug.
(function () {
  try {
    if (!(window.chrome && chrome.storage && chrome.storage.local)) return;
    chrome.storage.local.get("shortcutDashboardState", function (result) {
      try {
        if (chrome.runtime && chrome.runtime.lastError) return;
        var stored = result && result.shortcutDashboardState;
        var theme = "dark";
        var t = stored && stored.settings && stored.settings.theme;
        if (t === "light" || t === "dark" || t === "system") theme = t;
        var effective =
          theme === "system"
            ? window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches
              ? "light"
              : "dark"
            : theme;
        document.documentElement.setAttribute("data-theme", effective);
      } catch (err) {
        /* Malformed stored data — leave the default dark styling in place. */
      }
    });
  } catch (err) {
    /* chrome.storage unavailable — fall back to default dark styling. */
  }
})();
