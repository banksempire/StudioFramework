# Studio Framework

A VSCode-like UI framework built with **Vue 3** + **TypeScript**. Provides a fully functional IDE shell layout with panels, tabs, and menus — all styled with a VSCode-dark theme.

## Features

- **Menu Bar** — multi-level dropdown menus with hover-to-open behavior
- **Docker (Activity Bar)** — left icon bar with badges, active indicators, single/double-click support
- **Docker Panel** — expandable panel with content switching (File Explorer, Search, SCM, Extensions, Settings)
- **Workspace** — tabbed editor area with welcome screen and editor placeholder
- **Right Panel** — right panel with reactive form fields (`v-model` bound)
- **Status Bar** — bottom bar with left/right-aligned items
- **Panel Toggle** — ☰ button to hide/restore left panel, remembers panel state
- **Panel Toggle** — ◫ button to show/hide the right panel
- **Double-click Dock Tags** — toggles Docker Panel expansion
- **Resizable Panels** — drag panel edges to resize (180–500px). Dragging past ~80px collapses the panel with a live glow indicator on the opposite edge
- **VSCode Dark Theme** — CSS custom properties for easy re-theming

## Layout

```
┌────────────────── Menu Bar ──────────────────────────────────┐
│ ☰  File  Edit  Selection  View  Help               ◫        │
├──────┬───────────────┬──────────────────┬────────────────────┤
│      │               │                  │                    │
│ Dock │  Docker       │    Workspace     │  Right Panel       │
│  er  │   Panel       │   (Tabbed)       │   Panel            │
│      │               │                  │                    │
├──────┴───────────────┴──────────────────┴────────────────────┤
│ Ln 1, Col 1  Spaces: 2  UTF-8    TypeScript  🟢 main  ⚠ 0  │
└────────────── Status Bar ────────────────────────────────────┘
```

| UI Element | Description |
|:---|:---|
| ☰ (48px) | `◫` / `◨` — Toggle left panel. Icon reflects panel state |
| ◫ | `◫` / `◧` — Toggle right panel. Icon reflects panel state |

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
│   ├── DockerPanel.vue        # Left panel with content panels
│   ├── Workspace.vue          # Centered tabbed editor
│   ├── RightPanel.vue         # Right panel with form fields
│   └── StatusBar.vue          # Bottom status bar
├── composables/
│   └── useResize.ts          # Resize composable for draggable panel edges
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

Top bar with dropdown menus, a left toggle button (48px wide, matching Docker), and a right panel toggle.

```vue
<MenuBar
  :left-panel-visible="leftPanelVisible"
  :right-panel-visible="rightPanelVisible"
  @toggle-left-panel="…"
  @toggle-right-panel="…"
/>
```

| Button | Position | Width | Icon (collapsed → expanded) | Action |
|:---|:---|:---|:---|:---|
| ☰ | Far left | 48px | ◫ → ◨ | Toggle Docker + DockerPanel |
| ◫ | Far right | 48px | ◫ → ◧ | Toggle Right Panel |

| Prop | Type | Description |
|:---|:---|:---|
| `left-panel-visible` | `boolean` | Current left panel state (drives icon) |
| `right-panel-visible` | `boolean` | Current right panel state (drives icon) |

Menus are defined in the `menus` array inside `MenuBar.vue`. Each menu has a `label` and `items` array with `{ label, action?, separator? }`.

### Docker

```vue
<Docker
  :active-tag="activeTag"
  :visible="leftPanelVisible"
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
  @collapse="onPanelCollapse"
/>
```

Content switches via `v-if` based on `activeTag`. Add new panels by extending the template conditionals.

| Event | Payload | Description |
|:---|:---|:---|
| `collapse` | – | Emitted when resize drag crosses the collapse threshold |

### Workspace

```vue
<Workspace />
```

Tabs and content are self-contained. Edit the `tabs` ref to customize.

### RightPanel

```vue
<RightPanel
  :visible="visible"
  @collapse="onPanelCollapse"
/>
```

Form fields use `v-model` for two-way binding. Edit the `sections` reactive array to add/remove fields.

| Event | Payload | Description |
|:---|:---|:---|
| `collapse` | – | Emitted when resize drag crosses the collapse threshold |

### StatusBar

```vue
<StatusBar />
```

Left and right items are defined in the component. Edit `leftItems` / `rightItems` arrays.

## Composable

### useResize

Reusable resize logic for panel edges.

```ts
import { useResize } from '../composables/useResize.js';

const { width, dragging, willCollapse, onMouseDown } = useResize({
  min: 180,              // Minimum visible width (px)
  max: 500,              // Maximum width (px)
  direction: 'right',    // 'left' | 'right' — which edge the handle is on
  collapseThreshold: 80, // Width below which collapse triggers on mouseup
  onCollapse: () => { … },
});
```

| Return | Type | Description |
|:---|:---|:---|
| `width` | `Ref<number>` | Current panel width |
| `dragging` | `Ref<boolean>` | `true` while the user is dragging |
| `willCollapse` | `Ref<boolean>` | `true` when drag crosses collapse threshold (live indicator) |
| `onMouseDown` | `(e: MouseEvent) => void` | Bind to the resize handle's `@mousedown` |

## Theme

All colors are defined as CSS custom properties in `src/styles/main.css`. To create a new theme, override these variables:

```css
:root {
  --sf-bg: #1e1e1e;
  --sf-bg-light: #252526;
  --sf-bg-lighter: #2d2d2d;
  --sf-bg-hover: #2a2d2e;
  --sf-border: #3c3c3c;
  --sf-text: #cccccc;
  --sf-text-muted: #858585;
  --sf-text-bright: #e0e0e0;
  --sf-accent: #007acc;
  --sf-accent-hover: #1a8ad4;
  --sf-active: #37373d;
  --sf-selection: #264f78;
  --sf-font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --sf-mono: 'Consolas', 'Courier New', monospace;
}
```
