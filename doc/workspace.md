# Multi-tab workspace & drag-to-tile

## Terminology

- **Workspace**: the box in the centre of the UI, between the two panels.
- **Root group**: a top-level container in the workspace. The workspace holds
  *N* root groups arranged in a single direction (`rootDir`: `row` = side by
  side, `column` = stacked); each root group has a `ratio` (0..1, all sum to
  1) and contains one independent split tree.
- **Tile**: a box within a root group. A split node divides its area into two
  child tiles.
- **Tab**: a tile holds an ordered list of tabs; one is active at a time.

Workspace and right panel share **one rounded box**:
`(tile1|tile2|right panel)` — tiles and the right panel are separated by a
simple 1px border (`--sf-sash-size`) with a 5px drag sensing area
(`--sf-sash-hit`), no gaps. The left panel stays a separate box with an 8px gap.

The workspace is a set of **binary split trees** (one per root group), like
VSCode's editor groups. Users can drag tabs between tiles, split tiles by
dropping on their edges, reorder tabs within a tile, resize tiles with sashes,
and close tabs — all with the trees staying consistent (no duplicated or
orphaned tabs, no empty tiles except a root group's root tile).

## Model

```
RootGroup: { id, node: WorkspaceNode, ratio: 0..1 }
state:     { roots: RootGroup[], rootDir: 'row' | 'column' | null }

WorkspaceNode = SplitNode | TileNode

SplitNode: { kind: 'split', id, dir: 'row' | 'column', ratio: 0..1,
             children: [WorkspaceNode, WorkspaceNode] }
TileNode:  { kind: 'tile',  id, tabs: string[], activeId: string }
```

- `dir: 'row'` = side-by-side (left | right); `dir: 'column'` = stacked (top | bottom).
- `ratio` is the fraction of the container given to `children[0]`; the second
  child gets `1 - ratio`. Root groups use the same fraction semantics, with
  all root ratios summing to 1.
- `rootDir` is set by the **first root-level split** and stays fixed until
  "merge all" resets it (see Tab operations).
- A `TileNode` is a tile: an ordered list of tab ids + the active tab.
- Pure tree operations live in `src/workspace/tree.ts` (no Vue imports —
  Node unit-tested via `npm run check:tree`). The reactive wrapper is
  `src/composables/useWorkspace.ts`.

### Splitting rules

- A split on a **root tile** (a root group whose node *is* a tile) in the
  **root direction** creates a **new root group** next to it, taking half of
  the target root's ratio (or replacing it if the target became empty).
- All other splits — the orthogonal direction on a root tile, or any split
  on a nested tile — go **inside** the root's own tree via `treeSplitTile`.

## Sizing rules

- **Min sizes**: every tile has `minTileWidth` / `minTileHeight` from the
  layout JSON (`"workspace": { "minTileWidth": 160, "minTileHeight": 100 }`).
- **Proportional resizing**: ratios are baked into the flex `flex-basis`
  (`flex: 0 1 <ratio>%`), so when the workspace grows or shrinks the tiles
  keep their proportions. `min-width` / `min-height` act as the floor — the
  proportion is *only* broken when a tile reaches its min size, and it
  springs back when space returns.
- **Drag-to-tile takes half**: a split created by dropping a tab always starts
  at `ratio = 0.5` — the dragged tab takes half of the target tile (for root
  groups: the new root takes half the target root's ratio).
- **Sash drag**: dragging the sash between two tiles (`Sash.vue`) or between
  two root groups (`RootSash.vue`) sets the ratio in pixels, clamped so
  neither side can go below its subtree's min size. Subtree mins compose:
  a row split sums children, a column split takes the max (and vice versa
  for heights). If the container is smaller than both mins combined, the sash
  falls back to an even 0.5 split. `treeSetRatio` / `setRootRatio`
  additionally clamp to 0.05..0.95.
- **Empty root groups**: moving/closing the last tab of a non-first root
  group removes the group and redistributes its ratio proportionally to the
  remaining roots.

## Drag & drop

While dragging a tab, the whole workspace becomes the drop surface
(`@dragover` / `@drop` on the workspace root; the visual layer is
`pointer-events: none`). Zones per tile:

| Zone | Where | Result |
|:-----|:------|:-------|
| `center` — over the tab strip | the strip is always the reorder zone | insert at the indicator position (or append) |
| `center` — over the content area | outside edge bands | move to the tile (append) |
| `left` / `right` | edge band of the tile | split `row`, new tile on that side, dragged tab takes 50% |
| `top` / `bottom` | edge band of the content area | split `column`, new tile on that side, dragged tab takes 50% |

Edge bands: horizontal (left/right) `clamp(25% of the side, 36px, 72px)`;
vertical (top/bottom) `clamp(25% of the side, 28px, 56px)`.

### Landing preview

While a tab is being dragged, the hovered drop zone is shown by one of three
visuals (all `pointer-events: none`, sharing the `--sf-edge-glow`
accent-fading-inward gradient):

- **half-tile preview** (split zones) — the exact half of the tile the tab
  will take, with per-corner radius matching the shape the split will
  actually produce;
- **whole-tile glow** (center zone) — highlights the move target;
- **reorder indicator** (tab strip) — a 2px accent bar at the insertion
  point.

`scripts/shot-zones.cjs` captures a mid-drag screenshot
(`node scripts/shot-zones.cjs` → `/tmp/sf-zones.png`).

The dragged tab is **moved**, not copied: dropping on another tile (center or
edge) removes it from its source tile. If the source tile becomes empty it is
removed from the tree and the surrounding split merges away — unless it is
the root tile of the first root group, which stays as an empty tile
("No tab open").

## Tab operations

- **Click** a tab → activate it in its tile (each tile has its own active tab).
- **✕** → close; the tab next to the closed one becomes active. Closing the
  last tab of a non-root tile removes the tile and merges the split; closing
  the last tab of a non-first root group removes the group.
- **Middle-click** a tab → close it (same rules as ✕; non-closeable tabs are
  ignored).
- **+** → new "Untitled" tab in that tile (id `untitled-N`) — unless the
  host app overrode it via `setNewTabHandler` (see Ops API), in which case
  the app's handler decides what "+" creates.
- **Drag** a tab → move / split / reorder as above. Dropping it back where it
  came from is a no-op.
- **Top-right tile buttons**: the tile at the workspace's top-right corner
  (rightmost root in row mode, topmost root in column mode) hosts:
  - ◫ / ◨ — toggle the right panel (`toggle-right-panel` event on `Workspace`);
  - □ — "merge all tiles": collapse every root group into one tile
    (`ops.mergeAll()`, keeps the focused tab active);
  - ⇔ — "evenly space": equalize all root group ratios (`ops.evenlySpace()`),
    shown when there is more than one root group.

## Ops API (for host frameworks)

`useWorkspace(def)` returns a reactive `WorkspaceApi`, provided to the tree
via the `kWorkspace` injection key:

| Member | Type | Description |
|:---|:---|:---|
| `roots` | `RootGroup[]` | Current root groups (reactive) |
| `rootDir` | `'row' \| 'column' \| null` | Root arrangement direction |
| `focusedTileId` | `string` | Tile with the bright active-tab indicator |
| `topRightTileId` | `string` | Tile hosting the tab-strip buttons |
| `tabDefs` | `Record<string, WorkspaceTabDef>` | Tab metadata from the layout |
| `minTileWidth` / `minTileHeight` | `number` | Min sizes from the layout |
| `ops.activateTab(tileId, tabId)` | | Activate a tab and focus its tile |
| `ops.closeTab(tabId)` | | Close a tab anywhere in the workspace |
| `ops.newTab(tileId)` | | Append an "Untitled" tab (or run the app's `setNewTabHandler` override) |
| `ops.splitTile(tileId, dir, side, tabId)` | | DnD split (root-group or nested) |
| `ops.moveTab(tabId, targetTileId, index)` | | Move a tab across/within roots |
| `ops.setRatio(splitId, ratio)` | | Set a tree split's ratio (clamped) |
| `ops.setRootRatio(index, ratio)` | | Set the boundary after root `index` |
| `ops.evenlySpace()` / `ops.mergeAll()` | | Root-group operations |
| `ops.focusTile(tileId)` | | Focus a tile |
| `dnd` | `DndState` | Drag state: `dragging`, `tabId`, `sourceTileId`, `fromIndex`, `tileId`, `zone`, `index`, `preview`, `glow`, `indicator` |
| `registerTileEl(id, el)` / `tileEls` | | Tile element registry for hit testing |
| `newTabTitle` | `string` | Tooltip of the tile-strip "+" button (default "New file") |
| `setNewTabHandler(handler, title?)` | | Override the tile-strip "+": the handler (tile id) runs instead of creating an "Untitled" tab; `null` restores the default |
| `findTileGlobal(tileId)` | | Find a tile across all roots |

`Tile.vue` also consumes `kRightPanelToggle` (`{ visible, toggle }`), provided
by `Workspace.vue`, for the ◫ right-panel button.

## Files

| File | Role |
|:-----|:-----|
| `src/workspace/tree.ts` | pure split-tree types + operations (Node unit-tested) |
| `src/composables/useWorkspace.ts` | reactive multi-root state, ops, DnD state, tile element registry |
| `src/components/Workspace.vue` | root: root-group renderer + drop-zone hit testing + visual layer |
| `src/components/WorkspaceNode.vue` | recursive: split → sash + children; tile → `Tile` |
| `src/components/RootSash.vue` | sash between root groups (ratio clamped by subtree mins) |
| `src/components/Tile.vue` | tab strip (drag, close, +, merge/evenly/toggle buttons) + content area |
| `src/components/Sash.vue` | pointer-based resize handle with pixel clamping |

## Tests

- Tree ops (pure, Node): `npm run check:tree` — 44 assertions: splits
  (same/cross tile, empty-source merging, single-tab target), moves and
  reorders (with index clamping), closes (active-tab follow, root stays
  empty, nested merge), min-size composition, ratio clamping, new/insert
  tabs, lookups and visual-order traversal.
- Browser (Playwright): `npm run check:dtt` — 23 assertions: landing preview
  + drag cancel, split half-size (right/bottom/top), cross-tile move and
  split, close-merge, sash resize, proportional workspace resize, min-width
  floor, strip reorder, empty-source merge, no console errors.
