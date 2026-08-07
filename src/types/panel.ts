// ── Component primitives ───────────────────────────────────────────────────

/**
 * Icon definition from the layout JSON:
 * - string  → unicode character (e.g. "📁")
 * - object  → image file (e.g. { type: 'image', url: '/icons/explorer.svg' })
 */
export type IconDef = string | { type: 'image'; url: string };

export interface PanelUtility {
  id: string;
  icon: IconDef;
  tooltip?: string;
}

export interface TreeNode {
  id: string;
  label: string;
  icon?: IconDef;
  children?: TreeNode[];
  badge?: string;
  /** action id emitted when a leaf node is clicked */
  action?: string;
}

export interface KeyValueItem {
  key: string;
  value?: string | number;
  /** Render the value as a pill (badge) instead of plain text. */
  pill?: boolean;
  /** Pill tone → kv-pill--<tone>; defaults to the value itself. */
  tone?: string;
}

export interface ListItem {
  id: string;
  label: string;
  icon?: IconDef;
  badge?: string;
  /** action id emitted when the item is clicked */
  action?: string;
}

export type PanelComponent =
  | { type: 'text'; text: string; muted?: boolean }
  | { type: 'input'; value: string; placeholder?: string }
  | { type: 'button'; label: string; icon?: IconDef; action?: string }
  | { type: 'tree'; nodes: TreeNode[] }
  | { type: 'keyValueList'; items: KeyValueItem[] }
  | { type: 'list'; items: ListItem[] }
  /** app-registered component, rendered by key (see registry.ts) */
  | { type: 'component'; key: string; props?: Record<string, unknown> };

/**
 * Action produced by a panel component (button / list item / tree node /
 * custom component). Bubbles up through the panel chain to the framework
 * root, which forwards it to the host app.
 */
export interface PanelAction {
  /** emitting component: built-in type ("button" | "list" | "tree") or custom key */
  source: string;
  action?: string;
  payload?: unknown;
}

// ── Sub-section ────────────────────────────────────────────────────────────

export interface PanelSubSection {
  id: string;
  label: string;
  isHeightVariable: boolean;
  minHeight?: number;
  utilities?: PanelUtility[];
  components: PanelComponent[];
}


// ── Section ────────────────────────────────────────────────────────────────

export interface PanelSection {
  id: string;
  label: string;
  subSections: PanelSubSection[];
}
