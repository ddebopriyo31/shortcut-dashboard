# Shortcut Dashboard — V2 Changelog

V2 upgrades the V1.1 shortcut launcher into a dashboard for managing a
larger number of shortcuts. It's still plain HTML/CSS/vanilla JS with
localStorage — no frameworks, no backend, no new dependencies.

## New data model
- Central state object at one localStorage key: `shortcutDashboardState`.
- `{ version: 2, settings, categories: [], shortcuts: [] }`.
- Shortcuts gained: `icon` (typed), `categoryId`, `favorite`, `position`,
  `updatedAt`. Categories are a new first-class record: `{ id, name, icon,
  position }`.
- All records use stable generated IDs (`crypto.randomUUID()` where
  available, timestamp+random fallback) — never array indexes.

## V1.1 → V2 migration
- On first V2 load, if no V2 state exists yet, the old
  `shortcutDashboard.shortcuts.v1` key is read, validated with the same
  V1.1 URL/name rules, and converted into V2 shortcut records
  (`favorite: false`, `categoryId: null`, `icon: { type: "favicon" }`).
  Existing IDs, names, URLs, and creation timestamps are preserved, and
  ordering is preserved via a new `position` field.
- The legacy V1.1 key is never written to or cleared — migration only
  ever reads it, so old data can't be destroyed by a failed or partial
  migration.
- Once V2 state exists, it's the only thing read going forward (no
  re-migration, so deleted items don't reappear).

## Categories
- New sidebar with built-in system views — **All**, **Favorites**,
  **Uncategorized** — plus any categories you create. System views can't
  be deleted.
- Create, rename, and delete categories from the sidebar; assign a
  shortcut's category from the Add/Edit dialog.
- Deleting a category never deletes its shortcuts — they fall back to
  Uncategorized.
- Sidebar collapses into a slide-out drawer on narrow viewports.

## Favorites
- Every card has a star toggle, independent of Edit/Delete, with its own
  `aria-pressed` state and accessible label. It's a real `<button>` so it
  works from the keyboard out of the box and never triggers the "open
  site" action.
- Favorite state saves immediately and survives refresh.

## Custom icons
- Icon types: Automatic favicon (default, unchanged from V1.1), Custom
  image URL, Emoji, or Letter fallback.
- Custom image URLs go through the same http/https validation as
  shortcut URLs and are only ever assigned via `img.src` / DOM APIs —
  never `innerHTML`. A broken or unreachable image silently falls back
  to the letter icon, same fade-in/fallback pattern V1.1 used for
  favicons.

## Search & filtering
- Search now matches name, full URL, domain, *and* category name — still
  case-insensitive, whitespace-tolerant, and a safe plain substring match
  (no regex).
- Search composes with the active sidebar view, so "Favorites + search"
  and "a specific category + search" both narrow correctly.
- Result counts and empty states are now specific to the active view
  (e.g. "No favorites yet" vs. "Nothing found for '…' in Development").

## Add/Edit dialog
- Expanded with Category, Favorite, and Icon controls, alongside the
  existing Name/URL fields.
- Editing preserves everything you don't explicitly change (id,
  `createdAt`, `position` stay put; only touched fields update, plus a
  new `updatedAt` timestamp).
- V1.1's URL normalization and duplicate-URL detection are unchanged.

## Reliability & accessibility carried over unchanged
- Same storage self-healing: malformed/duplicate/id-less records are
  dropped or repaired on load rather than crashing the app, and the
  cleaned result is written back so corruption doesn't resurface.
- Same "never claim a save that didn't happen" toast behavior for every
  mutation (add/edit/delete shortcut, add/rename/delete category,
  toggle favorite).
- Same modal focus-trap, Escape-to-close, and focus-return behavior,
  now shared across all four dialogs (Add/Edit, Delete shortcut, Add/
  Rename category, Delete category).
- Same `/`-to-search keyboard shortcut, visible focus rings, and
  `prefers-reduced-motion` support.

## Explicitly not in this release (postponed to V2.1 / V2.2)
Drag-and-drop reordering, import/export, custom backgrounds, advanced
context menus, a clock, an advanced keyboard-shortcut system, and
merge/import logic.
