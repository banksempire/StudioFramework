# Panel

A `Panel` renders its content from a structured payload (JSON). The same `Panel` component is used for both the left Docker panel and the right panel — only the payload differs.

## Terminology

| Term | Definition |
|:---|:---|
| **Panel** | Top-level container: title bar + sections + sub-sections + components. Rendered by `Panel.vue`. |
| **Section** | A tabbed group of sub-sections. Shown as a horizontal tab bar directly below the title. |
| **Sub-section** | A collapsible group of components. Has a header bar with expand/collapse, display name, and optional action buttons. |
| **Component** | An interactive leaf widget: tree, table, slider, dropdown, text input, key-value list, etc. |
| **Action button** | An optional icon button on a sub-section header, defined per-instance in the payload. |

## Layout

```
┌─ Panel ────────────────────────────────────────┐
│ [Display Name :<]                    [⋯ :>]    │  ← Title bar
│ [Section A  |  Section B  |  Section C  | ⋯]   │  ← Section tabs (only if ≥ 2 sections)
├────────────────────────────────────────────────┤
│ ▼ Sub-section 1                        [⚙ ⤓]  │  ← Expanded, optional action buttons
│   ┌──────────────────────────────────────────┐ │
│   │ Component A                               │ │
│   │ Component B                               │ │
│   └──────────────────────────────────────────┘ │
│────────────────── drag handle ─────────────────│  ← Vertical resize (between adjacent sub-sections)
│ ▶ Sub-section 2                                │  ← Collapsed
│────────────────── drag handle ─────────────────│
│ ▼ Sub-section 3                                │  ← Expanded
│   ┌──────────────────────────────────────────┐ │
│   │ File tree (tall, scrolls internally)      │ │
│   │ ...                                       │ │
│   └──────────────────────────────────────────┘ │
│ ▶ Sub-section 4                                │  ← Collapsed, further down
└────────────────────────────────────────────────┘
```

## Component tree

```
Panel
 ├─ TitleBar
 │    ├─ Display name (left-aligned)
 │    └─ ⋯ menu (right-aligned) — toggle sub-section visibility
 ├─ SectionTabs (hidden when only 1 section)
 │    ├─ Section tab
 │    ├─ Section tab
 │    └─ ⋯ overflow menu (only hidden tabs)
 └─ SubSection[]
      ├─ Header bar
      │    ├─ Expand/collapse indicator (◀ / ▼)
      │    ├─ Display name
      │    └─ Action buttons[] (right-aligned, from payload)
      ├─ vertical resize handle (bottom edge)
      └─ Component[] (rendered when expanded)
```

---

## Title bar

**Layout:** `[Display Name :<] [⋯ button :>]`

| Element | Description |
|:---|:---|
| Display name | The `title` string from the payload. Left-aligned. |
| `⋯` button | Opens a dropdown listing all sub-sections (across all sections) with checkboxes to show/hide each. Same as VS Code's "Views" menu in the Explorer `...` button. |

## Section tabs

**Layout:** `[Tab A | Tab B | Tab C | [⋯ :>]]`

- Hidden when the panel payload has **only 1 section**.
- Tabs are evenly spaced. Clicking a tab switches to that section's sub-sections below.
- When tabs don't all fit, remaining tabs overflow into a `⋯` dropdown on the right. The dropdown shows **only the hidden tabs**.

## Sub-section

### Header bar

**Layout:** `[▼/▶ :<] [Display Name] [Action Button 1] [Action Button 2] ... [:>]`

| Element | Description |
|:---|:---|
| `▼` / `▶` | Expand/collapse indicator. `▼` = expanded, `▶` = collapsed. Single-click toggles. |
| Display name | The sub-section's display name. Left of action buttons. |
| Action buttons | Optional icon buttons from the payload's `actionButtons` array. Rendered right-aligned. Each button has an `id`, `icon`, and `tooltip`. Click handlers are dispatched by `id` and handled by the parent app. |

### Collapse / expand

