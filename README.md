# Studio Framework

A VSCode-like UI framework built with **Vue 3** + **TypeScript**. Provides a
fully functional IDE shell layout with panels, tabs, menus, and a
data-driven sub-section system — **all defined by a single JSON file**
([`src/layout/app.layout.json`](src/layout/app.layout.json)).

## Features

- **JSON-defined layout** - the entire UI (menu, docker, panels, workspace, status) comes from one file; swap it to build a new app
- **Menu Bar** - multi-level dropdown menus with accelerators, hover-to-open behavior
- **Docker (Activity Bar)** - left icon bar with badges, active indicators, single-click toggle
- **Docker Panel** - data-driven panel with sections, sub-sections, and 6 component types
- **Workspace** - tabbed editor area with welcome screen
- **Right Panel** - right panel with data-driven sub-sections
- **Status Bar** - bottom bar with left/right-aligned items
- **Panel Toggle** - ☰ button to hide/restore left panel, ◫ button for right panel
- **Resizable Panels** - drag panel edges to resize (150–500px). Dragging past 100px collapses the panel with a gradient glow on three edges
- **Sub-sections** - collapsible groups with variable/fixed height modes, drag-to-redistribute space, ⋯ visibility toggle
- **VSCode Dark Theme** - all colors via CSS custom properties for easy re-theming

## Layout

```
┌────────────────── Menu Bar ──────────────────────────────────┐
│ ☰  File  Edit  Selection  View  Help               ◫        │
├──────┬───────────────┬──────────────────┬────────────────────┤
│      │ TitleBar  ⋯   │                  │ TitleBar  ⋯       │
│ Dock ├───────────────┤    Workspace     ├────────────────────┤
│  er  │ SSB  tab tab  │   (Tabbed)       │ Sub-sections       │
│      ├───────────────┤                  │                    │
│      │ Sub-sections  │                  │                    │
├──────┴───────────────┴──────────────────┴────────────────────┤
│ Ln 1, Col 1  Spaces: 2  UTF-8    TypeScript  🟢 main  ⚠ 0  │
└────────────── Status Bar ────────────────────────────────────┘
```

| UI Element | Description |
|:---|:---|
| ☰ (48px) | `◫` / `◨` - Toggle left panel. Icon reflects panel state |
| ◫ (48px) | `◫` / `◧` - Toggle right panel. Icon reflects panel state |

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
├── vue-shims.d.ts             # TypeScript declaration for .vue imports
├── vite-env.d.ts              # Vite client types
├── layout/
│   ├── app.layout.json        # ★ THE layout definition - edit this to reshape the app
│   └── loadLayout.ts          # Parses + validates the JSON → typed LayoutDefinition
├── types/
│   ├── panel.ts               # PanelSection, PanelSubSection, PanelComponent types
│   └── layout.ts              # LayoutDefinition types (mirror the JSON schema)
├── components/
│   ├── MenuBar.vue            # Top bar - driven by layout.menu
│   ├── Docker.vue             # Left icon bar - driven by layout.docker
│   ├── Panel.vue              # Shared panel base (resize + header + SSB + sub-sections)
│   ├── DockerPanel.vue        # Thin wrapper: Panel + layout panel def (position left)
│   ├── RightPanel.vue         # Thin wrapper: Panel + layout panel def (position right)
│   ├── SubsectionBody.vue     # Sub-section layout manager (height, drag, scroll)
│   ├── SubSection.vue         # Sub-section title bar + component body
│   ├── PanelComponent.vue     # Renders 6 component types (text, input, button, tree, kv, list)
│   ├── Icon.vue               # Renders IconDef (unicode char or image)
│   ├── Workspace.vue          # Centered tabbed editor - driven by layout.workspace
│   └── StatusBar.vue          # Bottom status bar - driven by layout.status
├── composables/
│   └── useResize.ts           # Resize composable for draggable panel edges
└── styles/
    └── main.css               # Global theme + layout CSS
