# Studio Framework

A VSCode-like UI framework built with **Vue 3** + **TypeScript**. Provides a
fully functional IDE shell layout with panels, tabs, menus, and a
data-driven sub-section system — **all defined by a single JSON file**
([`src/layout/framework.layout.json`](src/layout/framework.layout.json)).

## Features

- **JSON-defined layout** - the entire UI (menu, docker, panels, workspace, status) comes from one file; swap it to build a new framework
- **Menu Bar** - multi-level dropdown menus with accelerators, hover-to-open behavior
- **Docker (Activity Bar)** - left app bar (each icon is an `app`) with badges, active indicators, single-click toggle
- **Docker Panel** - data-driven panel with sections, sub-sections, and 6 component types
- **Workspace** - tabbed tiles with drag-to-split, merge / evenly-space controls, and welcome screen
- **Right Panel** - right panel with data-driven sub-sections
- **Status Bar** - bottom bar with left/right-aligned items
- **Panel Toggle** - ☰ button in the menu bar hides/restores the left panel (Docker + panel); ◫ button in the top-right workspace tile toggles the right panel
- **Resizable Panels** - drag panel edges to resize (150–500px). Dragging past 100px collapses the panel with a gradient glow on three edges
- **Auto-hide on narrow workspace** - two triggers: (1) browser window resize: when the workspace drops below 640px the left panel hides first, then the right if still too narrow, and both restore when it grows back; (2) expanding a panel (drag wider) that pushes workspace below 640px auto-hides the other panel as a one-time event (user can re-open it without re-triggering). If one panel is already collapsed, the would-be workspace width is calculated without it
- **Sub-sections** - collapsible groups with variable/fixed height modes, drag-to-redistribute space, ⋯ visibility toggle
- **VSCode Dark Theme** - all colors via CSS custom properties for easy re-theming

## Layout

```
┌────────────────── Menu Bar ──────────────────────────────────┐
│ ☰  File  Edit  Selection  View  Help                        │
├──────┬───────────────┬──────────────────┬────────────────────┤
│      │ TitleBar  ⋯   │  tab tab tab  ◫  │ TitleBar  ⋯       │
│ Dock ├───────────────┤    Workspace     ├────────────────────┤
│  er  │ SSB  tab tab  │   (Tabbed)       │ Sub-sections       │
│      ├───────────────┤                  │                    │
│      │ Sub-sections  │                  │                    │
├──────┴───────────────┴──────────────────┴────────────────────┤
│ Ln 1, Col 1  Spaces: 2  UTF-8    TypeScript  🟢 main  ⚠ 0  │
└────────────── Status Bar ────────────────────────────────────┘
```

| UI Element | Location | Description |
|:---|:---|:---|
| ☰ (48px) | Menu bar, far left | `◫` / `◨` - Toggle left panel (Docker + panel). Icon reflects panel state |
| ◫ (28px) | Top-right tile, tab strip | `◫` / `◨` - Toggle right panel. Icon reflects panel state |

## Tech Stack

| Layer | Choice |
|:---|:---|
| UI | Vue 3 (Composition API + SFCs) |
| Language | TypeScript |
| Build | Vite |
| Styling | CSS custom properties (VSCode-dark theme) |
| Runtime deps | `vue` only (build tooling in `devDependencies`) |

## Project Structure

```
src/
├── main.ts                    # createApp entry point
├── Framework.vue                # Root layout, event wiring, state
├── vue-shims.d.ts             # TypeScript declaration for .vue imports
├── vite-env.d.ts              # Vite client types
├── layout/
│   ├── framework.layout.json  # ★ THE layout definition - edit this to reshape the framework
│   └── loadLayout.ts          # Parses + validates the JSON → typed LayoutDefinition
├── types/
│   ├── panel.ts               # PanelSection, PanelSubSection, PanelComponent types
│   └── layout.ts              # LayoutDefinition types (mirror the JSON schema)
├── components/
│   ├── MenuBar.vue            # Top bar - driven by layout.menu
│   ├── MenuDropdown.vue       # Recursive dropdown/submenu renderer (any depth)
│   ├── Docker.vue             # Left icon bar - driven by layout.docker
│   ├── Panel.vue              # Shared panel base (resize + header + SSB + sub-sections)
│   ├── DockerPanel.vue        # Thin wrapper: Panel + layout panel def (position left)
│   ├── RightPanel.vue         # Thin wrapper: Panel + layout panel def (position right)
│   ├── SubsectionBody.vue     # Sub-section layout manager (height, drag, scroll)
│   ├── SubSection.vue         # Sub-section title bar + component body
│   ├── PanelComponent.vue     # Renders 6 component types (text, input, button, tree, kv, list)
│   ├── Icon.vue               # Renders IconDef (unicode char or image)
│   ├── Workspace.vue          # Workspace root: multi-root split-tree renderer + DnD zones
│   ├── WorkspaceNode.vue      # Recursive split/tile node (sash between children)
│   ├── RootSash.vue           # Sash between root groups (multi-root workspace model)
│   ├── Tile.vue               # Tile: tab strip (drag/close/+ / merge / evenly / toggle) + content
│   ├── Sash.vue               # Pointer resize handle with min-size clamping
│   └── StatusBar.vue          # Bottom status bar - driven by layout.status
├── workspace/
│   └── tree.ts                # Pure split-tree model + ops (Node unit-tested)
├── composables/
│   ├── useResize.ts           # Resize composable for draggable panel edges
│   ├── useWorkspace.ts        # Reactive multi-root workspace state + DnD state
│   └── useClickOutside.ts     # Click-outside-to-close helper (menus, dropdowns)
└── styles/
    └── main.css               # Global theme + layout CSS
```

