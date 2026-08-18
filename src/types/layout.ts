import type { IconDef, PanelSection } from './panel';

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
  sections: PanelSection[];
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
  props?: Record<string, unknown>;
}

export interface LayoutDefinition {
  framework: { title: string };
  menu: MenuNodeDef[];
  docker: DockerAppDef[];
  right: PanelDef | null;
  workspace: WorkspaceDef;
  status: { left: StatusItemDef[]; right: StatusItemDef[] };
}
