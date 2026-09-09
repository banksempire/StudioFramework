import type { MenuNodeDef } from './layout';

export type IconDef = string | { type: 'image'; url: string };

export interface PanelUtility {
  id: string;
  icon: IconDef;
  label?: string;
  tooltip?: string;
  closeMobilePanel?: boolean;
}

export type TreeCheckState = 'on' | 'mid' | 'off';

export interface TreeNode {
  id: string;
  label: string;
  icon?: IconDef;
  children?: TreeNode[];
  badge?: string;
  title?: string;
  check?: TreeCheckState;
  action?: string;
}

export interface KeyValueItem {
  key: string;
  value?: string | number;
  pill?: boolean;
  tone?: string;
  header?: boolean;
  indent?: number;
  title?: string;
}

export type DotTone = 'muted' | 'ok' | 'ok-pulse' | 'err' | 'warn' | 'accent';

export type BadgeTone = 'ok' | 'ok-blink' | 'accent' | 'accent-soft' | 'err' | 'muted';

export interface PanelListButton {
  id: string;
  icon: IconDef;
  title?: string;
  danger?: boolean;
  disabled?: boolean;
}

export interface PanelListOption {
  id: string;
  label?: string;
  icon?: IconDef;
  danger?: boolean;
  disabled?: boolean;
}

export interface PanelListItemSwitch {
  on: boolean;
  title?: string;
}

export interface PanelListItem {
  id: string;
  label: string;
  meta?: string;
  detail?: string;
  note?: string;
  badge?: string;
  badgeTone?: BadgeTone;
  dot?: DotTone;
  icon?: IconDef;
  iconBlink?: boolean;
  title?: string;
  active?: boolean;
  muted?: boolean;
  switch?: PanelListItemSwitch;
  buttons?: PanelListButton[];
  options?: PanelListOption[];
  action?: string;
  dragType?: string;
  dragData?: string;
}

export interface PanelListData {
  items: PanelListItem[];
  empty?: string;
}

export interface PanelFormChoice {
  value: string;
  label: string;
  title?: string;
}

export interface PanelFormRowControl {
  pills?: { value: string; choices: PanelFormChoice[] };
  stepper?: { value: number; min?: number; max?: number; step?: number; title?: string };
  switch?: { on: boolean; title?: string };
}

export interface PanelFormRow extends PanelFormRowControl {
  id: string;
  label?: string;
  hint?: string;
  note?: string;
  noteTone?: 'muted' | 'error';
  action?: string;
}

export interface PanelFormData {
  rows: PanelFormRow[];
  empty?: string;
}

export interface PanelHeaderData {
  dot?: DotTone;
  title?: string;
  tip?: string;
  sub?: string;
  disabled?: boolean;
}

export interface PanelHeaderAction {
  label?: string;
  icon?: IconDef;
  variant?: 'default' | 'accent' | 'danger';
  title?: string;
  action?: string;
}

export interface PanelBannerData {
  text?: string;
  tone?: 'info' | 'error';
}

export interface PanelTableColumn {
  key: string;
  label: string;
  min?: number;
  mobile?: 'lead' | 'sub' | 'title' | 'hidden';
  kind?: 'text' | 'status' | 'time' | 'mono' | 'danger';
  titleKey?: string;
}

export interface PanelTableRow {
  id: string;
  cells: Record<string, string>;
  titles?: Record<string, string>;
}

export interface PanelTableData {
  rows: PanelTableRow[];
  empty?: string;
  note?: string;
  noteTone?: 'muted' | 'error';
}

export type ButtonVariant = 'default' | 'accent' | 'danger' | 'ghost';

export interface ButtonData {
  label?: string;
  icon?: IconDef;
  disabled?: boolean;
  title?: string;
}

export type PanelComponentBase =
  | { type: 'text'; text: string; muted?: boolean; bind?: string }
  | { type: 'input'; value: string; placeholder?: string }
  | {
      type: 'button';
      label: string;
      icon?: IconDef;
      action?: string;
      variant?: ButtonVariant;
      title?: string;
      disabled?: boolean;
      bind?: string;
    }
  | {
      type: 'tree';
      nodes?: TreeNode[];
      bind?: string;
      empty?: string;
      stateKey?: string;
      expandByDefault?: boolean;
    }
  | { type: 'keyValueList'; items?: KeyValueItem[]; bind?: string; empty?: string }
  | {
      type: 'list';
      items?: PanelListItem[];
      bind?: string;
      empty?: string;
      variant?: 'plain' | 'card';
      dragType?: string;
      dismissOnActivate?: boolean;
    }
  | {
      type: 'form';
      rows?: PanelFormRow[];
      bind?: string;
      empty?: string;
    }
  | {
      type: 'header';
      bind?: string;
      variant?: 'plain' | 'bar';
      dot?: DotTone;
      title?: string;
      tip?: string;
      sub?: string;
      action?: PanelHeaderAction;
    }
  | { type: 'banner'; bind?: string; text?: string; tone?: 'info' | 'error' }
  | {
      type: 'table';
      bind?: string;
      columns: PanelTableColumn[];
      empty?: string;
      resizable?: boolean;
    }
  | {
      type: 'menuButton';
      label: string;
      icon?: IconDef;
      title?: string;
      items?: MenuNodeDef[];
      bind?: string;
      action?: string;
      disabled?: boolean;
    }
  | { type: 'component'; key: string; props?: Record<string, unknown> };

export type PanelComponent = PanelComponentBase & { maxHeight?: number };

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
