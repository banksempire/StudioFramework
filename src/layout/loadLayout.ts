import type {
  DockerAppDef,
  LayoutDefinition,
  MenuNodeDef,
  PanelDef,
  StatusItemDef,
  WorkspaceTabDef,
} from '../types/layout';
import type {
  IconDef,
  PanelComponent,
  PanelSection,
  PanelSubSection,
  PanelUtility,
  TreeNode,
} from '../types/panel';
import frameworkJson from './framework.layout.json';

// ── Validation helpers ─────────────────────────────────────────────────────

let sourceLabel = 'framework.layout.json';

function fail(path: string, msg: string): never {
  throw new Error(`${sourceLabel}: ${path}: ${msg}`);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function needRecord(v: unknown, path: string): Record<string, unknown> {
  if (!isRecord(v)) fail(path, 'expected an object');
  return v;
}

function needArray(v: unknown, path: string): unknown[] {
  if (!Array.isArray(v)) fail(path, 'expected an array');
  return v;
}

function needString(v: unknown, path: string): string {
  if (typeof v !== 'string') fail(path, 'expected a string');
  return v;
}

function optString(v: unknown, path: string): string | undefined {
  if (v === undefined) return undefined;
  return needString(v, path);
}

function needId(v: unknown, path: string): string {
  const s = needString(v, path);
  if (!s.trim()) fail(path, 'id must be non-empty');
  return s;
}

// ── Icon ───────────────────────────────────────────────────────────────────

function toIcon(v: unknown, path: string): IconDef | undefined {
  if (v === undefined) return undefined;
  if (typeof v === 'string') return v;
  if (isRecord(v) && v.type === 'image' && typeof v.url === 'string') {
    return { type: 'image', url: v.url };
  }
  fail(path, 'icon must be a string (unicode char) or { "type": "image", "url": "..." }');
}

// ── Components / sub-sections / sections ───────────────────────────────────

const COMPONENT_TYPES = ['text', 'input', 'button', 'tree', 'keyValueList', 'list', 'component'] as const;

function toTreeNode(v: unknown, path: string): TreeNode {
  const r = needRecord(v, path);
  return {
    id: needId(r.id, `${path}.id`),
    label: needString(r.label, `${path}.label`),
    icon: toIcon(r.icon, `${path}.icon`),
    badge: optString(r.badge, `${path}.badge`),
    action: optString(r.action, `${path}.action`),
    children:
      r.children === undefined
        ? undefined
        : needArray(r.children, `${path}.children`).map((c, i) => toTreeNode(c, `${path}.children[${i}]`)),
  };
}

function toComponent(v: unknown, path: string): PanelComponent {
  const r = needRecord(v, path);
  const type = needString(r.type, `${path}.type`);
  if (!(COMPONENT_TYPES as readonly string[]).includes(type)) {
    fail(`${path}.type`, `unknown component type "${type}" (expected one of ${COMPONENT_TYPES.join(', ')})`);
  }
  switch (type) {
    case 'text':
      return { type, text: needString(r.text, `${path}.text`), muted: r.muted === true ? true : undefined };
    case 'input':
      return {
        type,
        value: needString(r.value ?? '', `${path}.value`),
        placeholder: optString(r.placeholder, `${path}.placeholder`),
      };
    case 'button':
      return {
        type,
        label: needString(r.label, `${path}.label`),
        icon: toIcon(r.icon, `${path}.icon`),
        action: optString(r.action, `${path}.action`),
      };
    case 'component':
      return {
        type,
        key: needString(r.key, `${path}.key`),
        props: r.props === undefined ? undefined : needRecord(r.props, `${path}.props`),
      };
    case 'tree':
      return {
        type,
        nodes: needArray(r.nodes, `${path}.nodes`).map((n, i) => toTreeNode(n, `${path}.nodes[${i}]`)),
      };
    case 'keyValueList':
      return {
        type,
        items: needArray(r.items, `${path}.items`).map((it, i) => {
          const ir = needRecord(it, `${path}.items[${i}]`);
          return {
            key: needString(ir.key, `${path}.items[${i}].key`),
            value: needString(ir.value, `${path}.items[${i}].value`),
          };
        }),
      };
    case 'list':
      return {
        type,
        items: needArray(r.items, `${path}.items`).map((it, i) => {
          const ir = needRecord(it, `${path}.items[${i}]`);
          return {
            id: needId(ir.id, `${path}.items[${i}].id`),
            label: needString(ir.label, `${path}.items[${i}].label`),
            icon: toIcon(ir.icon, `${path}.items[${i}].icon`),
            badge: optString(ir.badge, `${path}.items[${i}].badge`),
            action: optString(ir.action, `${path}.items[${i}].action`),
          };
        }),
      };
    default:
      return fail(`${path}.type`, 'unreachable');
  }
}

function toUtility(v: unknown, path: string): PanelUtility {
  const r = needRecord(v, path);
  return {
    id: needId(r.id, `${path}.id`),
    icon: toIcon(r.icon, `${path}.icon`) ?? fail(`${path}.icon`, 'utility requires an icon'),
    tooltip: optString(r.tooltip, `${path}.tooltip`),
  };
}

function toSubSection(v: unknown, path: string): PanelSubSection {
  const r = needRecord(v, path);
  const height = optString(r.height, `${path}.height`) ?? 'fixed';
  if (height !== 'fixed' && height !== 'variable') {
    fail(`${path}.height`, `expected "fixed" or "variable", got "${height}"`);
  }
  return {
    id: needId(r.id, `${path}.id`),
    label: needString(r.label, `${path}.label`),
    isHeightVariable: height === 'variable',
    minHeight:
      r.minHeight === undefined
        ? undefined
        : typeof r.minHeight === 'number'
          ? r.minHeight
          : fail(`${path}.minHeight`, 'expected a number'),
    utilities:
      r.utilities === undefined
        ? undefined
        : needArray(r.utilities, `${path}.utilities`).map((u, i) => toUtility(u, `${path}.utilities[${i}]`)),
    components: needArray(r.components, `${path}.components`).map((c, i) =>
      toComponent(c, `${path}.components[${i}]`),
    ),
  };
}

function toSection(v: unknown, path: string): PanelSection {
  const r = needRecord(v, path);
  return {
    id: needId(r.id, `${path}.id`),
    label: needString(r.label, `${path}.label`),
    subSections: needArray(r.subSections, `${path}.subSections`).map((s, i) =>
      toSubSection(s, `${path}.subSections[${i}]`),
    ),
  };
}

function toPanelDef(v: unknown, path: string): PanelDef {
  const r = needRecord(v, path);
  return {
    title: needString(r.title, `${path}.title`),
    sections: needArray(r.sections, `${path}.sections`).map((s, i) => toSection(s, `${path}.sections[${i}]`)),
  };
}

// ── Menu (one recursive node class for all levels) ─────────────────────────

function toMenuNode(v: unknown, path: string): MenuNodeDef {
  const r = needRecord(v, path);
  if (r.separator === true) return { separator: true };
  return {
    id: optString(r.id, `${path}.id`),
    label: needString(r.label, `${path}.label`),
    icon: toIcon(r.icon, `${path}.icon`),
    accelerator: optString(r.accelerator, `${path}.accelerator`),
    action: optString(r.action, `${path}.action`),
    items:
      r.items === undefined
        ? undefined
        : needArray(r.items, `${path}.items`).map((s, i) => toMenuNode(s, `${path}.items[${i}]`)),
  };
}

function toDockerApp(v: unknown, path: string): DockerAppDef {
  const r = needRecord(v, path);
  return {
    id: needId(r.id, `${path}.id`),
    displayName: needString(r.displayName, `${path}.displayName`),
    icon: toIcon(r.icon, `${path}.icon`) ?? fail(`${path}.icon`, 'docker app requires an icon'),
    badge: optString(r.badge, `${path}.badge`),
    panel: toPanelDef(r.panel, `${path}.panel`),
  };
}

function toStatusItem(v: unknown, path: string): StatusItemDef {
  const r = needRecord(v, path);
  const component = optString(r.component, `${path}.component`);
  return {
    id: optString(r.id, `${path}.id`),
    // A component item needs no static label (it renders itself).
    label: component
      ? r.label === undefined
        ? ''
        : needString(r.label, `${path}.label`)
      : needString(r.label, `${path}.label`),
    icon: toIcon(r.icon, `${path}.icon`),
    component,
    props: r.props === undefined ? undefined : needRecord(r.props, `${path}.props`),
  };
}

function toWorkspaceTab(v: unknown, path: string): WorkspaceTabDef {
  const r = needRecord(v, path);
  return {
    id: needId(r.id, `${path}.id`),
    label: needString(r.label, `${path}.label`),
    icon: toIcon(r.icon, `${path}.icon`),
    closeable: r.closeable === undefined ? undefined : r.closeable === true,
    content: optString(r.content, `${path}.content`),
    props: r.props === undefined ? undefined : needRecord(r.props, `${path}.props`),
  };
}

function optInt(v: unknown, path: string): number | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) fail(path, 'must be a positive number');
  return Math.round(v);
}

