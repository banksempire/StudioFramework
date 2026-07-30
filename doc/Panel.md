# Panel

A resizable panel with a title bar. Both the left Docker panel and the right Properties panel use the same `Panel.vue` component — only `position` and `title` differ.

## Props

| Prop | Type | Default | Description |
|:---|:---|:---|:---|
| `title` | `string` | — | Text displayed in the title bar |
| `visible` | `boolean` | `true` | Show or hide the panel |
| `position` | `'left' \| 'right'` | — | Which side the panel sits on. Drives the border side, resize-handle side, and collapse-glow side. |

## Events

| Event | Payload | Description |
|:---|:---|:---|
| `collapse` | — | Emitted when the user drags the panel past the collapse threshold and releases. The parent should hide the panel. |

## Behavior

### Resize

- Drag the edge handle to resize between **150px** (min) and **500px** (max).
- The handle is on the side opposite the panel position: `right` edge for left panel, `left` edge for right panel.

### Drag-to-collapse

- Threshold is **100px** (2/3 of the 150px minimum).
- While dragging past the threshold, `willCollapse` activates — the **top, bottom, and opposite-side** edges glow blue via `box-shadow: inset`. The resize handle dims.
- On release below the threshold, `collapse` is emitted. The parent typically hides the panel.
- On release above the threshold, the panel snaps back to the 150px minimum.

### Layout

- The title bar is 35px tall, uppercase, with muted text color.
- No built-in content area — content is slotted by wrapper components.

## Wrapper components

### DockerPanel

Wraps `Panel` with `position="left"`. Derives the title from `activeTag`:

```vue
<DockerPanel
  :active-tag="activeTag"
  :visible="visible"
  @collapse="onCollapse"
/>
```

| Prop | Type | Description |
|:---|:---|:---|
| `active-tag` | `string` | Key used to look up the display title (explorer → "Files", search → "Search", etc.) |
| `visible` | `boolean` | Passed through to Panel |

### RightPanel

Wraps `Panel` with `position="right"` and a fixed title of `"Properties"`:

```vue
<RightPanel
  :visible="visible"
  @collapse="onCollapse"
/>
```

| Prop | Type | Description |
|:---|:---|:---|
| `visible` | `boolean` | Passed through to Panel |

## Composable

### useResize

Drives the resize and drag-to-collapse behavior. See `src/composables/useResize.ts`.

```ts
const { width, dragging, willCollapse, onMouseDown } = useResize({
  min: 150,              // Hard visual floor (px)
  max: 500,              // Maximum width (px)
  direction: 'right',    // 'left' | 'right' — which edge the handle is on
  collapseThreshold: 100,// Width below which collapse triggers on mouseup
  onCollapse: () => { … },
});
```

| Return | Type | Description |
|:---|:---|:---|
| `width` | `Ref<number>` | Current panel width |
| `dragging` | `Ref<boolean>` | `true` while the user is dragging |
| `willCollapse` | `Ref<boolean>` | `true` when drag crosses the collapse threshold (activates glow) |
| `onMouseDown` | `(e: MouseEvent) => void` | Bind to the resize handle's `@mousedown` |
