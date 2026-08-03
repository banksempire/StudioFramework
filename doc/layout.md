# Layout Definition (single JSON)

The entire UI is defined by one JSON file:
`src/layout/app.layout.json`.

The framework components are dumb renderers — they consume the typed layout
and build the UI. To create a new app: **keep the TS framework, swap the JSON
file**.

```
src/layout/app.layout.json  ← edit this to reshape the app
doc/app.layout.json        ← static review copy (does NOT affect the app)
src/layout/loadLayout.ts    ← parses + validates the JSON → typed LayoutDefinition
src/types/layout.ts         ← types mirroring the JSON schema
```

The loader validates the file at startup and throws a descriptive error
(`app.layout.json: <path>: <message>`) on any mismatch — wrong types, unknown
component types, missing ids, etc.

## Schema

```
LayoutDefinition
├── app.title                     string            app name (used in About)
├── menu[]                        MenuNodeDef        top bar menus - same class as submenus
│   ├── id                        string (optional)
│   ├── label                     string (separators omit it)
│   ├── icon                      IconDef (optional)
│   ├── accelerator               string (optional) e.g. "Ctrl+S"
│   ├── action                    string (optional) leaf: action id handled by host app
│   ├── items                     MenuNodeDef[] (optional) children - recursive, any depth
│   └── separator                 true              renders a divider (at any level)
├── docker[]                      DockerItemDef     activity bar icons
│   ├── id                        string            tag id (also the active key)
│   ├── displayName               string            tooltip
│   ├── icon                      IconDef
│   ├── badge                     string (optional)
│   └── panel                     PanelDef          panel shown when active
├── right                         PanelDef | null   right panel (null = hidden)
├── workspace                  WorkspaceDef
│   ├── tabs[]                 WorkspaceTabDef     initial workspace tabs
│   │   ├── id                 string
│   │   ├── label              string
│   │   ├── icon               IconDef (optional)
│   │   ├── closeable          boolean (optional, default true)
│   │   └── content            string (optional)  content hint, e.g. "welcome"
│   ├── minTileWidth           number (optional, default 160)
│   └── minTileHeight          number (optional, default 100)
└── status
    ├── left[]                    StatusItemDef     left-aligned items
    └── right[]                   StatusItemDef     right-aligned items
```

### IconDef

Icons accept two forms everywhere (menu, docker, tree nodes, list items,
utilities):

```json
"icon": "📁"                                    // unicode character
"icon": { "type": "image", "url": "/icons/explorer.svg" }  // image file
```

### PanelDef

```json
{
  "title": "Files",
  "sections": [ { "id": "files", "label": "Files", "subSections": [ ... ] } ]
}
```

- Multiple sections → section tab bar appears (see Panel.md).
- `right: null` hides the right panel entirely.

### PanelSubSection

```json
{
  "id": "project",
  "label": "Project",
  "height": "variable",            // "fixed" (default) | "variable"
  "minHeight": 80,                 // required for "variable"
  "utilities": [
    { "id": "new-file", "icon": "📄", "tooltip": "New File" }
  ],
  "components": [ ... ]
}
```

| `height` | Meaning |
|:---|:---|
| `fixed` (default) | Auto-sizes to content height (DOM-measured, never scrolls) |
| `variable` | Managed by the layout engine; draggable, clamped to `minHeight` |

### Components

Six types (see `src/types/panel.ts` and `PanelComponent.vue`):

```json
{ "type": "text", "text": "3 results", "muted": true }
{ "type": "input", "value": "", "placeholder": "Search..." }
{ "type": "button", "label": "Run", "icon": "▶" }
{ "type": "tree", "nodes": [ { "id": "src", "label": "src", "icon": "📁",
    "children": [ { "id": "main", "label": "main.ts", "icon": "📄" } ] } ] }
{ "type": "keyValueList", "items": [ { "key": "dev", "value": "vite" } ] }
{ "type": "list", "items": [ { "id": "1", "label": "main.ts", "icon": "📄", "badge": "3" } ] }
```

Tree nodes: `{ id, label, icon?, badge?, children? }` — children are recursive.

## Menu actions

Menu leaves carry an `action` id (nodes with `items` act as grouping
parents and open on hover). The host app (`App.vue`) decides what each id
does:

```ts
function onMenuAction(actionId: string) {
  switch (actionId) {
    case 'toggle-left-panel': toggleLeftPanel(); break;
    case 'about': alert(...); break;
    default: console.log('menu action:', actionId);  // unknown ids are logged
  }
}
```

Known ids in the demo layout: `new-file`, `open-folder`, `save`, `save-as`,
`exit`, `undo`, `redo`, `cut`, `copy`, `paste`, `select-all`,
`expand-selection`, `toggle-left-panel`, `toggle-right-panel`, `zoom-in`,
`zoom-out`, `about`, `docs`.

## Review copy

A snapshot of the live layout is kept at `doc/app.layout.json` for easy
review. It is **not** loaded by the app — the loader reads
`src/layout/app.layout.json`. To keep the two in sync after editing the live
file, re-copy it:

```bash
cp src/layout/app.layout.json doc/app.layout.json
```

Alternatively, point the loader at the doc copy to make it the single source
of truth (change the import in `src/layout/loadLayout.ts`).

## Multi-level menus

**One class, every level.** A menu, a submenu parent, and a leaf item are all
the same `MenuNodeDef` — children live in `items`, recursively, with
unlimited depth. The top-level `"menu"` array is just the root level of the
same structure:

```json
{
  "id": "preferences", "label": "Preferences",
  "items": [
    { "id": "settings", "label": "Settings", "accelerator": "Ctrl+,", "action": "settings" },
    {
      "id": "theme", "label": "Color Theme",
      "items": [
        { "id": "theme-dark", "label": "Dark (VSCode)", "action": "theme-dark" },
        { "id": "theme-light", "label": "Light", "action": "theme-light" }
      ]
    }
  ]
}
```

- Sub-menus open on **hover** (no click needed), stay open while the pointer
  is on the node or its sub-menu, and close when hovering a sibling.
- A `▶` caret is shown automatically on nodes that have `items`.
- Clicking a leaf emits `menu-action` and closes all levels.
- Separators (`{ "separator": true }`) work at any level.
- Demo layout uses up to 3 levels (File → Preferences → Color Theme).

## Loading

```ts
import { layout } from './layout/loadLayout';   // validated once at startup
```

`layout` is a frozen-in-time `LayoutDefinition` — components receive slices
of it as props (`:menus`, `:items`, `:def`, `:tabs`, `:left`/`:right`), so
they stay generic and reusable.

## Adding a new docker panel

1. Add an entry to `"docker": [ ... ]` with `id`, `displayName`, `icon`,
   `panel` (title + sections + subSections + components).
2. Done — the Docker bar renders it, clicking it switches and opens the panel.

## Customizing

| To change | Edit |
|:---|:---|
| Menus / items / accelerators | `"menu"` |
| Docker icons, badges, panels | `"docker"` |
| Right panel content | `"right"` |
| Workspace tabs | `"workspace"` (tabs, `minTileWidth`, `minTileHeight`; the split tree is runtime state - see `doc/workspace.md`) |
| Status bar items | `"status"` |
| Panel width / resize limits | `src/composables/useResize.ts` + `Panel.vue` constants |
| Panel auto-hide threshold | `MIN_WORKSPACE_WIDTH` constant in `src/App.vue` (default 200px - based on workspace width, not window width) |
| Colors | CSS custom properties in `src/styles/main.css` `:root` |
