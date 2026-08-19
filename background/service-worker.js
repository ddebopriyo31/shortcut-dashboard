/* ==========================================================================
   Shortcut Dashboard — background/service-worker.js

   Deliberately tiny. Its only job is handling the "open-dashboard"
   keyboard command (see manifest.json's "commands"). It does not run on
   any schedule, does not poll, does not make network requests, and holds
   no state of its own — Chrome spins it up only when a registered command
   fires and lets it go idle immediately after.

   As of v3.0.9, the dashboard (dashboard.html) is no longer registered as
   Chrome's New Tab page — Ctrl+T, the "+" button, and Chrome's own New
   Tab (including its search box) are entirely Chrome's again, untouched
   by this extension. This command — plus the popup's "Open Dashboard"
   button — are now the only ways the dashboard opens.

   The "_execute_action" command (Open Popup) needs no code at all —
   that's a reserved command name Chrome itself handles by opening the
   toolbar popup (popup/popup.html), the same as clicking the icon.
   ========================================================================== */

chrome.commands.onCommand.addListener((command) => {
  if (command === "open-dashboard") {
    openOrFocusDashboard();
  }
});

/**
 * Opens the dashboard, focusing an already-open dashboard tab instead of
 * creating a new one when one exists, so repeatedly triggering the
 * command doesn't pile up duplicate tabs. Never touches any other tab,
 * never navigates the user's current tab, and never affects Chrome's own
 * New Tab behavior — this only ever opens dashboard.html, a normal
 * extension page like any other.
 *
 * Querying/updating the extension's own page doesn't require the "tabs"
 * permission — that's only needed to read another site's tab details.
 */
async function openOrFocusDashboard() {
  const dashboardUrl = chrome.runtime.getURL("dashboard.html");
  try {
    const tabs = await chrome.tabs.query({ url: dashboardUrl });
    if (tabs.length > 0) {
      const tab = tabs[0];
      await chrome.tabs.update(tab.id, { active: true });
      if (typeof tab.windowId === "number") {
        await chrome.windows.update(tab.windowId, { focused: true });
      }
      return;
    }
  } catch (err) {
    console.error("Shortcut Dashboard: couldn't look for an open dashboard tab, opening a new one instead.", err);
  }
  chrome.tabs.create({ url: dashboardUrl });
}
