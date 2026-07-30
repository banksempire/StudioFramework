# Panel

A resizable panel with title bar and optional section tabs. Both the left Docker panel and the right Properties panel use the same `Panel.vue` component.

## Props

| Prop | Type | Default | Description |
|:---|:---|:---|:---|
| `title` | `string` | — | Text in the title bar |
| `visible` | `boolean` | `true` | Show or hide the panel |
| `position` | `'left' \| 'right'` | — | Which side. Drives border, resize-handle, and collapse-glow side |
| `sections` | `PanelSection[]` | `[]` | Section tabs below the title bar |

```ts
interface PanelSection {
  id: string;
  label: string;
}
```

## Events

| Event | Payload | Description |
|:---|:---|:---|
| `collapse` | — | Emitted when drag-to-collapse triggers |
| `select-section` | `sectionId: string` | Emitted when a section tab is clicked |

## Behavior

### Resize

- Drag the edge handle to resize between **150px** (min) and **500px** (max).
- The handle is on the side opposite the panel position: `right` edge for left panel, `left` edge for right panel.

### Drag-to-collapse (DTC)

- Threshold is **100px** (2/3 of the 150px minimum).
- While dragging past the threshold, **three edges glow blue**: top, bottom, and the opposite side. The resize handle dims.
- The glow is rendered by a dedicated overlay div (`z-index: 100`, `pointer-events: none`) above all panel content — nothing can block it.
- On release below 100px, `collapse` is emitted. The parent typically hides the panel.
- On release above 100px, the panel snaps back to the 150px minimum.

### Section selection bar (SSB)

Appears only when `sections.length > 1`. Rendered below the title bar as a
row of tab buttons plus an optional overflow button.

#### Layout

- Each tab is a `<button>` styled with `flex: 1 1 0%` and
  `min-width: max-content`.
  - **Equal spacing** — when the row has enough room, all tabs share the
    available space equally (`flex-grow: 1` from the `0%` flex-basis).
  - **Content minimum** — `min-width: max-content` prevents any tab from
    shrinking below its label width. Text is never truncated.
- The `☰` overflow button has a fixed width (`flex: 0 0 28px`) and sits at
  the rightmost end of the row.
- The row container has `overflow: hidden`.

#### Overflow detection

A `ResizeObserver` on the tab row (attached via `watch(tabsRow, …, { immediate:
true })`) fires `recompute()` throttled through `requestAnimationFrame`.

1. **Measure** — each tab is temporarily set to `flex: 0 0 auto` so it
   renders at its natural content width. `offsetWidth` is read for every tab.
2. **Compute fit** — cumulative widths are summed left-to-right. At each
   position, the algorithm checks whether the cumulative width + 28px
   (reserved for the `☰` button) fits in the container's `clientWidth`.
   The first position that doesn't fit becomes the split point.
3. **Apply** — tabs beyond the split point receive `display: none`.
   Flex styles are restored to `flex: 1 1 0%` on visible tabs so they fill
   the remaining space equally.

When the split point changes, Vue reactively toggles `hasOverflow` which
shows/hides the `☰` button. The ResizeObserver fires again naturally
(because the DOM changed), and `recompute()` re-measures with the new layout.
This converges in 1–2 frames.

#### Active tab in overflow

If the active section index falls beyond the visible split, the `☰` button
gains the `.sf-panel-tab--active` class (blue bottom-border). The active tab
label is not swapped into the visible row — it only appears inside the
dropdown menu.

#### Overflow menu

- Clicking `☰` opens a dropdown positioned below the tab row.
- The dropdown lists every overflowed section (those after the split point).
- The active section gets a blue left-border in the dropdown.
- Clicking a dropdown item selects that section and closes the menu.
- **Click outside** — a global `click` listener (added when the menu opens
  via a `setTimeout(0)` to avoid self-closing) hides the menu when any
  click lands outside `.sf-panel-tabs-wrapper`.

#### Section vs panel switching

Clicking a section tab emits `select-section` with the section ID but does
**not** change the panel. Panel switching is handled by the Docker icon bar
outside the Panel component.

The selected section index is persisted per panel via a `Map<string, number>`
keyed by section IDs. Switching panels and back restores the last-selected
section.

## Docker icon bar

Managed by `App.vue`, not `Panel.vue`. Single-click behavior:

| Click | Panel state | Result |
|:---|:---|:---|
| Same icon | Open | Close panel |
| Same icon | Closed | Open panel |
| Different icon | Any | Switch and open |

No double-click — single click toggles.

## Composable

### useResize

```ts
const { width, dragging, willCollapse, onMouseDown } = useResize({
  min: 150,              // Hard visual floor (px)
  max: 500,              // Maximum width (px)
  direction: 'right',    // 'left' | 'right' — which edge the handle is on
  collapseThreshold: 100,// Width below which DTC triggers on mouseup
  onCollapse: () => { … },
});
```

| Return | Type | Description |
|:---|:---|:---|
| `width` | `Ref<number>` | Current panel width |
| `dragging` | `Ref<boolean>` | `true` while the user is dragging |
| `willCollapse` | `Ref<boolean>` | `true` when drag crosses the collapse threshold (activates glow) |
| `onMouseDown` | `(e: MouseEvent) => void` | Bind to the resize handle's `@mousedown` |
