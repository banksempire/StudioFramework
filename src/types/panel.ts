// ── Top-level panel payload ────────────────────────────────────────────────

export interface PanelPayload {
  /** Display name shown in the title bar */
  title: string;

  /** Tabbed groups of sub-sections */
  sections: PanelSection[];
}

// ── Section ─────────────────────────────────────────────────────────────────

export interface PanelSection {
  /** Unique id for this section */
  id: string;

  /** Label shown on the section tab */
  label: string;

  /** Collapsible groups within this section */
  subSections: PanelSubSection[];
}

// ── Sub-section ─────────────────────────────────────────────────────────────

export interface PanelSubSection {
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

export interface ActionButton {
  /** Unique id used to dispatch click events */
  id: string;

  /** Unicode icon or icon class */
  icon: string;

  /** Hover tooltip */
  tooltip?: string;
}

// ── Component (discriminated union) ─────────────────────────────────────────

export type PanelComponent =
  | TreeComponent
  | TableComponent
  | KeyValueListComponent
  | SliderComponent
  | DropdownComponent
  | TextBoxComponent
  | CheckboxComponent
  | ButtonComponent
  | LabelComponent;

export interface TreeComponent {
  type: 'tree';
  id: string;
  contents: TreeNode[];
}

export interface TreeNode {
  id: string;
  label: string;
  icon?: string;
  children?: TreeNode[];
  expanded?: boolean;
}

export interface TableComponent {
  type: 'table';
  id: string;
  contents: {
    columns: { key: string; label: string }[];
    rows: Record<string, unknown>[];
  };
}

export interface KeyValueListComponent {
  type: 'keyValueList';
  id: string;
  contents: { key: string; value: unknown; readOnly?: boolean }[];
}

export interface SliderComponent {
  type: 'slider';
  id: string;
  contents: { min: number; max: number; step?: number; value: number; label?: string };
}

export interface DropdownComponent {
  type: 'dropdown';
  id: string;
  contents: { options: string[]; value: string; label?: string };
}

export interface TextBoxComponent {
  type: 'textBox';
  id: string;
  contents: { value: string; placeholder?: string; label?: string };
}

export interface CheckboxComponent {
  type: 'checkbox';
  id: string;
  contents: { checked: boolean; label: string };
}

export interface ButtonComponent {
  type: 'button';
  id: string;
  contents: { label: string; variant?: 'primary' | 'secondary' };
}

export interface LabelComponent {
  type: 'label';
  id: string;
  contents: { text: string };
}
