# Panel

A resizable panel with title bar, optional section tabs, and sub-section body.
Both the left Docker panel and the right Properties panel use the same
`Panel.vue` component.

> Panel content (title, sections, sub-sections) comes from the layout JSON —
> see [layout.md](./layout.md).

## Props

| Prop | Type | Default | Description |
|:---|:---|:---|:---|
| `title` | `string` | - | Text in the title bar |
| `visible` | `boolean` | `true` | Show or hide the panel |
| `position` | `'left' \| 'right'` | - | Which side. Drives border, resize-handle, and collapse-glow side |
| `sections` | `PanelSection[]` | `[]` | Section tabs + sub-sections below the title bar |
| `width` | `number` | `260` | Initial width (clamped to min/max). Framework passes the persisted width |
| `stateKey` | `string` | - | Stable identity keying persisted panel state (see below) |

Types are defined in [`src/types/panel.ts`](../src/types/panel.ts):

```ts
interface PanelSection {
  id: string;
  label: string;
  subSections: PanelSubSection[];
}
```

See [sub-section.md](./sub-section.md) for `PanelSubSection` and component types.

## Events

| Event | Payload | Description |
|:---|:---|:---|
| `collapse` | - | Emitted when drag-to-collapse triggers |
| `select-section` | `sectionId: string` | Emitted when a section tab is clicked |
| `resize` | `width: number` | Emitted live during resize drag (drives the panel auto-hide logic in `Framework.vue`) |

## Layout

```
┌─────────────────────────────────────┐
│ TitleBar          name        [⋯]   │  30px
├─────────────────────────────────────┤
│ SectionSelectionBar  tab  tab  tab  │  30px (only if sections > 1)
├─────────────────────────────────────┤
│ SubsectionBody                      │  fills remaining height
│   sub-sections...                   │
└─────────────────────────────────────┘
```

### TitleBar

- **Name**: Panel display name, left-aligned.
- **⋯ button**: Opens a dropdown toggle list of sub-sections in the active
  section. Each item shows ✓ when visible, blank when hidden. Visibility
  state persisted per panel + section.

### Section selection bar (SSB)

Appears only when `sections.length > 1`. Rendered below the title bar as a
row of tab buttons plus an optional overflow button.

#### Layout

- Each tab is a `<button>` styled with `flex: 1 1 0%` and
  `min-width: max-content`.
  - **Equal spacing** - when the row has enough room, all tabs share the
    available space equally (`flex-grow: 1` from the `0%` flex-basis).
  - **Content minimum** - `min-width: max-content` prevents any tab from
    shrinking below its label width. Text is never truncated.
- The `☰` overflow button has a fixed width (`flex: 0 0 28px`) and sits at
  the rightmost end of the row.
- The row container has `overflow: hidden`.

#### Overflow detection

A `ResizeObserver` on the tab row (attached via `watch(tabsRow, …, { immediate:
true })`) fires `recompute()` throttled through `requestAnimationFrame`.

1. **Measure** - each tab is temporarily set to `flex: 0 0 auto` so it
   renders at its natural content width. `offsetWidth` is read for every tab.
2. **Compute fit** - cumulative widths are summed left-to-right. At each
   position, the algorithm checks whether the cumulative width + 28px
   (reserved for the `☰` button, which only appears while more tabs follow)
   fits in the container's `clientWidth`. The first position that doesn't
   fit becomes the split point; at least one tab is always kept visible.
3. **Apply** - tabs beyond the split point receive `display: none`.
   Flex styles are restored to `flex: 1 1 0%` on visible tabs so they fill
   the remaining space equally.

When the split point changes, Vue reactively toggles `hasOverflow` which
shows/hides the `☰` button. The ResizeObserver fires again naturally
(because the DOM changed), and `recompute()` re-measures with the new layout.
This converges in 1–2 frames.

#### Active tab in overflow

If the active section index falls beyond the visible split, the `☰` button
gains the `.sf-panel-tab--active` class (blue bottom-border). The active tab
label is not swapped into the visible row - it only appears inside the
dropdown menu.

#### Overflow menu

- Clicking `☰` opens a dropdown positioned below the tab row.
- The dropdown lists every overflowed section (those after the split point).
- The active section gets a blue left-border in the dropdown.
- Clicking a dropdown item selects that section and closes the menu.
- **Click outside** - a global `click` listener (added when the menu opens
  via a `setTimeout(0)` to avoid self-closing) hides the menu when any
  click lands outside `.sf-panel-tabs-wrapper`.

#### Section vs panel switching

Clicking a section tab emits `select-section` with the section ID but does
**not** change the panel. Panel switching is handled by the Docker app bar
outside the Panel component.

The selected section index is persisted per panel instance via a
`Map<string, number>` keyed by the panel's joined section IDs. Switching
panels and back restores the last-selected section (two panels with
identical section id lists would share the saved index).

