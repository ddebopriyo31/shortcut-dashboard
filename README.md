# Shortcut Dashboard

A fast, keyboard-friendly personal start page for organizing links into
categories — favorites, search, custom icons, drag-and-drop reordering,
and a themeable, customizable dashboard. Everything runs client-side and
saves to `localStorage`; there's no server, no build step, and no
account.

Current version: **V2.2**. See [CHANGELOG-V2.2.md](CHANGELOG-V2.2.md),
[CHANGELOG-V2.1.md](CHANGELOG-V2.1.md), and [CHANGELOG-V2.md](CHANGELOG-V2.md)
for the history.

## Getting started

This is a static site — three files, no dependencies to install.

1. Open `shortcut-dashboard/index.html` directly in a browser, **or**
2. Serve the `shortcut-dashboard/` folder with any static file server, e.g.:

   ```bash
   cd shortcut-dashboard
   python3 -m http.server 8000
   # then visit http://localhost:8000
   ```

Either works the same way; a local server just avoids any browser
quirks around the `file://` protocol. There's no `npm install`, no
bundler, and no build output — edit the files and reload.

## Project structure

```
shortcut-dashboard/
├── index.html      All markup: shortcut grid, sidebar, and every modal
│                    (add/edit shortcut, categories, settings, import/export,
│                    context menu).
├── css/
│   └── style.css   All styling, including the light/dark theme tokens,
│                    grid-size and background customization, and
│                    responsive/mobile rules.
└── js/
    └── app.js      All behavior, in a single IIFE. No framework, no
                     external JS dependencies.
```

The only external resource the page loads is a Google Fonts stylesheet
(Space Grotesk / Inter / JetBrains Mono) for typography — everything
else is self-contained. The app works fully offline if that font
request fails; it just falls back to system fonts.

## Features

**Shortcuts & organization**
- Add, edit, and delete shortcuts with a name, URL, and icon (favicon,
  emoji, letter, or a custom image URL).
- Organize shortcuts into categories; drag-and-drop or keyboard
  (arrow keys on a shortcut's drag handle) to reorder within a category.
- Mark shortcuts as favorites for a dedicated view.
- Live search across all shortcuts.
- Right-click (or long-press) context menu for quick actions.

**Data management**
- Export the entire dashboard (shortcuts, categories, and settings) as a
  JSON backup.
- Import a backup and choose to **Replace** everything or **Merge** it
  into what you already have.
- Automatically migrates data from the older V1.1 storage format on
  first load, if present.

**Customization** (Settings, gear icon)
- **Appearance** — Dark / Light / System theme (System follows your OS
  setting live), and Small / Medium / Large grid density.
- **Display** — toggle the search bar, the domain line on cards, and an
  optional header clock/date.
- **Background** — Default, a solid color, a two-color gradient, or a
  custom image URL, with automatic fallback if an image fails to load.
- **Keyboard shortcuts** — a quick reference of every shortcut below.
- **Data management** — export/import, described above.

All settings persist locally and apply immediately — there's no
separate "Save" step.

## Keyboard shortcuts

| Keys | Action |
|---|---|
| `/` or `Ctrl/Cmd+K` | Focus search |
| `Ctrl/Cmd+N` | Add a new shortcut |
| `Ctrl/Cmd+Shift+F` | Jump to Favorites |
| `Esc` | Close the open dialog or menu |
| Right-click a card | Open its context menu |
| Focus a card's drag handle, then `↑`/`↓` | Reorder that shortcut |
| Focus a card's drag handle, then `Home`/`End` | Move it to the start/end |

(Search-related shortcuts are inactive while "Show search" is turned
off in Settings.)

## Data & storage

Everything is stored in the browser's `localStorage`, scoped to
whatever origin you open the app from — nothing is sent to a server.

- Current format: key `shortcutDashboardState`, holding shortcuts,
  categories, and settings together as one JSON object.
- Legacy format: key `shortcutDashboard.shortcuts.v1`, from the original
  V1.1 release. If present and the current-format key is empty, it's
  read once and migrated in; the legacy key itself is never modified.
- Clearing your browser's site data for this page will erase your
  dashboard — export a backup first if you want to keep it.

## Browser support

Built on standard, broadly-supported web platform features (CSS custom
properties, `matchMedia`, `localStorage`, drag-and-drop). A modern
evergreen browser (recent Chrome, Firefox, Safari, or Edge) is
recommended. No transpilation or polyfills are included.

## Accessibility

- Full keyboard navigation, including drag-free reordering via arrow
  keys.
- Modals trap and restore focus correctly, including the tabbed
  Settings dialog.
- Respects `prefers-reduced-motion` for all animations/transitions.
- Respects `prefers-color-scheme` when the theme is set to System.
