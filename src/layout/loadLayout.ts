import type {
  DockerAppDef,
  LayoutDefinition,
  MenuNodeDef,
  PanelDef,
  StatusItemDef,
  WorkspaceTabDef,
} from '../types/layout';
import type {
  BadgeTone,
  ButtonVariant,
  DotTone,
  IconDef,
  KeyValueItem,
  PanelComponent,
  PanelComponentBase,
  PanelFormChoice,
  PanelFormRow,
  PanelHeaderAction,
  PanelListButton,
  PanelListItem,
  PanelListOption,
  PanelSection,
  PanelSubSection,
  PanelTableColumn,
  PanelUtility,
  TreeCheckState,
  TreeNode,
} from '../types/panel';
import frameworkJson from './framework.layout.json';

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

function toIcon(v: unknown, path: string): IconDef | undefined {
  if (v === undefined) return undefined;
  if (typeof v === 'string') return v;
  if (isRecord(v) && v.type === 'image' && typeof v.url === 'string') {
    return { type: 'image', url: v.url };
  }
  fail(path, 'icon must be a string (unicode char) or { "type": "image", "url": "..." }');
}

const COMPONENT_TYPES = [
  'text',
  'input',
  'button',
  'tree',
  'keyValueList',
  'list',
  'form',
  'header',
  'banner',
  'table',
  'menuButton',
  'component',
] as const;

const DOT_TONES: readonly DotTone[] = ['muted', 'ok', 'ok-pulse', 'err', 'warn', 'accent'];
const BADGE_TONES: readonly BadgeTone[] = ['ok', 'ok-blink', 'accent', 'accent-soft', 'err', 'muted'];
const BUTTON_VARIANTS: readonly ButtonVariant[] = ['default', 'accent', 'danger', 'ghost'];
const TREE_CHECKS: readonly TreeCheckState[] = ['on', 'mid', 'off'];
const COLUMN_KINDS: readonly NonNullable<PanelTableColumn['kind']>[] = [
  'text',
  'status',
  'time',
  'mono',
  'danger',
];

function optInt(v: unknown, path: string): number | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) fail(path, 'must be a positive number');
  return Math.round(v);
}

function optBool(v: unknown, path: string): boolean | undefined {
  if (v === undefined) return undefined;
  if (typeof v === 'boolean') return v;
  return fail(path, 'expected true or false');
}

function optDotTone(v: unknown, path: string): DotTone | undefined {
  if (v === undefined) return undefined;
  const s = needString(v, path);
  return (DOT_TONES as readonly string[]).includes(s)
    ? (s as DotTone)
    : fail(path, `unknown dot tone "${s}"`);
}

function toListButton(v: unknown, path: string): PanelListButton {
  const r = needRecord(v, path);
  return {
    id: needId(r.id, `${path}.id`),
    icon: toIcon(r.icon, `${path}.icon`) ?? fail(`${path}.icon`, 'button requires an icon'),
    title: optString(r.title, `${path}.title`),
    danger: optBool(r.danger, `${path}.danger`),
    disabled: optBool(r.disabled, `${path}.disabled`),
  };
}

function toListOption(v: unknown, path: string): PanelListOption {
  const r = needRecord(v, path);
  return {
    id: needId(r.id, `${path}.id`),
    label: optString(r.label, `${path}.label`),
    icon: toIcon(r.icon, `${path}.icon`),
    danger: optBool(r.danger, `${path}.danger`),
    disabled: optBool(r.disabled, `${path}.disabled`),
  };
}

function toListItem(v: unknown, path: string): PanelListItem {
  const r = needRecord(v, path);
  const badgeTone = optString(r.badgeTone, `${path}.badgeTone`);
  if (badgeTone !== undefined && !(BADGE_TONES as readonly string[]).includes(badgeTone)) {
    fail(`${path}.badgeTone`, `unknown badge tone "${badgeTone}"`);
  }
  const sw = r.switch === undefined ? undefined : needRecord(r.switch, `${path}.switch`);
  return {
    id: needId(r.id, `${path}.id`),
    label: needString(r.label, `${path}.label`),
    meta: optString(r.meta, `${path}.meta`),
    detail: optString(r.detail, `${path}.detail`),
    note: optString(r.note, `${path}.note`),
    badge: optString(r.badge, `${path}.badge`),
    badgeTone: badgeTone as PanelListItem['badgeTone'],
    dot: optDotTone(r.dot, `${path}.dot`),
    icon: toIcon(r.icon, `${path}.icon`),
    iconBlink: optBool(r.iconBlink, `${path}.iconBlink`),
    title: optString(r.title, `${path}.title`),
    active: optBool(r.active, `${path}.active`),
    muted: optBool(r.muted, `${path}.muted`),
    switch: sw
      ? {
          on: sw.on === true || fail(`${path}.switch.on`, 'expected true or false'),
          title: optString(sw.title, `${path}.switch.title`),
        }
      : undefined,
    buttons:
      r.buttons === undefined
        ? undefined
        : needArray(r.buttons, `${path}.buttons`).map((b, i) => toListButton(b, `${path}.buttons[${i}]`)),
    options:
      r.options === undefined
        ? undefined
        : needArray(r.options, `${path}.options`).map((o, i) => toListOption(o, `${path}.options[${i}]`)),
    action: optString(r.action, `${path}.action`),
    dragType: optString(r.dragType, `${path}.dragType`),
    dragData: optString(r.dragData, `${path}.dragData`),
    dragText: optString(r.dragText, `${path}.dragText`),
  };
}

