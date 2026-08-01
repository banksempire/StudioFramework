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
}

export interface KeyValueItem {
  key: string;
  value: string;
}

export interface ListItem {
  id: string;
  label: string;
  icon?: IconDef;
  badge?: string;
}

export type PanelComponent =
  | { type: 'text'; text: string; muted?: boolean }
  | { type: 'input'; value: string; placeholder?: string }
  | { type: 'button'; label: string; icon?: IconDef }
  | { type: 'tree'; nodes: TreeNode[] }
  | { type: 'keyValueList'; items: KeyValueItem[] }
  | { type: 'list'; items: ListItem[] };

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