```
scripts/                      # Test suites + helpers (headless Chromium / Node)
├── check-ui.cjs              # UI smoke: menu, docker, sub-sections, panels (11 assertions)
├── check-dtt.cjs             # Drag-to-tile workspace interactions (23 assertions)
├── check-active.cjs          # Active sub-section + hover behaviors (22 assertions)
├── check-autohide.cjs        # Workspace-width auto-hide triggers (20 assertions)
├── check-tree.ts             # Node unit tests for workspace/tree.ts (44 assertions)
└── shot-zones.cjs            # Mid-drag DnD zone screenshot helper
```

## Define your own framework

The whole UI is defined by one file: [`src/layout/framework.layout.json`](src/layout/framework.layout.json).
Menu, docker apps + panels, right panel, workspace tabs, and status bar are
all data in that file. The Vue components are generic renderers.

```json
{
  "menu": [ { "id": "file", "label": "File", "items": [
    { "id": "new-file", "label": "New File", "accelerator": "Ctrl+N", "action": "new-file" }
  ] } ],
  "docker": [ {
    "id": "explorer", "displayName": "Explorer", "icon": "📁",
    "panel": { "title": "Files", "sections": [ {
      "id": "files", "label": "Files",
      "subSections": [ {
        "id": "project", "label": "Project", "height": "variable", "minHeight": 80,
        "components": [ { "type": "tree", "nodes": [ ... ] } ]
      } ]
    } ] }
  } ]
}
```

- Icons: unicode char (`"📁"`) or image (`{ "type": "image", "url": "/x.svg" }`)
- Invalid layout → clear error at startup: `framework.layout.json: <path>: <message>`
- Full schema: [doc/layout.md](doc/layout.md)
- Review copy: [`doc/framework.layout.json`](doc/framework.layout.json) — a static snapshot
  of the live layout for reference. The framework loads `src/layout/framework.layout.json`;
  edits to the doc copy do **not** affect the running UI.

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Opens at http://localhost:7492
```

## Testing

| Command | Suite | Assertions |
|:---|:---|:---|
| `npm run check` | Headless UI smoke: menu, docker switching, sub-section collapse/expand, panels | 11 |
| `npm run check:dtt` | Drag-to-tile workspace interactions (splits, moves, sash, proportional resize) | 23 |
| `npm run check:active` | Active sub-section + hover utility-button behaviors | 22 |
| `npm run check:autohide` | Workspace-width auto-hide (window-resize + panel-expansion triggers) | 20 |
| `npm run check:tree` | Node unit tests for `src/workspace/tree.ts` (pure, no browser) | 44 |
| `npm run typecheck` | `vue-tsc --noEmit` | – |

## Component Reference

### MenuBar

Top bar with dropdown menus and a left toggle button (48px wide, matching
Docker). The right-panel toggle is **not** in the menu bar - it lives in the
top-right workspace tile's tab strip (see Workspace).

```vue
<MenuBar
  :menus="layout.menu"
  :left-panel-visible="leftPanelVisible"
  @toggle-left-panel="…"
  @menu-action="onMenuAction"
