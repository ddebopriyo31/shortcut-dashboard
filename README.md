# Shortcut Dashboard — Chrome Extension (V3.0.6)

A fast, keyboard-friendly New Tab dashboard for your shortcuts —
categories, favorites, search, drag-and-drop reordering, and a
themeable, customizable background. Everything runs client-side and
saves to `chrome.storage.local`; there's no server, no account, and no
cloud sync.

This is the **Chrome Extension (Manifest V3)** build of the dashboard,
converted from the standalone V2.2 web app. It opens automatically
whenever you open a new tab.

## Installing (unpacked, for development)

1. Open `chrome://extensions/` in Chrome.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select this `shortcut-dashboard/` folder.
4. Open a new tab — the dashboard should appear.

## Project structure

```
shortcut-dashboard/
├── manifest.json      Manifest V3 config: name, version, New Tab override,
│                        Options page, popup, icons, keyboard commands,
│                        background service worker, and the "storage"
│                        permission (required for chrome.storage.local).
├── background/
│   └── service-worker.js  Tiny — its only job is handling the
│                            "Open Dashboard" keyboard command (see
│                            "Keyboard commands" below). No polling, no
│                            network requests, no persistent state.
├── newtab.html         All dashboard markup: shortcut grid, sidebar, and
│                        every modal (add/edit shortcut, categories,
│                        settings, import/export, context menu). Loads
│                        js/app.js as an ES module.
├── css/
│   └── style.css       All styling — design tokens, light/dark theme,
│                        grid-size and background customization,
│                        responsive/mobile rules. Reused as-is by the
│                        Options page. Unchanged from V2.2.
├── js/
│   ├── theme-init.js   Applies the saved theme as early as possible, to
│   │                    minimize a flash of the wrong theme. Reads from
│   │                    chrome.storage.local.
│   ├── app.js           Dashboard-specific logic only: the shortcut grid,
│   │                    sidebar, modals, drag-and-drop, search, context
│   │                    menus. Wires the shared modules below to this
│   │                    page's own DOM.
│   └── shared/
│       ├── store.js      The single source of truth for state shape,
│       │                  validation/sanitization, chrome.storage.local
│       │                  persistence, the V1.1/V2.2 → V3 migration, and
│       │                  import merge/validate logic. Plain ES module,
│       │                  no DOM — imported unchanged by app.js AND
│       │                  options/options.js (see "Storage" below).
│       └── appearance.js  Shared theme-resolution and background-render
│                           logic (with the image-load race-guard),
│                           imported unchanged by app.js AND
│                           options/options.js.
├── popup/               The toolbar-icon popup (see "Popup" below).
│   ├── popup.html
│   ├── popup.css
│   ├── popup.js
│   └── popup-theme-init.js
├── options/             The Options / Settings page (see "Options page"
│   │                    below).
│   ├── options.html
│   ├── options.css
│   ├── options.js
│   └── options-theme-init.js
└── icons/               Extension toolbar/store icons (16/48/128px).
```

## Storage

Persisted state lives in **`chrome.storage.local`** under the key
`shortcutDashboardState` — the same JSON shape V2.2 used. All
validation, sanitization, persistence, and the one-time V2.2 →
V3 migration live in **`js/shared/store.js`**, a plain ES module with
no DOM dependencies, imported unchanged by both `js/app.js` (the
dashboard) and `options/options.js` (the Options page) — see
"Shared architecture" below. Writes are:

- Serialized into a single queue per page, so two rapid saves (e.g.
  dragging the background color picker) can never complete out of
  order and overwrite newer data with older data.
- Snapshotted synchronously before each write is queued, so a save
  always persists exactly the state that was current when it was
  requested.
- Never throwing on failure — a failed save shows a toast rather than
  silently pretending the change was saved, and never destroys
  previously-saved valid data.

### Migration from V2.2

The first time V3 runs and finds no data yet in `chrome.storage.local`,
it automatically migrates:

1. If V2.2's `localStorage` key (`shortcutDashboardState`) has valid
   data, that's sanitized and copied in.
2. Otherwise, if there's data under the older V1.1 `localStorage` key,
   the existing V1 → V2 migration (unchanged from V2.2) runs first.
3. Otherwise, it's a fresh install and starts empty.

A `shortcutDashboardMigration` marker is written to
`chrome.storage.local` recording that migration ran, when, and which
source it came from — mainly for debugging. The actual "don't migrate
twice" guarantee comes from `chrome.storage.local` already having data:
once anything exists there, it's always treated as authoritative and
migration is skipped, marker or not.

**The old `localStorage` data is never deleted or modified.** It's left
in place as a safety net; the only remaining `localStorage` reads in
the codebase are this one-time migration check.

### A note on theme flash

V2.2's pre-paint theme script could read `localStorage` synchronously,
so it always finished before first paint with zero flash of the wrong
theme. `chrome.storage.local` has no synchronous equivalent, so every
`*-theme-init.js` now reads it asynchronously — still as early as
possible, but it's technically possible (rare) for the browser to paint
the default dark theme for a moment before a light/system-light theme
gets applied. This is an inherent trade-off of the storage migration,
not a bug.

