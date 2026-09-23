import type { MenuNodeDef } from './layout';
import type { PopupField, PopupValues } from './popup';

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
  detailMeta?: string;
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
  dragText?: string;
}

export interface PanelListData {
  items: PanelListItem[];
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
  | {
      type: 'input';
      value?: string;
      key?: string;
      action?: string;
      placeholder?: string;
      mono?: boolean;
      disabled?: boolean;
      spellcheck?: boolean;
      bind?: string;
    }
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
      fields?: PopupField[];
      values?: PopupValues;
      bind?: string;
      empty?: string;
      action?: string;
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

export type PanelHeading = 2 | 3;

export interface PanelSection {
  id: string;
  title: string;
  heading?: PanelHeading;
  isHeightVariable: boolean;
  minHeight?: number;
  utilities?: PanelUtility[];
  components: PanelComponent[];
}

export interface PanelGroup {
  id: string;
  title: string;
  sections: PanelSection[];
}