/>
```

| Button | Position | Width | Icon (collapsed -> expanded) | Action |
|:---|:---|:---|:---|:---|
| ☰ | Far left | 48px | ◫ -> ◨ | Toggle Docker + DockerPanel |

| Prop | Type | Description |
|:---|:---|:---|
| `menus` | `MenuDef[]` | Menus from the layout JSON |
| `left-panel-visible` | `boolean` | Current left panel state (drives icon) |

| Event | Payload | Description |
|:---|:---|:---|
| `toggle-left-panel` | – | ☰ button clicked - toggle the left panel group |
| `menu-action` | `actionId: string` | Menu item clicked - the framework handles the id |

Menus are defined in the layout JSON (`"menu"`). Each item can carry an
`action` id, `accelerator`, `icon`, or be a `separator`. Accelerators are
display-only labels - the framework does not bind global keyboard shortcuts.

### Docker

```vue
<Docker
  :items="layout.docker"
  :active-app="activeApp"
  :panel-visible="dockerPanelVisible"
  @app-selected="onAppSelected"
/>
```

| Prop | Type | Description |
|:---|:---|:---|
| `items` | `DockerAppDef[]` | Docker apps from the layout JSON |
| `active-app` | `string` | Currently active app id |
| `panel-visible` | `boolean` | When `false`, hides active indicator |

| Event | Payload | Description |
|:---|:---|:---|
| `app-selected` | `appId: string` | Single click - switches panel, toggles if same app |

Single-click behavior (no double-click):

| Click | Panel state | Result |
|:---|:---|:---|
| Same app | Open | Close panel |
| Same app | Closed | Open panel |
| Different app | Any | Switch and open |

The Docker bar has no `visible` prop - `Framework.vue` hides it together with the
left panel via `v-show` on the wrapping `.sf-left-group`.

### Panel (base)

Shared panel component. Renders title bar, section selection bar (SSB), and
sub-section body. Both `DockerPanel` and `RightPanel` pass different sections
to this same component.

```vue
<Panel
  :title="title"
  :visible="panelVisible"
  position="left"
  :sections="sections"
  @collapse="onCollapse"
/>
```

| Prop | Type | Description |
|:---|:---|:---|
| `title` | `string` | Panel display name in title bar |
| `visible` | `boolean` | Show/hide the panel |
| `position` | `'left' \| 'right'` | Which side (drives border, handle, collapse-glow) |
| `sections` | `PanelSection[]` | Section tabs + sub-sections (see types/panel.ts) |

| Event | Payload | Description |
|:---|:---|:---|
| `collapse` | – | Emitted when horizontal panel-edge drag crosses collapse threshold |
| `select-section` | `sectionId: string` | Emitted when a section tab is clicked |
| `resize` | `width: number` | Emitted live during resize drag (drives the panel auto-hide logic) |

See [doc/Panel.md](doc/Panel.md) for SSB overflow, DTC glow, and resize details.
See [doc/sub-section.md](doc/sub-section.md) for sub-section height model, drag
redistribution, and component types.

### DockerPanel

Thin wrapper around `Panel` with `position="left"`, driven by the layout.

```vue
<DockerPanel
  :def="dockerDef"
  :visible="visible"
  @collapse="onPanelCollapse"
/>
```

| Prop | Type | Description |
|:---|:---|:---|
| `def` | `PanelDef` | Panel definition (`{ title, sections }`) from the layout |
| `visible` | `boolean` | Show/hide the panel (passed through to Panel) |

| Event | Payload | Description |
|:---|:---|:---|
| `collapse` | – | Emitted when resize drag crosses the collapse threshold |
| `resize` | `width: number` | Emitted live during resize drag (re-emitted from Panel) |

The six panel definitions live in `src/layout/framework.layout.json` under
`"docker"`. `Framework.vue` resolves the active app → `def` and passes it down.

### RightPanel

Thin wrapper around `Panel` with `position="right"`, driven by the layout.

```vue
<RightPanel
  :def="layout.right"
  :visible="visible"
  @collapse="onPanelCollapse"
/>
```

| Prop | Type | Description |
|:---|:---|:---|
| `def` | `PanelDef` | Panel definition (`{ title, sections }`) from the layout |
| `visible` | `boolean` | Show/hide the panel (passed through to Panel) |

| Event | Payload | Description |
|:---|:---|:---|
| `collapse` | – | Emitted when resize drag crosses the collapse threshold |
| `resize` | `width: number` | Emitted live during resize drag (re-emitted from Panel) |

The right panel definition lives in `src/layout/framework.layout.json` under
`"right"` (set to `null` or omit the key to disable the panel).

### Workspace (multi-tab, drag-to-tile)

```vue
<Workspace
  :def="layout.workspace"
  :right-panel-visible="rightPanelVisible"
  @toggle-right-panel="…"
