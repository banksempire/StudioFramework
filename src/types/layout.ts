import type { IconDef, PanelSection } from './panel';

// ── Layout definition ──────────────────────────────────────────────────────
// Mirrors the shape of src/layout/framework.layout.json. The entire UI is built
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
  action?: string;          // leaf: action id handled by the framework
  separator?: boolean;
  items?: MenuNodeDef[];    // children (submenu) - same class, one level down
  /** Icon column mode: dot = single-select, check = multi-select. */
  iconKind?: 'dot' | 'check';
  /** Whether the selection indicator (dot/check) is marked. */
  selected?: boolean;
  /** Right-aligned hint text (e.g. "thinking", "~8k tokens"). */
  detail?: string;
  disabled?: boolean;
  /** Opaque payload for app-specific leaf actions. */
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
  panel: PanelDef;    // panel shown when this app is active
}

export interface WorkspaceTabDef {
  id: string;
  label: string;
  icon?: IconDef;
  closeable?: boolean;
  /** content renderer hint, e.g. "welcome" — resolved via the tab-content registry */
  content?: string;
  /** props passed to the content renderer component */
  props?: Record<string, unknown>;
  /**
   * Extra CSS class(es) applied to the tab element. Host apps use this for
   * per-tab visual state (e.g. a dimmed "preview" tab) — the framework only
   * applies the string, it never styles it.
   */
  tabClass?: string;
  /**
   * Transient tabs (host-app previews, e.g. a review window) are excluded
   * from workspace snapshots — they never persist into the auto-saved
   * layout or a saved workspace, and their tile collapses away if nothing
   * else is left in it.
   */
  transient?: boolean;
}

export interface WorkspaceDef {
  tabs: WorkspaceTabDef[];
  /** tab-content key rendered inside a tile that has no tabs open (e.g. a
   *  welcome page) instead of the generic empty hint */
  emptyContent?: string;
  /** smallest size a tile may shrink to while resizing */
  minTileWidth?: number;
  minTileHeight?: number;
}

export interface StatusItemDef {
  id?: string;
  label: string;
  icon?: IconDef;
  /**
   * Registered status-bar component (see registerStatusComponent) rendered
   * instead of the static icon+label — for live indicators (connectivity…).
   * Props come from `props`.
   */
  component?: string;
  props?: Record<string, unknown>;
}

export interface LayoutDefinition {
  framework: { title: string };
  menu: MenuNodeDef[];      // top-level menus - same class as any submenu
  docker: DockerAppDef[];
  right: PanelDef | null;
  workspace: WorkspaceDef;
  status: { left: StatusItemDef[]; right: StatusItemDef[] };
}
