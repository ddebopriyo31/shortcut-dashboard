// Applies the saved theme (or resolves "system") as early as possible, so
// the popup doesn't flash the wrong theme when it opens. Same logic and
// same storage key as ../js/theme-init.js — duplicated here (rather than
// shared via a <script> include) because the popup is loaded as its own
// top-level document/context, separate from newtab.html.
//
// Reads chrome.storage.local only; never writes anything. See
// ../js/theme-init.js for the note on why this can occasionally show a
// brief flash of the default (dark) styling — chrome.storage.local has no
// synchronous read API, unlike the localStorage V2.2 used.
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