- Single-click the header bar toggles the sub-section.
- When collapsed, only the header bar is visible. Components are not rendered.
- When expanded, all components render and the sub-section occupies its allocated height.

### Vertical resize

- A 4px drag handle sits on the **bottom edge** of every expanded sub-section (except the last).
- Dragging up/down resizes the space **between the two adjacent sub-sections**. No other sub-sections are affected.
- Every expanded sub-section has a **minimum height** (e.g., 60px). Dragging below this minimum is clamped.
- **No collapse-on-drag.** Vertical resize has no collapse threshold; it only resizes.

## Components

Leaf widgets rendered inside a sub-section. The renderer switches on `type`:

| `type` | Widget |
|:---|:---|
| `tree` | Hierarchical file tree |
| `table` | Object properties table |
| `keyValueList` | Key-value pair list |
| `slider` | Range slider |
| `dropdown` | Select dropdown |
| `textBox` | Text input field |
| `checkbox` | Single checkbox |
| `button` | Action button |
| `label` | Read-only text |

> Component types can be extended. Each type has its own payload shape under `contents`.

---

## Data schema

The panel content is defined by a **single JSON payload** sent from the backend at app launch. The payload uses the following TypeScript shape:

```ts
// ── Top-level panel payload ────────────────────────────────────────────────

interface PanelPayload {
  /** Display name shown in the title bar */
  title: string;

  /** Tabbed groups of sub-sections */
  sections: PanelSection[];
}

// ── Section ─────────────────────────────────────────────────────────────────

interface PanelSection {
  /** Unique id for this section */
  id: string;

  /** Label shown on the section tab */
  label: string;

  /** Collapsible groups within this section */
  subSections: PanelSubSection[];
}

// ── Sub-section ─────────────────────────────────────────────────────────────

interface PanelSubSection {
  /** Unique id for this sub-section */
  id: string;

  /** Display name in the sub-section header bar */
  displayName: string;

  /** Initial expand/collapse state (default: true) */
  expanded?: boolean;

  /** Omit components from initial payload; fetch on first expand */
  lazyLoad?: boolean;

  /** Optional action buttons on the right of the header bar */
  actionButtons?: ActionButton[];

  /** Leaf widgets. Empty until lazy-loaded content arrives. */
  components: PanelComponent[];
}

// ── Action button ───────────────────────────────────────────────────────────

interface ActionButton {
  /** Unique id used to dispatch click events */
  id: string;

  /** Unicode icon or icon class */
  icon: string;

  /** Hover tooltip */
  tooltip?: string;
}

// ── Component (discriminated union) ─────────────────────────────────────────

type PanelComponent =
  | TreeComponent
  | TableComponent
  | KeyValueListComponent
  | SliderComponent
  | DropdownComponent
  | TextBoxComponent
  | CheckboxComponent
  | ButtonComponent
  | LabelComponent;

interface TreeComponent {
  type: 'tree';
  id: string;
  contents: TreeNode[];
}

interface TreeNode {
  id: string;
  label: string;
  icon?: string;
  children?: TreeNode[];
  expanded?: boolean;
}

interface TableComponent {
  type: 'table';
  id: string;
  contents: {
    columns: { key: string; label: string }[];
    rows: Record<string, unknown>[];
  };
}

interface KeyValueListComponent {
  type: 'keyValueList';
  id: string;
  contents: { key: string; value: unknown; readOnly?: boolean }[];
}

interface SliderComponent {
  type: 'slider';
  id: string;
  contents: { min: number; max: number; step?: number; value: number; label?: string };
}

interface DropdownComponent {
  type: 'dropdown';
  id: string;
  contents: { options: string[]; value: string; label?: string };
}

interface TextBoxComponent {
  type: 'textBox';
  id: string;
  contents: { value: string; placeholder?: string; label?: string };
}

interface CheckboxComponent {
  type: 'checkbox';
  id: string;
  contents: { checked: boolean; label: string };
}

interface ButtonComponent {
  type: 'button';
  id: string;
  contents: { label: string; variant?: 'primary' | 'secondary' };
}

interface LabelComponent {
  type: 'label';
  id: string;
  contents: { text: string };
}
```

