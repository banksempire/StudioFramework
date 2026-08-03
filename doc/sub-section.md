# Sub-sections

Sub-sections are collapsible groups of content within a panel section. They
provide the third level of the panel hierarchy:

```
Panel > Section > SubSection > Component
```

> Sub-section definitions live in the layout JSON (`sections[].subSections`)
> — see [layout.md](./layout.md) for the file format.

## Hierarchy

```typescript
interface PanelSection {
  id: string;
  label: string;
  subSections: PanelSubSection[];
}

interface PanelSubSection {
  id: string;
  label: string;
  isHeightVariable: boolean;
  minHeight?: number;           // ignored if isHeightVariable = false
  utilities?: PanelUtility[];
  components: PanelComponent[];
}
```

## Panel layout

```
┌─────────────────────────────────┐
│ TitleBar          name    [⋯]   │  ← panel name (left), visibility toggle (right)
├─────────────────────────────────┤
│ SectionSelectionBar  tab tab    │  ← only if sections.length > 1
├─────────────────────────────────┤
│ SubsectionBody                  │  ← fills remaining panel height
│  ┌─ SubSection TitleBar ──────┐ │
│  │ ❯ LABEL          [util]    │ │  ← click to expand/collapse
│  ├─ ComponentBody ───────────┤ │
│  │  components...             │ │
│  └────────────────────────────┘ │
│  ┌─ SubSection TitleBar ──────┐ │
│  │ ...                        │ │
│  └────────────────────────────┘ │
└─────────────────────────────────┘
```

### TitleBar

- **Name**: Display name of the panel, left-aligned.
- **⋯ button**: Opens a dropdown toggle list of all sub-sections in the active
  section. Each item shows a ✓ when visible, blank when hidden. Visibility
  state is persisted per panel (Docker tag) + section combination.

### SectionSelectionBar (SSB)

Appears only when `sections.length > 1`. See [Panel.md](./Panel.md) for SSB
details (overflow, dropdown, state persistence).

### SubsectionBody

Fills all remaining panel area. Contains all visible sub-sections stacked
vertically. Scrolls when content overflows (all resizeable sub-sections at
minimum height and still overflowing).

## Sub-section layout

Each sub-section has two parts:

```
┌─ TitleBar ────────────────────────┐
│ ❯ DISPLAY NAME           [util]  │  ← 24px, click to toggle expand/collapse
├─ ComponentBody ───────────────────┤
│  Component                        │
│  Component                        │
│  ...                              │
└───────────────────────────────────┘
```

### TitleBar

- **Expand indicator**: `❯` (U+276F) rotated 90° when expanded, pointing right
  when collapsed.
- **Display name**: Uppercase, muted text. Fixed `[F]` suffix shown for
  fixed-height sub-sections (debug aid).
- **Utilities**: Optional minor action buttons (e.g., refresh). Shown on hover,
  or always visible when the sub-section is **active** (see below).

### Active sub-section

Only one sub-section per panel can be **active** at a time. Clicking the
sub-section's **body** (content area) activates it; clicking another
sub-section's body deactivates the previous one. Clicking the **title bar**
only toggles expand/collapse and does NOT activate.

- **Button visibility**: utility buttons are `display: none` by default (no
  layout space, label extends full width). They are shown when the
  sub-section is **active** or when the mouse hovers over **any part** of
  it. The active sub-section's buttons are always visible regardless of
  hover. This is the only visual indicator of the active state - the
  header text color is the same regardless.
- **Lifecycle**: the active id is cleared when the sub-section is hidden or
  removed from the visible list. Switching panel section (tab) recreates
  `SubsectionBody` and resets active to `null`.

### ComponentBody

Renders all components belonging to the sub-section. Height behavior depends on
`isHeightVariable`:

| Mode | Height | Scroll |
|:---|:---|:---|
| `isHeightVariable = false` (fixed) | Auto-sizes to content (`offsetHeight` measured from DOM) | Never scrolls internally |
| `isHeightVariable = true` (variable) | Managed by `SubsectionBody` layout engine, clamped to `minHeight` | Scrolls internally when content exceeds allocated height (`is_scrollable` derived property) |

### `is_scrollable` (derived)

```
if height_of_components > height:
    return True   # ComponentBody gets internal scrollbar
else:
    return False
```

Only possible when `isHeightVariable = true` and the sub-section has been
squeezed below its content height. Fixed sub-sections always have
`height == height_of_components`, so never scroll internally.

## States

Each sub-section has three independent states:

| State | Toggled by | Effect |
|:---|:---|:---|
| `is_visible` | ⋯ dropdown on Panel TitleBar | Sub-section entirely hidden (title bar + body) |
| `is_expanded` | Clicking SubSection TitleBar | ComponentBody hidden, only title bar shows |
| `is_height_variable` | Predefined in data payload | Whether height can be adjusted by layout/drag |

