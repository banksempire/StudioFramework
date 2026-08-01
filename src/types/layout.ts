import type { IconDef, PanelSection } from './panel';

// ── Layout definition ──────────────────────────────────────────────────────
// Mirrors the shape of src/layout/app.layout.json. The entire UI is built
// from a single JSON file; these types describe its schema.

export interface MenuItemDef {
  id?: string;
  label: string;
  icon?: IconDef;
  accelerator?: string;
  action?: string;    // action id - handled by the host app
  separator?: boolean;
}

export interface MenuDef {
  id: string;
  label: string;
  items: MenuItemDef[];
}

export interface PanelDef {
  title: string;
  sections: PanelSection[];
}

export interface DockerItemDef {
  id: string;
  displayName: string;
  icon: IconDef;
  badge?: string;
  panel: PanelDef;    // panel shown when this tag is active
}

export interface WorkspaceTabDef {
  id: string;
  label: string;
  icon?: IconDef;
  closeable?: boolean;
}

export interface StatusItemDef {
  id?: string;
  label: string;
  icon?: IconDef;
}

export interface LayoutDefinition {
  app: { title: string };
  menu: MenuDef[];
  docker: DockerItemDef[];
  right: PanelDef | null;
  workspace: { tabs: WorkspaceTabDef[] };
  status: { left: StatusItemDef[]; right: StatusItemDef[] };
}