## Shared architecture (dashboard + Options page)

As of Task 4, the dashboard (`js/app.js`) and the Options page
(`options/options.js`) both import the exact same two modules instead
of each implementing their own copy:

- **`js/shared/store.js`** — state shape, all sanitization/validation,
  `loadState()`/`persistState()`, the migration, `mergeStates()` (used
  by both pages' Import → Merge), and `parseImportedBackup()` (used by
  both pages' Import → validate step).
- **`js/shared/appearance.js`** — `resolveEffectiveTheme()` and
  `createBackgroundApplier()` (the background-image load/race-guard
  logic). Each page calls this bound to its own `<html>`/`<body>`, so
  the dashboard and Options page each get their own independent
  race-guard state, but identical rendering behavior.

Neither page can drift out of sync with the other on how a setting is
validated, persisted, or rendered, because there is only one
implementation of any of that — not two similar ones.

**Live sync:** both pages also listen for `chrome.storage.onChanged`,
so a setting changed in one (Options page, dashboard, or another open
tab of either) is reflected in the other without a refresh. Each
listener ignores changes that just echo its own most recent write
(compared against its in-memory state) and skips applying anything
while a shortcut is mid-drag or a confirmation modal is open.

## Popup

Clicking the extension's toolbar icon opens a small popup
(`popup/popup.html`) — a quick-access panel, not a second copy of the
dashboard. It shows:

- An **Open Dashboard** button, which opens the New Tab dashboard in a
  new tab.
- A **Settings** button, which opens the Options page
  (`chrome.runtime.openOptionsPage()`-equivalent navigation to
  `options/options.html`).
- A **Favorites** list — icon + title for each favorited shortcut,
  each opening its URL in a new tab when clicked. Shows "No favourite
  shortcuts yet." when there are none.
- Read-only **stats**: total shortcuts, favorites, and categories.

The popup reads directly from `chrome.storage.local` (the same key the
dashboard and Options page use) — it's a separate top-level document
and can't reach into another page's in-memory state, so this is the
correct way for it to see the same data. It never touches
`localStorage`, never writes anything.

Opening a favorite's URL, or the dashboard/Options page, uses
`chrome.tabs.create()`, which doesn't require the `tabs` permission
here since nothing reads a `Tab` object's `url`/`title`/`favIconUrl`
back. The popup closes itself right after opening a tab.

## Options page

`options/options.html` is a dedicated Manifest V3 Options page
(`manifest.json`'s `options_page`), reachable via `chrome://extensions/`
→ Shortcut Dashboard → **Details** → **Extension options**, or via the
popup's Settings button. It reuses `css/style.css` directly (so every
control — theme picker, grid-size picker, toggles, color/gradient/image
fields, buttons, modals, toast — looks pixel-identical to the same
control in the dashboard), organized into four cards:

- **Appearance** — Theme, Grid size, and the "show on dashboard"
  toggles (search bar, domain, clock).
- **Background** — the same Default/Solid color/Gradient/Image URL
  controls and validation/failure behavior as the dashboard.
- **Data** — Export, Import (Replace/Merge, with the same
  validation/duplicate/category handling as the dashboard), and
  **Reset all data**, a new "danger zone" action gated behind an
  explicit confirmation dialog (not a native `confirm()`, styled to
  match the rest of the app) that clears only this extension's own
  `chrome.storage.local` data — nothing else on the device.
- **About** — the extension name and its version, read live from
  `chrome.runtime.getManifest()` rather than hardcoded, so it can never
  drift out of sync with `manifest.json`.

Every control saves immediately through the shared `persistState()` —
there is no separate "Save" button, and no separate settings storage
of any kind.

## What changed in this task (Task 4)

- Added `js/shared/store.js` and `js/shared/appearance.js`, and moved
  all state/storage/appearance logic that previously lived only in
  `app.js` into them.
- `app.js`: converted to an ES module (`<script type="module">`) that
  imports the shared modules instead of defining its own copies;
  dashboard-specific code (DOM, rendering, drag-and-drop, etc.) is
  otherwise unchanged. Added a `chrome.storage.onChanged` listener for
  live sync with the Options page. The popup's Settings button now
  opens the Options page directly instead of a `#settings` hash on the
  dashboard (that hash handling was removed as no longer needed).
- `newtab.html`: `js/app.js` now loads as `type="module"`.
- `popup/popup.js`: Settings button now opens `options/options.html`.
- Added `options/` (`options.html`, `options.css`, `options.js`,
  `options-theme-init.js`).
- `manifest.json`: added `"options_page": "options/options.html"`. No
  new permissions.

No cloud sync, accounts, or other unrelated features were added; the
main dashboard's UI, layout, and behavior are unchanged.

## Keyboard commands

Registered under `manifest.json`'s `commands` key, visible/editable at
`chrome://extensions/shortcuts`. Neither has a hardcoded default key —
Chrome extension commands are user-assigned by design, and picking a
default risks silently colliding with an existing Chrome shortcut, so
both are left for the user to bind to whatever they'd like:

- **Open Dashboard** (`open-dashboard`) — handled by
  `background/service-worker.js`. If a dashboard tab (`newtab.html`) is
  already open in any window, it's switched to and focused instead of
  opening a duplicate; otherwise a new one is opened.
- **Open the Shortcut Dashboard popup** (`_execute_action`) — a
  reserved Chrome command name; Chrome opens the toolbar popup itself
  when it fires, so no code is needed for it.

The service worker only wakes up to handle `open-dashboard` — no
polling, timers, network requests, or persistent background state.

## What changed in this task (Task 5)

Polish pass — no new dashboard/popup/Options functionality, per the
task's scope. Concrete changes:

- Added `background/service-worker.js` and a `commands` block in
  `manifest.json` for the two keyboard commands above.
- Added a 32×32 icon (`icons/icon32.png`) alongside the existing
  16/48/128 set, referenced from both `icons` and `action.default_icon`
  in the manifest, for sharper rendering on some Windows/HiDPI
  contexts.
- Fixed a real (if minor) inefficiency found during the performance
  review: the Options page's `chrome.storage.onChanged` listener was
  calling `loadState()` — an extra `chrome.storage.local` read — when
  it already had the changed value in hand; it now sanitizes that value
  directly, matching the dashboard's own listener.
- Fixed a small accessibility/consistency gap: the Options page's
  modals now lock body scroll while open, matching the dashboard's
  existing modal behavior (they already had the focus trap, Escape
  handling, and focus restoration from Task 4).
- Reviewed for security (no `eval`/`new Function`/inline scripts/unsafe
  `innerHTML` anywhere in the project — confirmed clean, nothing to
  fix), performance (no duplicate `init`/listener registration, no
  leaked timers, no debug `console.log` leftovers), and accessibility
  (icon-only buttons have `aria-label`s, focus-visible rings are
  present everywhere, modals are keyboard-operable) — no other issues
  found that this task's scope calls for fixing.

## Search, filtering, and sort

Search (the box in the header, focusable with `/`) matches shortcut
title, URL, domain, and category name — case-insensitively, with
leading/trailing/repeated whitespace collapsed. It's a plain substring
match over the in-memory shortcut list (no index, no external library),
which stays fast up to at least 1,000 shortcuts on a full re-render per
keystroke; nothing here needs debouncing or an incremental-render
scheme.

Filtering is the existing sidebar view system: **All**, **Favorites**,
**Uncategorized**, or a specific **category**. Search always layers on
top of whichever filter is active, and clearing one never resets the
other. Filtering/searching are pure display operations — they never
change `state.shortcuts`, `position`, favorite state, or category
membership, and never write to storage. While searching, a category
with no matching shortcuts is hidden from the sidebar (not deleted —
it reappears the instant the search is cleared).

A **Sort** control (Manual order / Name A→Z / Name Z→A) sits above the
grid. Manual is the shortcut's real, persisted drag-and-drop order;
A→Z/Z→A are temporary display-only views computed fresh on every
render and never written anywhere — there is no "save this sort as the
new order" action, so a user's real manual order can never be silently
overwritten by browsing alphabetically for a moment. While a temporary
sort is active, drag-and-drop and keyboard reordering are disabled
(the handle is visibly disabled, with an explanatory tooltip) rather
than left on: reordering relative to alphabetically-adjacent cards
would otherwise silently renumber the *real* manual order to match
whatever the sort happened to display next to it.

## What changed in this task (Task 6)

Existing V2.2/V3 search and filtering already covered most of this
task's scope (title/URL/category-name search, All/Favorites/
Uncategorized/Category filters, search+filter composing correctly,
order/IDs/favorite state never touched by filtering) — the concrete
additions/fixes were:

- `newtab.html`: added the Sort `<select>` in a small toolbar row above
  the grid (`.content-toolbar`), next to the existing result-count
  status line.
- `css/style.css`: styling for that toolbar row and the compact sort
  control (reusing the existing `.select-input` tokens), plus a
  `:disabled` state for the drag handle.
- `js/app.js`:
  - Added `sortShortcuts()` (display-only, described above) and wired
    the new `<select>` to it.
  - Extracted `shortcutMatchesSearch()` out of `getFilteredShortcuts()`
    so the same match logic could be reused for the sidebar's
    empty-category hiding, instead of a second copy of it.
  - Disabled drag-and-drop/keyboard reorder while a temporary sort is
    active (in `buildCard()`, `handleGridDragStart()`, and
    `handleGridHandleKeydown()`) — see "Search, filtering, and sort"
    above for why this was necessary rather than optional.
  - Hid sidebar categories with zero search matches (`renderSidebar()`).

Sort order is intentionally **not** persisted to `chrome.storage.local`
— it's ephemeral UI state that resets to Manual on reload, per the
task's guidance not to add storage writes or a new settings field for
something that already has a clear, safe default. The popup was not
touched: it reads favorites straight from `chrome.storage.local`,
independent of this in-memory-only search/filter/sort state.

See [CHANGELOG-V2.2.md](CHANGELOG-V2.2.md), [CHANGELOG-V2.1.md](CHANGELOG-V2.1.md),
and [CHANGELOG-V2.md](CHANGELOG-V2.md) for the dashboard's earlier history.