function toFormChoice(v: unknown, path: string): PanelFormChoice {
  const r = needRecord(v, path);
  return {
    value: needString(r.value, `${path}.value`),
    label: needString(r.label, `${path}.label`),
    title: optString(r.title, `${path}.title`),
  };
}

function toFormRow(v: unknown, path: string): PanelFormRow {
  const r = needRecord(v, path);
  const pills = r.pills === undefined ? undefined : needRecord(r.pills, `${path}.pills`);
  const stepper = r.stepper === undefined ? undefined : needRecord(r.stepper, `${path}.stepper`);
  const sw = r.switch === undefined ? undefined : needRecord(r.switch, `${path}.switch`);
  const noteTone = optString(r.noteTone, `${path}.noteTone`);
  if (noteTone !== undefined && noteTone !== 'muted' && noteTone !== 'error') {
    fail(`${path}.noteTone`, `expected "muted" or "error", got "${noteTone}"`);
  }
  return {
    id: needId(r.id, `${path}.id`),
    label: optString(r.label, `${path}.label`),
    hint: optString(r.hint, `${path}.hint`),
    note: optString(r.note, `${path}.note`),
    noteTone: noteTone as PanelFormRow['noteTone'],
    pills: pills
      ? {
          value: needString(pills.value, `${path}.pills.value`),
          choices: needArray(pills.choices, `${path}.pills.choices`).map((c, i) =>
            toFormChoice(c, `${path}.pills.choices[${i}]`),
          ),
        }
      : undefined,
    stepper: stepper
      ? {
          value: optInt(stepper.value, `${path}.stepper.value`) ?? 0,
          min: optInt(stepper.min, `${path}.stepper.min`),
          max: optInt(stepper.max, `${path}.stepper.max`),
          step: optInt(stepper.step, `${path}.stepper.step`),
          title: optString(stepper.title, `${path}.stepper.title`),
        }
      : undefined,
    switch: sw
      ? {
          on: sw.on === true || fail(`${path}.switch.on`, 'expected true or false'),
          title: optString(sw.title, `${path}.switch.title`),
        }
      : undefined,
    action: optString(r.action, `${path}.action`),
  };
}

function toHeaderAction(v: unknown, path: string): PanelHeaderAction {
  const r = needRecord(v, path);
  const variant = optString(r.variant, `${path}.variant`);
  if (variant !== undefined && !(BUTTON_VARIANTS as readonly string[]).includes(variant)) {
    fail(`${path}.variant`, `unknown variant "${variant}"`);
  }
  return {
    label: optString(r.label, `${path}.label`),
    icon: toIcon(r.icon, `${path}.icon`),
    variant: variant as PanelHeaderAction['variant'],
    title: optString(r.title, `${path}.title`),
    action: optString(r.action, `${path}.action`),
  };
}

function toTableColumn(v: unknown, path: string): PanelTableColumn {
  const r = needRecord(v, path);
  const kind = optString(r.kind, `${path}.kind`);
  if (kind !== undefined && !(COLUMN_KINDS as readonly string[]).includes(kind)) {
    fail(`${path}.kind`, `unknown column kind "${kind}"`);
  }
  const mobile = optString(r.mobile, `${path}.mobile`);
  if (
    mobile !== undefined &&
    mobile !== 'lead' &&
    mobile !== 'sub' &&
    mobile !== 'title' &&
    mobile !== 'hidden'
  ) {
    fail(`${path}.mobile`, `expected "lead", "sub", "title" or "hidden", got "${mobile}"`);
  }
  return {
    key: needId(r.key, `${path}.key`),
    label: needString(r.label, `${path}.label`),
    min: optInt(r.min, `${path}.min`),
    mobile: mobile as PanelTableColumn['mobile'],
    kind: kind as PanelTableColumn['kind'],
    titleKey: optString(r.titleKey, `${path}.titleKey`),
  };
}