A sub-section is **resizeable** when all three are true:
`is_visible && is_expanded && is_height_variable`

Visibility (`is_visible`) is persisted per panel + section. Expand/collapse
(`is_expanded`) resets when switching sections (component is re-keyed).

## Height distribution

### Passive resizing (`on_change_in_unallocated_space`)

Triggered by: window resize, panel resize, expand/collapse, visibility toggle,
fixed sub-section content changes (ResizeObserver).

```
unallocated = bodyHeight - used

used = Σ(TITLE_BAR_H + bodyHeight) for each visible sub-section

if unallocated > 0:
    # Give ALL surplus to the first resizeable sub-section
    first_resizeable.height += unallocated

if unallocated < 0:
    # Squeeze resizeable sub-sections top-to-bottom, stop at minHeight
    for sub in resizeable (top → bottom):
        give = min(sub.height - sub.minHeight, remaining)
        sub.height -= give
        remaining -= give
        if remaining == 0: break

    # If still < 0: all at min, SubsectionBody scrollbar appears
```

**No partial recovery**: if space increases but `unallocated` is still negative
(was -100, now -50), no sub-section recovers. This is intentional to avoid
overflow.

### Expand / collapse with height preservation

When a sub-section is collapsed, its height is **saved**. The freed space goes
to other resizeable sub-sections via the normal distribution logic.

When expanded again, the saved height is **restored** by taking space back from
other resizeable sub-sections (those that absorbed it during collapse). This
ensures collapse → expand returns the sub-section to its original size.

```
# Collapse
sub.savedHeight = sub.height
sub.isExpanded = false
# → distributeHeight() gives freed space to first resizeable

# Expand
sub.isExpanded = true
target = sub.savedHeight
needed = target
for other in resizeable (excluding self):
    give = min(other.height - other.minHeight, needed)
    other.height -= give
    needed -= give
sub.height = target - needed   # may be less if others at min
# → distributeHeight() settles any remainder
```

## Drag to redistribute space

Drag handles appear between two sub-sections when there is at least one
resizeable sub-section above AND below the boundary. Handles are rendered as
zero-height wrappers with an absolutely-positioned 4px hit area — no layout
impact.

```
if resizeable_count <= 1:
    return  # nothing to drag

above, below = bisect(resizeable, drag_line)

if drag_up:
    # Squeeze above (bottom → top), give to first below
    for sb in reversed(above):
        freed += sb.decrease(delta, stop_at_min)
    below[0].height += freed

if drag_down:
    # Squeeze below (top → bottom), give to last above
    for sb in below:
        freed += sb.decrease(delta, stop_at_min)
    above[-1].height += freed
```

Drag is space-neutral (`unallocated` unchanged). The cursor is locked to
`row-resize` globally during drag via `body.sf-dragging` class.

## Components

Six component types are supported via a discriminated union:

| Type | Description | Height |
|:---|:---|:---|
| `text` | Static text label | Constant |
| `input` | Text input field | Constant |
| `button` | Action button | Constant |
| `tree` | Expandable tree (file tree) | Variable (changes on node expand/collapse) |
| `keyValueList` | Key-value pairs | Variable (depends on content) |
| `list` | List of items | Variable (depends on content) |

Component height is a **read-only attribute**. The layout engine measures it
from the DOM (`offsetHeight` via `ResizeObserver` for fixed sub-sections).

When a component's content changes (e.g., tree node expanded), it emits
`content-changed`, which triggers `refresh()` to re-measure and re-distribute.

## File map

| File | Role |
|:---|:---|
| `src/types/panel.ts` | `PanelSection`, `PanelSubSection`, `PanelComponent`, `PanelUtility`, `TreeNode`, `KeyValueItem`, `ListItem` |
| `src/components/SubsectionBody.vue` | Layout manager: height distribution, drag, expand/collapse, measurement |
| `src/components/SubSection.vue` | Title bar (expand indicator, label, utilities) + ComponentBody wrapper |
| `src/components/PanelComponent.vue` | Renders 6 component types; tree has expand/collapse with `content-changed` emit |
| `src/components/Panel.vue` | ⋯ visibility dropdown, passes `subSections` + `hiddenIds` to `SubsectionBody` |

## CSS notes

- **Sub-section edge**: `box-shadow: inset 0 1px 0 var(--sf-border)` — visual
  separator with zero layout impact (first child excluded).
- **Drag handle**: Zero-height wrapper (`height: 0; position: relative`) with
  absolutely-positioned handle (`top: -2px; height: 4px; z-index: 10`) — zero
  layout impact.
- **Drag cursor**: `body.sf-dragging, body.sf-dragging * { cursor: row-resize !important; }`
  forces cursor on all elements during drag.
- **Initial render**: `overflow-y: hidden` until first `distributeHeight()` runs
  (via `ready` flag), preventing scrollbar flash.
- All colors use CSS custom properties — single `:root` swap for theming.