```

## Define your own app

The whole UI is defined by one file: [`src/layout/app.layout.json`](src/layout/app.layout.json).
Menu, docker icons + panels, right panel, workspace tabs, and status bar are
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
- Invalid layout → clear error at startup: `app.layout.json: <path>: <message>`
- Full schema: [doc/layout.md](doc/layout.md)
- Review copy: [`doc/app.layout.json`](doc/app.layout.json) — a static snapshot
  of the live layout for reference. The app loads `src/layout/app.layout.json`;
  edits to the doc copy do **not** affect the running UI.

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

Top bar with dropdown menus, a left toggle button (48px wide, matching
Docker), and a right panel toggle.

```vue
<MenuBar
  :menus="layout.menu"
  :left-panel-visible="leftPanelVisible"
  :right-panel-visible="rightPanelVisible"
  @toggle-left-panel="…"
  @toggle-right-panel="…"
  @menu-action="onMenuAction"
/>
```

| Button | Position | Width | Icon (collapsed -> expanded) | Action |
|:---|:---|:---|:---|:---|
| ☰ | Far left | 48px | ◫ -> ◨ | Toggle Docker + DockerPanel |
| ◫ | Far right | 48px | ◫ -> ◧ | Toggle Right Panel |

| Prop | Type | Description |
|:---|:---|:---|
| `menus` | `MenuDef[]` | Menus from the layout JSON |
| `left-panel-visible` | `boolean` | Current left panel state (drives icon) |
| `right-panel-visible` | `boolean` | Current right panel state (drives icon) |

| Event | Payload | Description |
|:---|:---|:---|
| `menu-action` | `actionId: string` | Menu item clicked - the host app handles the id |

Menus are defined in the layout JSON (`"menu"`). Each item can carry an
`action` id, `accelerator`, `icon`, or be a `separator`.

### Docker

```vue
<Docker
  :items="layout.docker"
  :active-tag="activeTag"
  :visible="leftPanelVisible"
  :panel-visible="dockerPanelVisible"
  @tag-selected="onTagSelected"
/>
```

| Prop | Type | Description |
|:---|:---|:---|
| `items` | `DockerItemDef[]` | Docker tags from the layout JSON |
| `active-tag` | `string` | Currently active tag id |
| `visible` | `boolean` | Show/hide the entire Docker bar |
| `panel-visible` | `boolean` | When `false`, hides active indicator |

| Event | Payload | Description |
|:---|:---|:---|
| `tag-selected` | `tagId: string` | Single click - switches panel, toggles if same icon |

Single-click behavior (no double-click):

| Click | Panel state | Result |
|:---|:---|:---|
| Same icon | Open | Close panel |
| Same icon | Closed | Open panel |
| Different icon | Any | Switch and open |

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

The six panel definitions live in `src/layout/app.layout.json` under
`"docker"`. `App.vue` resolves the active tag → `def` and passes it down.

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

The right panel definition lives in `src/layout/app.layout.json` under
`"right"` (set to `null` to disable the panel).

### Workspace

```vue
<Workspace :tabs="layout.workspace.tabs" />
```

Tabs come from the layout JSON; close/new operations are handled internally
on a local copy.

### StatusBar

```vue
<StatusBar :left="layout.status.left" :right="layout.status.right" />
```

Items come from the layout JSON.

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
});
```

| Return | Type | Description |
|:---|:---|:---|
| `width` | `Ref<number>` | Current panel width |
| `dragging` | `Ref<boolean>` | `true` while the user is dragging |
| `willCollapse` | `Ref<boolean>` | `true` when drag crosses collapse threshold (activates glow) |
| `onMouseDown` | `(e: MouseEvent) => void` | Bind to the resize handle's `@mousedown` |

## Theme

All colors are defined as CSS custom properties in `src/styles/main.css`. To
create a new theme, override these variables:

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
  --sf-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  --sf-text-on-accent: #fff;
  --sf-close-hover: rgba(255, 255, 255, 0.15);
  --sf-font: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
  --sf-mono: 'Consolas', 'Fira Code', 'JetBrains Mono', monospace;
}
```

## Documentation

- [doc/layout.md](doc/layout.md) - JSON layout schema: define the whole app from one file
- [doc/app.layout.json](doc/app.layout.json) - review copy of the current layout definition
- [doc/Panel.md](doc/Panel.md) - Panel component: props, SSB, DTC, resize
- [doc/sub-section.md](doc/sub-section.md) - Sub-sections: height model, drag, components