/>
```

| Prop | Type | Description |
|:---|:---|:---|
| `def` | `WorkspaceDef` | Tabs + `minTileWidth`/`minTileHeight` from the layout JSON |
| `right-panel-visible` | `boolean` | Right panel state - drives the ◫ toggle icon |

| Event | Payload | Description |
|:---|:---|:---|
| `toggle-right-panel` | – | ◫ button clicked in the top-right tile's tab strip |

The split tree itself is runtime state (`src/workspace/tree.ts`). Drag a tab
onto a tile's edge to split (the dragged tab takes half the tile), onto the
strip to reorder/insert, or into the content area to move. Sizes stay
proportional while the workspace resizes and only break at min sizes. The
top-right tile's tab strip also hosts □ "merge all tiles" and ⇔ "evenly
space" buttons (shown when there are multiple root groups). See
[`doc/workspace.md`](doc/workspace.md) for the model and zones.

### StatusBar

```vue
<StatusBar :left="layout.status.left" :right="layout.status.right" />
```

Items come from the layout JSON. Each item may carry an optional `icon`
(rendered before the label).

## Composable

### useResize

Reusable resize logic for panel edges.

```ts
import { useResize } from '../composables/useResize';

const { width, dragging, willCollapse, onMouseDown } = useResize({
  min: 150,              // Minimum visible width (px)
  max: 500,              // Maximum width (px)
  direction: 'right',    // 'left' | 'right' - which edge the handle is on
  collapseThreshold: 100,// Width below which collapse triggers on mouseup
  onCollapse: () => { … },
  onResize: (w) => { … }, // Optional: live width updates during drag
});
```

| Option | Type | Default | Description |
|:---|:---|:---|:---|
| `min` | `number` | `180` | Minimum visible width (px) |
| `max` | `number` | `500` | Maximum width (px) |
| `direction` | `'left' \| 'right'` | `'right'` | Which edge the handle is on |
| `collapseThreshold` | `number` | `min * 0.45` | Width below which collapse triggers on mouseup |
| `onCollapse` | `() => void` | – | Called on mouseup when width is below the threshold |
| `onResize` | `(width: number) => void` | – | Called live during drag (Panel uses it to emit `resize`) |

| Return | Type | Description |
|:---|:---|:---|
| `width` | `Ref<number>` | Current panel width |
| `dragging` | `Ref<boolean>` | `true` while the user is dragging |
| `willCollapse` | `Ref<boolean>` | `true` when drag crosses collapse threshold (activates glow) |
| `onMouseDown` | `(e: MouseEvent) => void` | Bind to the resize handle's `@mousedown` |

`Panel.vue` overrides the defaults with `min: 150`, `max: 500` and
`collapseThreshold: 100` (2/3 of the minimum).

## Theme

All colors are defined as CSS custom properties in `src/styles/main.css`. To
create a new theme, override these variables:

```css
:root {
  --sf-bg: #1e1e1e;
  --sf-bg-dark: #181818;
  --sf-bg-light: #252526;
  --sf-bg-lighter: #2d2d2d;
  --sf-bg-hover: #2a2d2e;
  --sf-border: #3c3c3c;
  --sf-text: #cccccc;
  --sf-text-muted: #858585;
  --sf-text-bright: #e0e0e0;
  --sf-accent: #007acc;
  --sf-accent-hover: #1a8ad4;
  --sf-accent-soft: rgba(0, 122, 204, 0.16);
  --sf-accent-dim: rgba(0, 122, 204, 0.65);
  --sf-radius: 6px;
  --sf-gap: 8px;
  --sf-sash-size: 1px;
  --sf-sash-hit: 5px;
  --sf-edge-glow: 6px;
  --sf-active: #37373d;
  --sf-selection: #264f78;
  --sf-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  --sf-text-on-accent: #fff;
  --sf-close-hover: rgba(255, 255, 255, 0.15);
  --sf-font: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
  --sf-mono: 'Consolas', 'Fira Code', 'JetBrains Mono', monospace;
}
```

## Documentation

- [doc/layout.md](doc/layout.md) - JSON layout schema: define the whole framework from one file
- [doc/framework.layout.json](doc/framework.layout.json) - review copy of the current layout definition
- [doc/Panel.md](doc/Panel.md) - Panel component: props, SSB, DTC, resize
- [doc/sub-section.md](doc/sub-section.md) - Sub-sections: height model, drag, components
- [doc/workspace.md](doc/workspace.md) - Multi-tab workspace: multi-root split-tree model, DnD zones, ops API
