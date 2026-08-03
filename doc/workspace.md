# Multi-tab workspace & drag-to-tile

## Terminology

- **Workspace**: the box in the centre of the UI (the editor area).
- **Tile**: a box within the workspace. The workspace is a recursive tree
  of tiles - a split node divides its area into two child tiles.
- **Tab**: a tile holds an ordered list of tabs; one is active at a time.

The workspace is a **binary split tree** of tiles, like VSCode's editor
groups. Users can drag tabs between tiles, split tiles by dropping on their
edges, reorder tabs within a tile, resize tiles with sashes, and close tabs —
all with the tree staying consistent (no duplicated or orphaned tabs, no empty
tiles except the root).

## Model

```
WorkspaceNode = SplitNode | TileNode

SplitNode: { kind: 'split', id, dir: 'row' | 'column', ratio: 0..1,
             children: [WorkspaceNode, WorkspaceNode] }
TileNode:  { kind: 'tile',  id, tabs: string[], activeId: string }
```

- `dir: 'row'` = side-by-side (left | right); `dir: 'column'` = stacked (top | bottom).
- `ratio` is the fraction of the container given to `children[0]`; the second
  child gets `1 - ratio`.
- A `TileNode` is a tile: an ordered list of tab ids + the active tab.
- Pure tree operations live in `src/workspace/tree.ts` (no Vue imports — unit
  tested in Node). The reactive wrapper is `src/composables/useWorkspace.ts`.

## Sizing rules

- **Min sizes**: every tile has `minTileWidth` / `minTileHeight` from the
  layout JSON (`"workspace": { "minTileWidth": 160, "minTileHeight": 100 }`).
- **Proportional resizing**: the ratio is baked into the flex `flex-basis`
  (`flex: 0 1 <ratio>%`), so when the workspace grows or shrinks the tiles keep
  their proportions. `min-width` / `min-height` act as the floor — the
  proportion is *only* broken when a tile reaches its min size, and it
  springs back when space returns.
- **Drag-to-tile takes half**: a split created by dropping a tab always starts
  at `ratio = 0.5` - the dragged tab takes half of the target tile.
- **Sash drag**: dragging the sash between two tiles sets the ratio in pixels,
  clamped so neither side can go below its subtree's min size. Subtree mins
  compose: a row split sums children, a column split takes the max (and vice
  versa for heights).

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

Edge bands: `clamp(25% of the side, 36px, 72px)`.

### Landing preview

While a tab is being dragged, the hovered drop zone is shown by a single
visual: a **transparent closed accent box** over the half-tile the tab
will take — full border on all four sides with shading fading from the
border toward the center (`--sf-dnd-shade`), no fill. Deliberately **not**
the side-panel drag-to-collapse open-edge glow, so the landing rectangle is
unambiguous. `scripts/shot-zones.cjs` captures a mid-drag screenshot
(`node scripts/shot-zones.cjs` → `/tmp/sf-zones.png`).

The dragged tab is **moved**, not copied: dropping on another tile (center or
edge) removes it from its source tile. If the source tile becomes empty it is
removed from the tree and the surrounding split merges away — unless it is
the root, which stays as an empty tile ("No tab open").

## Tab operations

- **Click** a tab → activate it in its tile (each tile has its own active tab).
- **✕** → close; the tab next to the closed one becomes active. Closing the
  last tab of a non-root tile removes the tile and merges the split.
- **+** → new "Untitled" tab in that tile.
- **Drag** a tab → move / split / reorder as above. Dropping it back where it
  came from is a no-op.

## Files

| File | Role |
|:-----|:-----|
| `src/workspace/tree.ts` | pure split-tree types + operations (Node-testable) |
| `src/composables/useWorkspace.ts` | reactive wrapper: root state, ops, DnD state, tile element registry |
| `src/components/Workspace.vue` | root: split-tree renderer + drop-zone hit testing + visual layer |
| `src/components/WorkspaceNode.vue` | recursive: split → sash + children; tile → `Tile` |
| `src/components/Tile.vue` | tab strip (drag, close, +) + content area |
| `src/components/Sash.vue` | pointer-based resize handle with pixel clamping |

## Tests

- Tree ops (pure, Node): 21 assertions — splits (same/cross tile, empty-source
  merging), moves, reorders, closes, min-size composition, ratio clamping.
- Browser (Playwright): `npm run check:dtt` — 17 assertions: split half-size,
  cross-tile move, cross-tile split, close-merge, sash resize, proportional
  workspace resize, min-width floor, strip reorder, no console errors.
