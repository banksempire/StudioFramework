# Studio Framework

A VSCode-like UI framework built with **Vue 3** + **TypeScript**. Provides a
fully functional IDE shell layout with panels, tabs, menus, and a
data-driven sub-section system - all styled with a VSCode-dark theme.

## Features

- **Menu Bar** - multi-level dropdown menus with hover-to-open behavior
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
├── types/
│   └── panel.ts               # PanelSection, PanelSubSection, PanelComponent types
├── components/
│   ├── MenuBar.vue            # Top bar with dropdown menus + action buttons
│   ├── Docker.vue             # Left icon bar (Activity Bar)
│   ├── Panel.vue              # Shared panel base (resize + header + SSB + sub-sections)
│   ├── DockerPanel.vue        # Left panel: 6 panel definitions with sub-sections
│   ├── RightPanel.vue         # Right panel: Properties with sub-sections
│   ├── SubsectionBody.vue     # Sub-section layout manager (height, drag, scroll)
│   ├── SubSection.vue         # Sub-section title bar + component body
│   ├── PanelComponent.vue     # Renders 6 component types (text, input, button, tree, kv, list)
│   ├── Workspace.vue          # Centered tabbed editor
│   └── StatusBar.vue          # Bottom status bar
├── composables/
│   └── useResize.ts           # Resize composable for draggable panel edges
└── styles/
    └── main.css               # Global theme + layout CSS
```

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
  :left-panel-visible="leftPanelVisible"
  :right-panel-visible="rightPanelVisible"
  @toggle-left-panel="…"
  @toggle-right-panel="…"
/>
```

| Button | Position | Width | Icon (collapsed -> expanded) | Action |
|:---|:---|:---|:---|:---|
| ☰ | Far left | 48px | ◫ -> ◨ | Toggle Docker + DockerPanel |
| ◫ | Far right | 48px | ◫ -> ◧ | Toggle Right Panel |

| Prop | Type | Description |
|:---|:---|:---|
| `left-panel-visible` | `boolean` | Current left panel state (drives icon) |
| `right-panel-visible` | `boolean` | Current right panel state (drives icon) |

Menus are defined in the `menus` array inside `MenuBar.vue`. Each menu has a
`label` and `items` array with `{ label, action?, separator? }`.

### Docker

```vue
<Docker
  :active-tag="activeTag"
  :visible="leftPanelVisible"
  :panel-visible="dockerPanelVisible"
  @tag-selected="onTagSelected"
/>
```

| Prop | Type | Description |
|:---|:---|:---|
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

Thin wrapper around `Panel` with `position="left"`. Title and sections derived
from `activeTag` via a `panels` record.

```vue
<DockerPanel
  :active-tag="activeTag"
  :visible="visible"
  @collapse="onPanelCollapse"
/>
```

| Prop | Type | Description |
|:---|:---|:---|
| `active-tag` | `string` | Which content panel to display (explorer, search, etc.) |
| `visible` | `boolean` | Show/hide the panel (passed through to Panel) |

| Event | Payload | Description |
|:---|:---|:---|
| `collapse` | – | Emitted when resize drag crosses the collapse threshold |

Six panel definitions: `explorer`, `search`, `source-control`, `debug`,
`extensions`, `settings`. Each has sections with sub-sections and components.

### RightPanel

Thin wrapper around `Panel` with `position="right"` and title `"Properties"`.

```vue
<RightPanel
  :visible="visible"
  @collapse="onPanelCollapse"
/>
```

| Prop | Type | Description |
|:---|:---|:---|
| `visible` | `boolean` | Show/hide the panel (passed through to Panel) |

| Event | Payload | Description |
|:---|:---|:---|
| `collapse` | – | Emitted when resize drag crosses the collapse threshold |

One section (`Properties`) with three sub-sections: Element, Style, Events.

### Workspace

```vue
<Workspace />
```

Tabs and content are self-contained. Edit the `tabs` ref to customize.

### StatusBar

```vue
<StatusBar />
```

Left and right items are defined in the component. Edit `leftItems` /
`rightItems` arrays.

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

- [doc/Panel.md](doc/Panel.md) - Panel component: props, SSB, DTC, resize
- [doc/sub-section.md](doc/sub-section.md) - Sub-sections: height model, drag, components
