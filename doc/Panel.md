# Panel

A resizable panel with title bar and optional section tabs. Both the left Docker panel and the right Properties panel use the same `Panel.vue` component.

## Props

| Prop | Type | Default | Description |
|:---|:---|:---|:---|
| `title` | `string` | — | Text in the title bar |
| `visible` | `boolean` | `true` | Show or hide the panel |
| `position` | `'left' \| 'right'` | — | Which side. Drives border, resize-handle, and collapse-glow side |
| `sections` | `PanelSection[]` | `[]` | Section tabs below the title bar |
| `activeSection` | `string` | — | ID of the currently active section |

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

### Section tabs

- Appear only when `sections.length > 1`.
- **Enough space:** tabs are evenly spaced (`flex: 1 1 auto`).
- **Tight space:** tabs shrink to natural content width. Words are never truncated.
- **Overflow:** when tabs no longer fit, a `☰` button appears on the right. Overflowed tabs go into a dropdown.
- **Active tab in overflow:** the `☰` button turns blue (active state). The active tab label is shown in the last visible slot so it's always displayed.
- **Click outside** the dropdown closes it.
- Clicking a section tab does **not** change the panel — it only selects a section within the current panel. Panel switching happens via the Docker icon bar.

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