// ── Root ───────────────────────────────────────────────────────────────────

/**
 * Validate a layout definition object and normalize it into the typed
 * LayoutDefinition. `label` is used in error messages only.
 * No argument = the framework's bundled demo layout.
 */
export function loadLayout(json: unknown = frameworkJson, label = 'framework.layout.json'): LayoutDefinition {
  sourceLabel = label;
  const root = needRecord(json, '<root>');

  const menu = needArray(root.menu ?? [], '<root>.menu').map((m, i) => toMenuNode(m, `<root>.menu[${i}]`));
  const docker = needArray(root.docker ?? [], '<root>.docker').map((d, i) =>
    toDockerApp(d, `<root>.docker[${i}]`),
  );
  if (docker.length === 0) fail('<root>.docker', 'at least one docker item is required');

  return {
    framework: {
      title: needString(
        needRecord(root.framework ?? {}, '<root>.framework').title ?? 'Studio Framework',
        '<root>.framework.title',
      ),
    },
    menu,
    docker,
    right: root.right === undefined || root.right === null ? null : toPanelDef(root.right, '<root>.right'),
    workspace: (() => {
      const ws = needRecord(root.workspace ?? {}, '<root>.workspace');
      return {
        tabs: needArray(ws.tabs ?? [], '<root>.workspace.tabs').map((t, i) =>
          toWorkspaceTab(t, `<root>.workspace.tabs[${i}]`),
        ),
        minTileWidth: optInt(ws.minTileWidth, '<root>.workspace.minTileWidth') ?? 160,
        minTileHeight: optInt(ws.minTileHeight, '<root>.workspace.minTileHeight') ?? 100,
        emptyContent: optString(ws.emptyContent, '<root>.workspace.emptyContent'),
      };
    })(),
    status: (() => {
      const st = needRecord(root.status ?? {}, '<root>.status');
      return {
        left: needArray(st.left ?? [], '<root>.status.left').map((s, i) =>
          toStatusItem(s, `<root>.status.left[${i}]`),
        ),
        right: needArray(st.right ?? [], '<root>.status.right').map((s, i) =>
          toStatusItem(s, `<root>.status.right[${i}]`),
        ),
      };
    })(),
  };
}

/** The single layout for the framework - loaded once at startup. */
export const layout: LayoutDefinition = loadLayout();