### SubsectionBody

Renders the active section's sub-sections. Managed by `SubsectionBody.vue`.
See [sub-section.md](./sub-section.md) for full details on height
distribution, drag handles, expand/collapse, and component types.

## Behavior

### Resize

- Drag the edge handle to resize between **150px** (min) and **500px** (max).
- The handle is on the side opposite the panel position: `right` edge for
  left panel, `left` edge for right panel.

### Drag-to-collapse (DTC)

- Threshold is **100px** (2/3 of the 150px minimum).
- While dragging past the threshold, **three edges glow**: top, bottom, and
  the opposite side. The glow uses `linear-gradient` fades (6px wide) - solid
  accent color at the edge fading to transparent inward.
- The glow is rendered by a dedicated overlay div (`z-index: 100`,
  `pointer-events: none`) above all panel content - nothing can block it.
- On release below 100px, `collapse` is emitted. The parent typically hides
  the panel.
- On release above 100px, the panel snaps back to the 150px minimum.

## Persisted UI state

Panel sizing/layout state survives page refreshes. It is stored in
`localStorage` under the versioned key **`sf.ui.state`** (`{ version, values }`),
written through `src/uiState.ts` (debounced ~300 ms, flushed on `beforeunload`).

| State | Storage key | Scope |
|:---|:---|:---|
| Panel width | `panel.width.left` / `panel.width.right` | Physical left/right panel |
| Active docker app | `panel.activeApp` | Framework |
| Active section tab | `panel.tab.<stateKey>::<sectionsKey>` | Panel + section set |
| Hidden sub-sections | `panel.hidden.<stateKey>::<sectionsKey>::<sectionId>` | Panel + section |
| Sub-section expanded + height | `panel.sub.<stateKey>::<sectionId>::<subId>` | Panel + section + sub-section |

`stateKey` is assigned by `Framework.vue`: `docker:<appId>` for the docker
panel, `right` for the right panel. Sub-section heights restore exactly when
the window is the same size; otherwise the distribution engine absorbs the
difference. Mobile panels never record sub-section heights. Panel visibility
(left/docker/right booleans) persists separately in the workspace snapshot
(`sf.workspace.layout`, see [workspace.md](./workspace.md)).

**Saved workspaces carry all of it.** Every `capture()` merges the whole
values map into `snapshot.ui`, and `apply()` replaces the live store and
bumps a ui **epoch** — mounted `Panel`/`SubsectionBody` instances watch the
epoch and re-hydrate, so loading a saved workspace restores widths, tabs,
hidden/collapsed sub-sections and heights in place. The key-set is exhaustive:
anything in `sf.ui.state` rides, including host-app keys (`app.*`) written
through `src/uiState.ts` by the embedding app — e.g. pi-agent-studio stores
its session-status filter, composer prefs and drafts there so they ride in
saved workspaces too.

## Docker app bar

Managed by `Framework.vue`, not `Panel.vue`. Each icon on the docker bar is an
**app** (one per `docker[]` entry). Single-click behavior:

| Click | Panel state | Result |
|:---|:---|:---|
| Same app | Open | Close panel |
| Same app | Closed | Open panel |
| Different app | Any | Switch and open |

No double-click - single click toggles.

## Composable

### useResize

```ts
const { width, dragging, willCollapse, onMouseDown } = useResize({
  min: 150,              // Hard visual floor (px)
  max: 500,              // Maximum width (px)
  initial: 260,          // Starting width (clamped to min/max)
  direction: 'right',    // 'left' | 'right' - which edge the handle is on
  collapseThreshold: 100,// Width below which DTC triggers on mouseup
  onCollapse: () => { … },
  onResize: (w) => { … }, // Optional: live width updates during drag
});
```

| Option | Type | Default | Description |
|:---|:---|:---|:---|
| `min` | `number` | `180` | Minimum visible width (px) |
| `max` | `number` | `500` | Maximum width (px) |
| `initial` | `number` | `260` | Starting width, clamped into `[min, max]` |
| `direction` | `'left' \| 'right'` | `'right'` | Which edge the handle is on |
| `collapseThreshold` | `number` | `min * 0.45` | Width below which DTC triggers on mouseup |
| `onCollapse` | `() => void` | - | Called on mouseup when width falls below the threshold |
| `onResize` | `(width: number) => void` | - | Called live during drag (Panel uses it to emit `resize`) |

| Return | Type | Description |
|:---|:---|:---|
| `width` | `Ref<number>` | Current panel width |
| `dragging` | `Ref<boolean>` | `true` while the user is dragging |
| `willCollapse` | `Ref<boolean>` | `true` when drag crosses the collapse threshold (activates glow) |
| `onMouseDown` | `(e: MouseEvent) => void` | Bind to the resize handle's `@mousedown` |
