import type { IconDef, PanelH1 } from './panel';

export interface MenuNodeDef {
  id?: string;
  label?: string;
  icon?: IconDef;
  accelerator?: string;
  action?: string;
  separator?: boolean;
  items?: MenuNodeDef[];
  iconKind?: 'dot' | 'check';
  selected?: boolean;
  detail?: string;
  disabled?: boolean;
  data?: unknown;
}

export interface PanelDef {
  title: string;
  h1: PanelH1[];
}

export interface DockerAppDef {
  id: string;
  displayName: string;
  icon: IconDef;
  badge?: string;
  panel: PanelDef;
}

export interface WorkspaceTabDef {
  id: string;
  label: string;
  icon?: IconDef;
  closeable?: boolean;
  content?: string;
  props?: Record<string, unknown>;
  tabClass?: string;
  transient?: boolean;
}

export interface WorkspaceDef {
  tabs: WorkspaceTabDef[];
  emptyContent?: string;
  minTileWidth?: number;
  minTileHeight?: number;
}

export interface StatusItemDef {
  id?: string;
  label: string;
  icon?: IconDef;
  component?: string;
  bind?: string;
  props?: Record<string, unknown>;
}

export interface TitleBarActionDef {
  id: string;
  icon: IconDef;
  title?: string;
  danger?: boolean;
}

export interface LayoutDefinition {
  framework: { title: string };
  menu: MenuNodeDef[];
  titleBarActions?: TitleBarActionDef[][];
  docker: DockerAppDef[];
  rightPanels?: Record<string, PanelDef>;
  workspace: WorkspaceDef;
  status: { left: StatusItemDef[]; right: StatusItemDef[] };
}
