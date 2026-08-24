export type IconDef = string | { type: 'image'; url: string };

export interface PanelUtility {
  id: string;
  icon: IconDef;
  tooltip?: string;
  closeMobilePanel?: boolean;
}

export interface TreeNode {
  id: string;
  label: string;
  icon?: IconDef;
  children?: TreeNode[];
  badge?: string;
  action?: string;
}

export interface KeyValueItem {
  key: string;
  value?: string | number;
  pill?: boolean;
  tone?: string;
}

export interface ListItem {
  id: string;
  label: string;
  icon?: IconDef;
  badge?: string;
  action?: string;
}

export type PanelComponent =
  | { type: 'text'; text: string; muted?: boolean }
  | { type: 'input'; value: string; placeholder?: string }
  | { type: 'button'; label: string; icon?: IconDef; action?: string }
  | { type: 'tree'; nodes: TreeNode[] }
  | { type: 'keyValueList'; items: KeyValueItem[] }
  | { type: 'list'; items: ListItem[] }
  | { type: 'component'; key: string; props?: Record<string, unknown> };

export interface PanelAction {
  source: string;
  action?: string;
  payload?: unknown;
}

export interface PanelSubSection {
  id: string;
  label: string;
  isHeightVariable: boolean;
  minHeight?: number;
  utilities?: PanelUtility[];
  components: PanelComponent[];
}

export interface PanelSection {
  id: string;
  label: string;
  subSections: PanelSubSection[];
}