---

## Behaviors

### Vertical scrolling

- The panel body scrolls vertically as one unit.
- Collapsed sub-sections remain collapsed. Their header bars stay in DOM order.
- Expanded sub-sections with tall content (e.g., a file tree) push later content down.

### Sub-section expand / collapse

- **Single-click** the header bar toggles expand/collapse.
- The expand/collapse indicator flips between `▼` (expanded) and `▶` (collapsed).
- When a sub-section is collapsed, its components are **not rendered** (not just hidden — this avoids unnecessary DOM and reactivity overhead).

### Vertical resize

- A drag handle sits on the **bottom edge** of each expanded sub-section, except the last one.
- Dragging resizes the two sub-sections above and below the handle. All other sub-sections are unaffected.
- Minimum height is enforced (60px). The cursor is `row-resize`.
- **No collapse-on-drag.** There is no collapse threshold for vertical resize.

### Unified data loading

- The entire panel payload is sent from the backend in one JSON response at app launch.
- Nodes marked `lazyLoad: true` have their `components` array empty (`[]`).
- On first expand of a lazy sub-section, the frontend fetches `GET /panel/{sectionId}/{subSectionId}` and fills `components` from the response.
- Subsequent expand/collapse toggles do not trigger a re-fetch.

### Event dispatch

- **Component changes:** Each component emits `{ componentId, value }` on user interaction. The parent app handles persistence.
- **Action button clicks:** The sub-section emits `{ subsectionId, actionId }`. The parent app dispatches to the appropriate handler.
- **Panel events:** `@collapse` (horizontal panel-edge drag, as currently implemented), `@action` (for action buttons), `@component-change` (for component value changes).

---

## Example payload

A realistic Docker panel payload:

```json
{
  "title": "Files",
  "sections": [
    {
      "id": "workspace",
      "label": "Workspace",
      "subSections": [
        {
          "id": "file-tree",
          "displayName": "Project Files",
          "expanded": true,
          "lazyLoad": false,
          "actionButtons": [
            { "id": "refresh", "icon": "⟳", "tooltip": "Refresh" },
            { "id": "collapse-all", "icon": "⊟", "tooltip": "Collapse All" }
          ],
          "components": [
            {
              "type": "tree",
              "id": "explorer-tree",
              "contents": [
                { "id": "src", "label": "src", "icon": "📁", "expanded": true,
                  "children": [
                    { "id": "components", "label": "components", "icon": "📁", "expanded": true,
                      "children": [
                        { "id": "menubar", "label": "MenuBar.vue", "icon": "📄" },
                        { "id": "docker", "label": "Docker.vue", "icon": "📄" }
                      ]
                    }
                  ]
                },
                { "id": "package", "label": "package.json", "icon": "📄" }
              ]
            }
          ]
        },
        {
          "id": "outline",
          "displayName": "Outline",
          "expanded": false,
          "lazyLoad": true,
          "components": []
        }
      ]
    },
    {
      "id": "history",
      "label": "History",
      "subSections": [
        {
          "id": "recent",
          "displayName": "Recent Files",
          "components": [
            { "type": "label", "id": "recent-label", "contents": { "text": "No recent files" } }
          ]
        }
      ]
    }
  ]
}
```

---

## Implementation notes

1. **Panel.vue** becomes a renderer: it receives a `PanelPayload` prop and recursively renders the tree.
2. **Sub-section vertical resize** is distinct from the panel-edge horizontal resize in `useResize`. Keep them separate — the panel-edge resize lives on `Panel.vue` (horizontal), the vertical resize lives inside the sub-section list.
3. **Component renderer** should use Vue's `<component :is="...">` dynamic component or a simple `v-if`/`v-else-if` chain keyed on `type`.
4. **Lazy load** can be handled by a composable `useLazySection(sectionId, subSectionId)` that returns a `loading` ref and triggers the fetch.
5. **The left and right panels** both use the same `Panel.vue` with different `PanelPayload` objects — exactly the Python "different objects from the same class" pattern.
