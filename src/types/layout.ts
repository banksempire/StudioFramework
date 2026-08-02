import type { IconDef, PanelSection } from './panel';

// ── Layout definition ──────────────────────────────────────────────────────
// Mirrors the shape of src/layout/app.layout.json. The entire UI is built
// from a single JSON file; these types describe its schema.

/**
 * A menu node - one class for every level:
 * - top-level menu in the bar: { id, label, items }
 * - submenu parent:            { label, items }
 * - leaf item:                 { label, action }
 * - separator:                 { separator: true }
 * `items` is recursive, so nesting depth is unlimited.
 */
export interface MenuNodeDef {
  id?: string;
  label?: string;
  icon?: IconDef;
  accelerator?: string;
  action?: string;          // leaf: action id handled by the host app
  separator?: boolean;
  items?: MenuNodeDef[];    // children (submenu) - same class, one level down
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
  menu: MenuNodeDef[];      // top-level menus - same class as any submenu
  docker: DockerItemDef[];
  right: PanelDef | null;
  workspace: { tabs: WorkspaceTabDef[] };
  status: { left: StatusItemDef[]; right: StatusItemDef[] };
}