function toComponent(v: unknown, path: string): PanelComponent {
  const r = needRecord(v, path);
  const type = needString(r.type, `${path}.type`);
  if (!(COMPONENT_TYPES as readonly string[]).includes(type)) {
    fail(`${path}.type`, `unknown component type "${type}" (expected one of ${COMPONENT_TYPES.join(', ')})`);
  }
  const bind = optString(r.bind, `${path}.bind`);
  const maxHeight = optInt(r.maxHeight, `${path}.maxHeight`);
  let base: PanelComponentBase;
  switch (type) {
    case 'text':
      base = {
        type,
        text: needString(r.text ?? '', `${path}.text`),
        muted: r.muted === true ? true : undefined,
        bind,
      };
      break;
    case 'input':
      base = {
        type,
        value: needString(r.value ?? '', `${path}.value`),
        placeholder: optString(r.placeholder, `${path}.placeholder`),
      };
      break;
    case 'button': {
      const variant = optString(r.variant, `${path}.variant`);
      if (variant !== undefined && !(BUTTON_VARIANTS as readonly string[]).includes(variant)) {
        fail(`${path}.variant`, `unknown variant "${variant}"`);
      }
      base = {
        type,
        label: needString(r.label, `${path}.label`),
        icon: toIcon(r.icon, `${path}.icon`),
        action: optString(r.action, `${path}.action`),
        variant: variant as Extract<PanelComponentBase, { type: 'button' }>['variant'],
        title: optString(r.title, `${path}.title`),
        disabled: optBool(r.disabled, `${path}.disabled`),
        bind,
      };
      break;
    }
    case 'component':
      base = {
        type,
        key: needString(r.key, `${path}.key`),
        props: r.props === undefined ? undefined : needRecord(r.props, `${path}.props`),
      };
      break;
    case 'tree':
      base = {
        type,
        nodes:
          r.nodes === undefined
            ? undefined
            : needArray(r.nodes, `${path}.nodes`).map((n, i) => toTreeNode(n, `${path}.nodes[${i}]`)),
        bind,
        empty: optString(r.empty, `${path}.empty`),
        stateKey: optString(r.stateKey, `${path}.stateKey`),
        expandByDefault: optBool(r.expandByDefault, `${path}.expandByDefault`),
      };
      break;
    case 'keyValueList':
      base = {
        type,
        items:
          r.items === undefined
            ? undefined
            : needArray(r.items, `${path}.items`).map((it, i) => toKeyValueItem(it, `${path}.items[${i}]`)),
        bind,
        empty: optString(r.empty, `${path}.empty`),
      };
      break;
    case 'list': {
      const variant = optString(r.variant, `${path}.variant`);
      if (variant !== undefined && variant !== 'plain' && variant !== 'card') {
        fail(`${path}.variant`, `expected "plain" or "card", got "${variant}"`);
      }
      base = {
        type,
        items:
          r.items === undefined
            ? undefined
            : needArray(r.items, `${path}.items`).map((it, i) => toListItem(it, `${path}.items[${i}]`)),
        bind,
        empty: optString(r.empty, `${path}.empty`),
        variant: variant as 'plain' | 'card',
        dragType: optString(r.dragType, `${path}.dragType`),
        dismissOnActivate: optBool(r.dismissOnActivate, `${path}.dismissOnActivate`),
      };
      break;
    }
    case 'form':
      base = {
        type,
        rows:
          r.rows === undefined
            ? undefined
            : needArray(r.rows, `${path}.rows`).map((row, i) => toFormRow(row, `${path}.rows[${i}]`)),
        bind,
        empty: optString(r.empty, `${path}.empty`),
      };
      break;
    case 'header': {
      const variant = optString(r.variant, `${path}.variant`);
      if (variant !== undefined && variant !== 'plain' && variant !== 'bar') {
        fail(`${path}.variant`, `expected "plain" or "bar", got "${variant}"`);
      }
      base = {
        type,
        bind,
        variant: variant as 'plain' | 'bar',
        dot: optDotTone(r.dot, `${path}.dot`),
        title: optString(r.title, `${path}.title`),
        tip: optString(r.tip, `${path}.tip`),
        sub: optString(r.sub, `${path}.sub`),
        action: r.action === undefined ? undefined : toHeaderAction(r.action, `${path}.action`),
      };
      break;
    }
    case 'banner': {
      const tone = optString(r.tone, `${path}.tone`);
      if (tone !== undefined && tone !== 'info' && tone !== 'error') {
        fail(`${path}.tone`, `expected "info" or "error", got "${tone}"`);
      }
      base = {
        type,
        bind,
        text: optString(r.text, `${path}.text`),
        tone: tone as 'info' | 'error',
      };
      break;
    }
    case 'table':
      base = {
        type,
        bind,
        columns: needArray(r.columns, `${path}.columns`).map((c, i) =>
          toTableColumn(c, `${path}.columns[${i}]`),
        ),
        empty: optString(r.empty, `${path}.empty`),
        resizable: optBool(r.resizable, `${path}.resizable`),
      };
      break;
    case 'menuButton':
      base = {
        type,
        label: needString(r.label, `${path}.label`),
        icon: toIcon(r.icon, `${path}.icon`),
        title: optString(r.title, `${path}.title`),
        items:
          r.items === undefined
            ? undefined
            : needArray(r.items, `${path}.items`).map((m, i) => toMenuNode(m, `${path}.items[${i}]`)),
        bind,
        action: optString(r.action, `${path}.action`),
        disabled: optBool(r.disabled, `${path}.disabled`),
      };
      break;
    default:
      return fail(`${path}.type`, 'unreachable');
  }
  return maxHeight === undefined ? base : { ...base, maxHeight };
}

