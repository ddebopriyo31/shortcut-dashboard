/* ==========================================================================
   Shortcut Dashboard — shared/appearance.js

   The "what does this theme/background setting actually render as" logic,
   shared between the dashboard (../app.js) and the Options page
   (../../options/options.js) so neither one reimplements it. Each caller
   still owns *when* to apply it and *which elements* to apply it to —
   this module only owns the shared behavior itself.
   ========================================================================== */

/** Resolves "system" against the browser's current color-scheme preference. "dark"/"light" pass through unchanged. */
export function resolveEffectiveTheme(theme, systemPrefersLight) {
  if (theme !== "system") return theme;
  return systemPrefersLight ? "light" : "dark";
}

/**
 * Creates a small, self-contained background applier bound to a specific
 * document's <html>/<body>. Returned as a factory (rather than a single
 * apply(bg, docEl, bodyEl) function) so each caller gets its own
 * independent race-guard token — the dashboard and the Options page each
 * apply backgrounds on their own timeline and must never share one
 * counter, or a fast change in one page could get incorrectly treated as
 * "superseded" by an unrelated change in the other.
 *
 * Image backgrounds are validated with a throwaway Image() before ever
 * being committed — a broken/unreachable URL calls onImageError() (the
 * caller decides what that means for its own UI: a toast, an inline
 * message, etc.) rather than leaving something broken-looking on screen.
 * `token` guards against a slow, now-stale load resolving after a newer
 * apply() call has since run for a different URL/type.
 */
export function createBackgroundApplier({ docEl, bodyEl, onImageError, onImageSettled }) {
  let token = 0;

  function clearClasses() {
    bodyEl.classList.remove("bg-custom-color", "bg-custom-gradient", "bg-custom-image");
  }

  function apply(bg) {
    clearClasses();
    token++;
    const myToken = token;

    if (bg.type === "color") {
      docEl.style.setProperty("--bg-override-color", bg.color);
      bodyEl.classList.add("bg-custom-color");
      if (onImageSettled) onImageSettled();
      return;
    }

    if (bg.type === "gradient") {
      docEl.style.setProperty("--bg-override-gradient", `linear-gradient(135deg, ${bg.gradientFrom}, ${bg.gradientTo})`);
      bodyEl.classList.add("bg-custom-gradient");
      if (onImageSettled) onImageSettled();
      return;
    }

    if (bg.type === "image") {
      if (!bg.imageUrl) {
        // No URL saved yet — behave as Default until one is entered. Not a
        // load failure (nothing was attempted).
        if (onImageSettled) onImageSettled();
        return;
      }

      const preload = new Image();
      preload.onload = () => {
        if (myToken !== token) return; // superseded by a newer apply() call
        docEl.style.setProperty("--bg-override-image", `url("${bg.imageUrl}")`);
        bodyEl.classList.add("bg-custom-image");
        if (onImageSettled) onImageSettled();
      };
      preload.onerror = () => {
        if (myToken !== token) return;
        clearClasses(); // fall back to the Default background — the caller's state is untouched
        if (onImageError) onImageError();
      };
      preload.src = bg.imageUrl;
      return;
    }

    // type === "default" — classes already cleared above.
    if (onImageSettled) onImageSettled();
  }

  return { apply };
}
