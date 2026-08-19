# SingleMenu

A single-level list element: a list of items where each item has a flat set of
options (no sub-levels, unlike the multi-level [`Menu.vue`](../src/components/Menu.vue)).
The content of each item is fully customizable via the `#item` slot.

- **Mouse-keyboard device**: right-click an item → its options open in a small
  menu at the cursor.
- **Touch device**: swipe an item left →
  - one option → the option is revealed directly as a button behind the row
    (tap it to run it);
  - several options → a centered popup dialog lists the options.
- Long-press (`contextmenu` from touch) is suppressed so the swipe stays the
  only touch path.
- Vertical pans stay native (the row never captures the pointer for vertical
  drags), and the synthetic click after a swipe is suppressed (never activates
  the row).

## Props

| Prop | Type | Default | Description |
|:---|:---|:---|:---|
| `items` | `T[]` | - | List items (any type) |
| `options` | `(item: T) => SingleMenuOption[]` | - | Options for one item. Empty → no interactions for that item |
| `keyOf` | `(item: T) => string` | item `.id` / `String(item)` | Stable row key (swipe/reveal state is kept per key) |
| `titleOf` | `(item: T) => string` | - | Title shown in the touch popup dialog |
| `draggable` | `boolean` | `false` | Makes each row HTML5-draggable (`dragstart`/`dragend` are re-emitted) |
| `revealWidth` | `number` | `86` | Width of the revealed action area (px) |

```ts
interface SingleMenuOption {
  id: string;
  label?: string;
  icon?: IconDef;
  danger?: boolean;
  disabled?: boolean;
}
```

## Events

| Event | Payload | Description |
|:---|:---|:---|
| `activate` | `item: T` | Row tapped/clicked (not fired for the synthetic click after a swipe) |
| `select` | `item: T, option: SingleMenuOption` | An option was chosen (menu, dialog, or revealed button) |
| `dragstart` | `item: T, event: DragEvent` | HTML5 drag started on a row (`draggable` rows) |
| `dragend` | `event: DragEvent` | HTML5 drag ended |

## Slots

| Slot | Scope | Description |
|:---|:---|:---|
| `item` | `{ item: T, index: number }` | Row content — anything you want |

## Example

```vue
<SingleMenu
  :items="sessions"
  :options="(s) => [
    { id: 'rename', label: 'Rename', icon: '✎' },
    { id: 'delete', label: 'Delete', icon: '🗑', danger: true },
  ]"
  :key-of="(s) => s.id"
  :title-of="(s) => s.title"
  draggable
  @activate="(s) => open(s.id)"
  @select="onOption"
>
  <template #item="{ item: s }">
    <div class="my-row">{{ s.title }}</div>
  </template>
</SingleMenu>
```

## Demo + checks

- Demo: `Recent` sub-section of the Explorer panel in
  [`src/layout/framework.layout.json`](../src/layout/framework.layout.json),
  rendered by [`SingleMenuDemo.vue`](../src/components/SingleMenuDemo.vue)
  (registered in `src/main.ts` as `single-menu-demo`). `scratch.txt` carries a
  single option, all other rows three.
- Checks: `npm run check:singlemenu` (honors `SF_TEST_PORT`) — desktop
  right-click flow, touch swipe → dialog / revealed button, click suppression,
  native vertical pan, long-press suppression.
