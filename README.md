# Studio Framework

A VSCode-like UI framework built with **Vue 3** + **TypeScript**. Provides a fully functional IDE shell layout with sidebars, tabs, menus, and property panels — all styled with a VSCode-dark theme.

## Features

- **Menu Bar** — multi-level dropdown menus with hover-to-open behavior
- **Docker (Activity Bar)** — left icon bar with badges, active indicators, single/double-click support
- **Docker Panel (Sidebar)** — expandable panel with content switching (File Explorer, Search, SCM, Extensions, Settings)
- **Workspace** — tabbed editor area with welcome screen and editor placeholder
- **Property Panel** — right sidebar with reactive form fields (`v-model` bound)
- **Status Bar** — bottom bar with left/right-aligned items
- **Sidebar Toggle** — ☰ button to hide/restore left sidebar, remembers panel state
- **Panel Toggle** — ◫ button to show/hide the property panel
- **Double-click Dock Tags** — toggles Docker Panel expansion
- **VSCode Dark Theme** — CSS custom properties for easy re-theming

## Layout

```
┌────────────── Menu Bar ──────────────────────────────────────┐
│ ☰  File  Edit  Selection  View  Help               ◫        │
├──────┬───────────────┬──────────────────┬────────────────────┤
│      │               │                  │                    │
│ Dock │  Docker       │    Workspace     │  Property          │
│  er  │   Panel       │   (Tabbed)       │   Panel            │
│      │               │                  │                    │
├──────┴───────────────┴──────────────────┴────────────────────┤
│ Ln 1, Col 1  Spaces: 2  UTF-8    TypeScript  🟢 main  ⚠ 0  │
└────────────── Status Bar ────────────────────────────────────┘
```

## Tech Stack

| Layer | Choice |
|:---|:---|
| UI | Vue 3 (Composition API + SFCs) |
| Language | TypeScript |
| Build | Vite |
| Styling | CSS custom properties (VSCode-dark theme) |
| Dependencies | `vue` only |

## Project Structure

```
src/
├── main.ts                    # createApp entry point
├── App.vue                    # Root layout, event wiring, state
├── components/
│   ├── MenuBar.vue            # Top bar with dropdown menus + action buttons
│   ├── Docker.vue             # Left icon bar (Activity Bar)
│   ├── DockerPanel.vue        # Left sidebar with content panels
│   ├── Workspace.vue          # Centered tabbed editor
│   ├── PropertyPanel.vue      # Right sidebar with property form fields
│   └── StatusBar.vue          # Bottom status bar
├── styles/
│   └── main.css               # Global theme + layout CSS
├── core/
│   ├── component.ts           # Legacy: DOM-based Component class
│   └── index.ts               # Legacy: barrel export
└── index.ts                   # Legacy: public API
```

> The `core/` directory and old `.ts` component files are legacy from the initial pure-DOM implementation. They are no longer imported.

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Opens at http://localhost:7492
```

## Component Reference

### MenuBar

```vue
<MenuBar
  @toggle-left-sidebar="…"
  @toggle-property-panel="…"
/>
```

Menus are defined inline in the component. To customize, edit the `menus` array in `MenuBar.vue`.

### Docker

```vue
<Docker
  :active-tag="activeTag"
  :visible="leftSidebarVisible"
  :panel-visible="dockerPanelVisible"
  @tag-selected="onTagSelected"
  @tag-double-clicked="onTagDoubleClicked"
/>
```

| Prop | Type | Description |
|:---|:---|:---|
| `active-tag` | `string` | Currently active tag id |
| `visible` | `boolean` | Show/hide the entire Docker bar |
| `panel-visible` | `boolean` | When `false`, hides active indicator |

| Event | Payload | Description |
|:---|:---|:---|
| `tag-selected` | `tagId: string` | Single click (300ms debounce) |
| `tag-double-clicked` | `tagId: string` | Double click — toggles panel |

### DockerPanel

```vue
<DockerPanel
  :active-tag="activeTag"
  :visible="visible"
/>
```

Content switches via `v-if` based on `activeTag`. Add new panels by extending the template conditionals.

### Workspace

```vue
<Workspace />
```

Tabs and content are self-contained. Edit the `tabs` ref to customize.

### PropertyPanel

```vue
<PropertyPanel :visible="visible" />
```

Form fields use `v-model` for two-way binding. Edit the `sections` reactive array to add/remove fields.

### StatusBar

```vue
<StatusBar />
```

Left and right items are defined in the component. Edit `leftItems` / `rightItems` arrays.

## Theme

All colors are defined as CSS custom properties in `src/styles/main.css`. To create a new theme, override these variables:

```css
:root {
  --sf-bg: #1e1e1e;
  --sf-bg-light: #252526;
  --sf-bg-lighter: #2d2d2d;
  --sf-text: #cccccc;
  --sf-text-muted: #858585;
  --sf-text-bright: #ffffff;
  --sf-border: #3c3c3c;
  --sf-active: #37373d;
  --sf-accent: #007acc;
}
```
