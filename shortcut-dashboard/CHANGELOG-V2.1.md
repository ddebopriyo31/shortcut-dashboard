# Shortcut Dashboard — V2.1 Changelog

V2.1 is a feature update on top of V2, still plain HTML/CSS/vanilla JS with
localStorage — no frameworks, no new dependencies, no drag-and-drop library.
The V2 data model, visual design, and existing features are unchanged except
where noted below. V2.2-style customization (themes, layout, backgrounds,
etc.) is explicitly **not** part of this release.

## Drag-and-drop reordering
- Every card gets a small `⠿` drag handle (`.card-drag-handle`); it's the
  *only* draggable element on a card, so a drag can only ever start there —
  clicking Favorite/Edit/Delete never accidentally triggers one.
- Drop before/after another card reorders using the existing `position`
  field. Reordering happens within whatever's currently visible (a category,
  Favorites, a search, or All), so it always respects the selected view.
- Order is written to `state.shortcuts[].position` immediately and
  persisted — it survives a refresh.

## Keyboard reordering (no mouse required)
- Focus a card's drag handle, then:
  - **Arrow Up / Arrow Down** — move one place up/down within the current view.
  - **Home / End** — move to the start/end of the current view.
- Keyboard and drag reordering share one function (`moveShortcut`), so they
  always agree on ordering and both get the same persistence handling.
- After a keyboard move, focus stays on the same shortcut's handle (it
  doesn't get lost on re-render).

## Import / Export
- New **Settings** panel (gear icon in the header) with **Export** and
  **Import** controls.
- Export downloads the complete V2 state (settings, categories, shortcuts)
  as `shortcut-dashboard-backup-YYYY-MM-DD.json`.
- Import validates before touching anything:
  - Malformed JSON, non-object payloads, and unsupported `version` values
    (anything other than `2`) are rejected with a clear toast — nothing is
    changed.
  - The same field-level sanitizer V2 already uses for loading storage
    (`sanitizeState`) validates every record's shape and URLs, drops
    individually malformed records instead of failing the whole import, and
    resolves duplicate ids / duplicate normalized URLs *within the imported
    file itself*.
- A valid import always asks **Replace / Merge / Cancel** before changing
  anything:
  - **Replace** — swaps in the imported (already-sanitized) data only after
    confirmation.
  - **Merge** — keeps everything you already have. Categories are matched
    by name (case-insensitive) to avoid duplicates; shortcuts whose
    normalized URL already exists are skipped (existing data always wins);
    any id that collides with an existing one is regenerated. Existing data
    is never modified or deleted by a merge.
  - **Cancel** — discards the parsed import; nothing changes.

## Right-click context menu
- Right-click (or use the keyboard context-menu key) on a card for: **Open**,
  **Open in new tab**, **Edit**, **Favorite/Unfavorite**, **Move to
  category** (inline submenu of every category + "No category", current one
  checked), and **Delete**. Every item is fully wired — no placeholders.
- Closes on outside click, **Escape**, or selecting an action.
- **Open** navigates the current tab (`window.location.assign`); **Open in
  new tab** opens a new tab (`window.open(..., "_blank")`) — genuinely
  different behaviors. (Clicking a card's main tile is unchanged from V2:
  it still opens in a new tab.)

## Advanced keyboard shortcuts
- `/` and `Ctrl/Cmd+K` — focus search
- `Ctrl/Cmd+N` — open the Add Shortcut dialog
- `Ctrl/Cmd+Shift+F` — jump to the Favorites view
- `Escape` — close the open dialog, the context menu, or the mobile sidebar
  drawer (in that priority order)
- All of the above (other than Escape) are suppressed while typing in an
  input/textarea/select or while a dialog/menu is open, so they never
  interfere with normal text entry.
- A "Keyboard shortcuts" reference is listed in Settings.

## Persistence hardening
- The reordering, "move to category," and import (Replace/Merge) code
  paths now follow the same rule the rest of V2 already used: every mutation
  checks `persistState()`'s return value and only shows a success toast if
  the save actually happened. A failed save shows an explicit "...could not
  be saved permanently" error toast instead — never a false success.

## Explicitly not in this release
Customization features (themes, backgrounds, layout density controls,
clock, etc.) are deferred to V2.2, per scope.

## Testing performed
An automated jsdom-based smoke suite (not shipped with the app; used only to
verify this change) exercises the real `index.html` + `app.js` end to end:
- Keyboard reorder (Home) persists and survives a simulated refresh (fresh
  DOM instance against the same storage).
- Import → Merge: preserves existing shortcuts, adds new ones, skips a
  duplicate-normalized-URL record, adds a new category, drops a malformed
  record — without throwing.
- Import → Replace: discards prior data, keeps only the sanitized import.
- A malformed (invalid JSON) import file does not throw and does not open
  the confirm dialog.
- Context menu "Move to category" updates and persists `categoryId`.
- Context menu "Open" vs "Open in new tab" are verified to take different
  code paths (`window.location.assign` vs `window.open(..., "_blank")`).
- `Ctrl+N` and `/` typed while focus is inside the search input do not
  trigger app shortcuts.
- A simulated `localStorage.setItem` failure produces an accurate
  "could not be saved permanently" error toast, not a false success.

Manually reviewed (not automatable in this environment): the native
drag-and-drop gesture itself (`dragstart`/`dragover`/`drop`/`dragend`), and
that dragging from the handle never fires from the Favorite/Edit/Delete
buttons since only the handle carries `draggable="true"`.