function toTreeNode(v: unknown, path: string): TreeNode {
  const r = needRecord(v, path);
  const check = optString(r.check, `${path}.check`);
  if (check !== undefined && !(TREE_CHECKS as readonly string[]).includes(check)) {
    fail(`${path}.check`, `expected "on", "mid" or "off", got "${check}"`);
  }
  return {
    id: needId(r.id, `${path}.id`),
    label: needString(r.label, `${path}.label`),
    icon: toIcon(r.icon, `${path}.icon`),
    badge: optString(r.badge, `${path}.badge`),
    title: optString(r.title, `${path}.title`),
    check: check as TreeNode['check'],
    action: optString(r.action, `${path}.action`),
    children:
      r.children === undefined
        ? undefined
        : needArray(r.children, `${path}.children`).map((c, i) => toTreeNode(c, `${path}.children[${i}]`)),
  };
}

function toKeyValueItem(v: unknown, path: string): KeyValueItem {
  const r = needRecord(v, path);
  return {
    key: needString(r.key, `${path}.key`),
    value: r.value === undefined ? undefined : needString(r.value, `${path}.value`),
    pill: optBool(r.pill, `${path}.pill`),
    tone: optString(r.tone, `${path}.tone`),
    header: optBool(r.header, `${path}.header`),
    indent: optInt(r.indent, `${path}.indent`),
    title: optString(r.title, `${path}.title`),
  };
}

function toUtility(v: unknown, path: string): PanelUtility {
  const r = needRecord(v, path);
  return {
    id: needId(r.id, `${path}.id`),
    icon: toIcon(r.icon, `${path}.icon`) ?? fail(`${path}.icon`, 'utility requires an icon'),
    label: optString(r.label, `${path}.label`),
    tooltip: optString(r.tooltip, `${path}.tooltip`),
    closeMobilePanel:
      r.closeMobilePanel === undefined
        ? undefined
        : r.closeMobilePanel === true || fail(`${path}.closeMobilePanel`, 'expected true'),
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
    label: component
      ? r.label === undefined
        ? ''
        : needString(r.label, `${path}.label`)
      : needString(r.label, `${path}.label`),
    icon: toIcon(r.icon, `${path}.icon`),
    component,
    bind: optString(r.bind, `${path}.bind`),
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

function optIntUsedByWorkspace(v: unknown, path: string): number | undefined {
  return optInt(v, path);
}

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
    rightPanels: (() => {
      const src = root.rightPanels;
      if (src === undefined || src === null) return {};
      const rec = needRecord(src, '<root>.rightPanels');
      const out: Record<string, PanelDef> = {};
      for (const key of Object.keys(rec)) {
        out[key] = toPanelDef(rec[key], `<root>.rightPanels[${key}]`);
      }
      return out;
    })(),
    workspace: (() => {
      const ws = needRecord(root.workspace ?? {}, '<root>.workspace');
      return {
        tabs: needArray(ws.tabs ?? [], '<root>.workspace.tabs').map((t, i) =>
          toWorkspaceTab(t, `<root>.workspace.tabs[${i}]`),
        ),
        minTileWidth: optIntUsedByWorkspace(ws.minTileWidth, '<root>.workspace.minTileWidth') ?? 160,
        minTileHeight: optIntUsedByWorkspace(ws.minTileHeight, '<root>.workspace.minTileHeight') ?? 100,
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

export const layout: LayoutDefinition = loadLayout();
