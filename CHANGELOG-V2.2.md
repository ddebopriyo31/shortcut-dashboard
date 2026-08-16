# Shortcut Dashboard — V2.2 Changelog

V2.2 is a customization and polish release. The shortcut/category data
model, storage format, and every V2/V2.1 interaction (drag-and-drop,
keyboard reorder, context menu, import/export/merge, categories,
favorites, search) are unchanged. Nothing here changes what a shortcut
or category *is* — only how the dashboard looks and displays.

## 1. Theme
- Added Dark / Light / System, chosen in **Settings → Appearance**.
- System resolves the browser's `prefers-color-scheme` and updates live if
  the OS theme changes while the app is open — no refresh needed.
- A small inline script in `<head>` applies the saved/resolved theme
  before first paint, so there's no flash of the wrong theme on load.
- Selection is persisted; Light theme is a full token swap (backgrounds,
  text, borders, accents) reusing the app's existing CSS variables, so no
  component styles needed duplicating.

## 2. Grid size
- Added Small / Medium / Large in **Settings → Appearance**.
- Card size, icon size, and type scale with the chosen density; column
  width and gap are driven by CSS custom properties.
- Mobile has its own floor per size (independent of the desktop value),
  so every size stays usable — and never forces horizontal scrolling —
  on a phone.
- Persisted; applied instantly without a page reload.

## 3. Display options
- Added Show search / Show domain / Show clock toggles in
  **Settings → Display**.
- Show search hides the search bar and disables its `/` and `Ctrl/Cmd+K`
  shortcuts while off (they resume working once it's back on).
- Show domain hides the domain line on every shortcut card.
- Show clock reveals the header clock (see below).
- All three persist and take effect immediately.

## 4. Clock and date
- Optional header clock showing local time and date, using
  `toLocaleTimeString` / `toLocaleDateString` — no external API, no
  network request.
- Backed by a single managed `setInterval`. Toggling the setting on
  repeatedly never stacks a second interval, and turning it off always
  clears the running one.
- Date is hidden on very narrow screens (<420px) to keep the header from
  crowding; time remains.

## 5. Background
- Added Default / Solid color / Gradient / Image URL in
  **Settings → Background**.
- Image URLs are validated as http/https before use; the image is
  preloaded off-screen first, so a broken or unreachable URL falls back
  to the Default background (with an inline error and a toast) instead
  of leaving a broken-looking page.
- A subtle readability scrim sits over any non-default background —
  above the background, below the app's cards and text — so content
  stays legible regardless of what color, gradient, or photo is behind
  it.
- No wallpaper upload or cloud storage — URL only, as scoped.

## 6. UI polish
- Settings is now a proper multi-section dialog (see below) instead of
  one long scrolling panel.
- Segmented controls and toggle switches for the new settings, styled
  consistently with the app's existing form language.
- Minor refinements to focus states or transitions for new elements are
  scoped to what V2.2 introduced — existing shortcut cards, category
  nav, and empty states are visually unchanged.
- All new transitions/animations (tab switching, toggle thumb, modal)
  respect `prefers-reduced-motion`, same as the rest of the app.

## 7. Settings
- Restructured into five tabs: **Appearance**, **Display**, **Background**,
  **Keyboard shortcuts**, **Data management**.
- Every control lives in exactly one place — no setting is duplicated
  across tabs or between Settings and the main UI.
- Tabs support click and arrow-key (Left/Right/Home/End) navigation per
  the standard ARIA tabs pattern; the existing modal focus-trap and
  focus-restoration logic needed no changes to work with them.
- Export/Import (Data management) and the keyboard shortcuts reference
  are the same content as V2.1, just relocated under tabs.

## 8. Accessibility
- Settings tabs use `role="tablist"`/`role="tab"`/`role="tabpanel"` with
  roving `tabindex` and `aria-selected`.
- New toggle switches and segmented options are real `<input>` elements
  inside `<label>`s — full keyboard operability and screen-reader
  semantics, with visible focus rings.
- Background image errors are announced via `role="alert"`.
- All new interactive targets meet a comfortable touch-target size on
  mobile.
- Reused the app's existing modal focus-trap/restoration — verified it
  still correctly bounds Tab/Shift+Tab within the settings dialog now
  that it has hidden inactive-tab panels.

## 9. Regression coverage
Manually re-verified against the V2/V2.1 feature list after the
customization changes: categories, favorites, search, custom icons,
drag-and-drop reordering, keyboard reorder, import/export, merge,
context menu, keyboard shortcuts, settings, theme, clock, and
background. No changes were made to `sanitizeShortcut`,
`sanitizeCategory`, storage keys, or any rendering function beyond what's
listed above.

## Notes for future maintenance
- New `state.settings` fields: `background: { type, color, gradientFrom,
  gradientTo, imageUrl }`; `theme` now also accepts `"system"`.
  `sanitizeSettings`/`sanitizeBackground` self-heal old or malformed
  values the same way the rest of the storage layer already does.
- Importing a backup via **Replace** also swaps in that backup's
  appearance settings (theme, grid size, background, ...); **Merge**
  intentionally keeps your current appearance settings untouched.
