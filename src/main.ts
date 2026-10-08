import { createApp, reactive } from 'vue';
import DialogDemo from './components/DialogDemo.vue';
import SelectorDemo from './components/SelectorDemo.vue';
import SingleMenuDemo from './components/SingleMenuDemo.vue';
import TableDemo from './components/TableDemo.vue';
import WelcomeContent from './components/WelcomeContent.vue';
import WorkspacePanel from './components/WorkspacePanel.vue';
import type { WorkspaceApi } from './composables/useWorkspace';
import Framework, { type FrameworkAction } from './Framework.vue';
import {
  registerPanelComponent,
  registerPanelData,
  registerTabContent,
  registerUtilityMenu,
} from './registry';
import type { PanelListItem, TreeNode } from './types/panel';
import type { PopupField, PopupValues } from './types/popup';

registerTabContent('welcome', WelcomeContent);

registerTabContent('table-demo', TableDemo);

registerPanelComponent('workspace-panel', WorkspacePanel);

registerPanelComponent('single-menu-demo', SingleMenuDemo);

registerPanelComponent('selector-demo', SelectorDemo);

registerPanelComponent('dialog-demo', DialogDemo);

const demoFilter = reactive({ sources: true, assets: true });
registerUtilityMenu('demo-filter', () => [
  { id: 'sources', label: 'Sources', iconKind: 'check', selected: demoFilter.sources },
  { id: 'assets', label: 'Assets', iconKind: 'check', selected: demoFilter.assets },
]);

const demo = reactive({
  count: 2,
  pinned: true,
  enabled: false,
  level: 'medium',
  caps: 3,
  rowLabel: 'demo row',
  scope: 'workspace',
  when: '',
  typed: '',
  treeChecked: new Set<string>(['src']),
  note: 'demo banner — click rows and controls',
});

registerPanelData('demo-list', () => {
  const items: PanelListItem[] = [
    {
      id: 'demo-1',
      label: 'First demo row',
      meta: '2m',
      badge: 'live',
      badgeTone: 'ok',
      detail: 'rows carry badges, meta and menus',
      dot: 'ok-pulse',
      title: 'Open demo row: First demo row',
      action: 'demo-open',
      options: [
        { id: 'pin', label: demo.pinned ? 'Unpin' : 'Pin', icon: 'pin' },
        { id: 'delete', label: 'Delete', icon: '🗑', danger: true },
      ],
      dragType: 'application/x-sf-demo',
    },
    {
      id: 'demo-2',
      label: 'Second demo row',
      meta: '1h',
      icon: '⏳',
      iconBlink: true,
      detail: 'icons can blink; dots pulse',
      active: true,
      action: 'demo-open',
      options: [{ id: 'pin', label: 'Pin', icon: 'pin' }],
    },
  ];
  for (let i = 3; i <= demo.count; i += 1) {
    items.push({
      id: `demo-${i}`,
      label: `Added row ${i}`,
      detail: 'added from the header action button',
      action: 'demo-open',
      muted: true,
    });
  }
  return { items, draggable: true };
});

const bulkDemo = reactive({
  tasks: [
    { id: 'alpha', name: 'alpha.log', size: '12 KB', hidden: 'zeta', pinned: false },
    { id: 'bravo', name: 'bravo.csv', size: '4 MB', hidden: 'yankee', pinned: false },
    { id: 'charlie', name: 'charlie.txt', size: '318 B', hidden: 'xray', pinned: true },
    { id: 'delta', name: 'delta.json', size: '88 KB', hidden: 'whiskey', pinned: false },
    { id: 'echo', name: 'echo.ndjson', size: '1.2 MB', hidden: 'victor', pinned: false },
  ],
  on: false,
  selected: [] as string[],
});

const fieldsDemo = reactive({
  rows: [
    { id: 'tick', label: 'Tick', hidden: false },
    { id: 'book', label: 'Book', hidden: false },
  ],
  added: 0,
});

registerPanelData('fields-demo', () => ({
  empty: 'No fields — add one below',
  items: fieldsDemo.rows.map((r) => ({
    id: r.id,
    label: r.label,
    muted: r.hidden,
    action: 'fields-demo-row',
    buttons: [
      { id: 'options', label: 'Options', visibility: 'mobile' },
      { id: 'delete', icon: '✕', title: 'Delete', danger: true },
    ],
    options: [{ id: r.hidden ? 'show' : 'hide', label: r.hidden ? 'Show' : 'Hide' }],
    lines: [{ text: r.hidden ? 'hidden on the table' : 'visible on the table', meta: r.id }],
    dragType: 'application/x-fields-demo',
  })),
  footer: { id: 'add', label: 'Add', action: 'fields-demo-add' },
}));

registerPanelData('bulk-demo', () => {
  const n = bulkDemo.selected.length;
  return {
    searchable: true,
    items: bulkDemo.tasks.map((t) => ({
      id: t.id,
      label: t.name,
      meta: t.size,
      detail: t.pinned ? 'pinned' : 'task',
      search: t.hidden,
      action: 'bulk-demo-open',
      options: [{ id: 'remove', label: 'Remove', icon: '🗑', danger: true }],
    })),
    bulk: {
      active: bulkDemo.on,
      selected: bulkDemo.selected,
      entry: { id: 'edit', icon: '✎', tooltip: 'Edit' },
      done: { id: 'done', icon: '✓', tooltip: 'Done' },
      actions: [
        { id: 'pin', icon: 'pin', tooltip: 'Pin', disabled: n === 0 },
        { id: 'delete', icon: '🗑', tooltip: 'Delete', danger: true, disabled: n === 0 },
      ],
    },
  };
});

registerPanelData('demo-cards', () => [
  {
    id: 'card-1',
    label: 'card rows bundle a switch, detail and note',
    detail: '(UTC) 09:00-17:00',
    note: 'notes wrap a third muted line',
    switch: { on: demo.enabled, title: 'Toggle card' },
    buttons: [
      { id: 'edit', icon: '✎', title: 'Edit card' },
      { id: 'delete', icon: '✕', title: 'Delete card', danger: true },
    ],
    action: 'demo-card',
    muted: !demo.enabled,
  },
]);

registerPanelData('demo-form', () => ({
  fields: [
    {
      key: 'level',
      type: 'pills',
      label: 'Effort',
      options: [
        { value: 'low', label: 'Low' },
        { value: 'medium', label: 'Medium' },
        { value: 'high', label: 'High' },
      ],
    },
    { key: 'caps', type: 'stepper', label: 'Concurrency', min: 1, max: 10, labelNote: 'Demo cap' },
    { key: 'pinned', type: 'switch', label: 'Pinned', labelNote: 'Toggle pin' },
    { key: 'rowLabel', type: 'input', label: 'Row label', placeholder: 'label for the next row' },
    {
      key: 'scope',
      type: 'select',
      label: 'Scope',
      options: [
        { value: 'file', label: 'File' },
        { value: 'folder', label: 'Folder' },
        { value: 'workspace', label: 'Workspace' },
      ],
    },
    { key: 'when', type: 'datetime-local', label: 'Starts at' },
    { key: 'add', type: 'button', label: 'Add demo row', variant: 'accent', action: 'demo-add' },
    { key: 'note', type: 'info', text: demo.note },
  ] satisfies PopupField[],
  values: {
    level: demo.level,
    caps: demo.caps,
    pinned: demo.pinned,
    rowLabel: demo.rowLabel,
    scope: demo.scope,
    when: demo.when,
  } satisfies PopupValues,
}));

registerPanelData('demo-header', () => ({
  dot: demo.enabled ? 'ok-pulse' : 'muted',
  title: demo.enabled ? 'demo header — running' : 'demo header — idle',
  tip: 'headers pair a status dot with a title',
}));

registerPanelData('demo-banner', () => demo.note);

registerPanelData('demo-input', () => ({ value: demo.typed }));

const demoTree: TreeNode[] = [
  {
    id: 'src',
    label: 'src',
    children: [
      { id: 'src/a.ts', label: 'a.ts', badge: '3' },
      { id: 'src/b.ts', label: 'b.ts', badge: '1' },
    ],
  },
  {
    id: 'docs',
    label: 'docs',
    children: [{ id: 'docs/readme.md', label: 'readme.md' }],
  },
];

function checkOf(id: string): 'on' | 'mid' | 'off' {
  if (demo.treeChecked.has(id)) return 'on';
  const node = demoTree.find((n) => n.id === id);
  if (!node?.children?.length) return 'off';
  return node.children.some((c) => demo.treeChecked.has(c.id)) ? 'mid' : 'off';
}

registerPanelData('demo-tree', () =>
  demoTree.map((n) => ({
    ...n,
    title: `Filter demo tree under ${n.id}`,
    check: checkOf(n.id),
    action: 'demo-tree-node',
    children: n.children?.map((c) => ({
      ...c,
      title: `Filter demo tree under ${c.id}`,
      check: checkOf(c.id),
      action: 'demo-tree-node',
    })),
  })),
);

registerPanelData('demo-table', () => ({
  rows: [
    {
      id: 'r1',
      cells: { status: 'ok', time: '12:01', who: 'ada' },
      titles: { time: 'queued 12:01:00' },
    },
    {
      id: 'r2',
      cells: { status: 'error', time: '12:04', who: 'grace' },
      titles: { time: 'queued 12:04:30' },
    },
    {
      id: 'r3',
      cells: { status: 'skipped', time: '12:09', who: 'linus' },
      titles: { time: 'queued 12:09:12' },
    },
  ],
  empty: 'no demo runs',
}));

registerPanelData('demo-kv', () => [
  { key: 'General', header: true },
  { key: 'Name', value: 'demo', indent: 1, title: 'full-demo-name' },
  { key: 'Owner', value: 'framework', indent: 1 },
  { key: 'Limits', header: true },
  { key: 'CPU', value: '2', indent: 1 },
  { key: 'Memory', value: '4 GiB', indent: 1 },
  { key: 'State', value: 'running', pill: true, tone: 'ok', indent: 1 },
]);

registerPanelData('demo-menu', () => [
  {
    id: 'demo-low',
    label: 'Low effort',
    iconKind: 'dot',
    selected: demo.level === 'low',
    data: { level: 'low' },
  },
  {
    id: 'demo-medium',
    label: 'Medium effort',
    iconKind: 'dot',
    selected: demo.level === 'medium',
    data: { level: 'medium' },
  },
  {
    id: 'demo-high',
    label: 'High effort',
    iconKind: 'dot',
    selected: demo.level === 'high',
    data: { level: 'high' },
  },
]);

function onAction(e: FrameworkAction) {
  if (e.source === 'panel' && e.action === 'bulk') {
    const p = e.payload as {
      gesture?: string;
      option?: string;
      selected?: string[];
      from?: string;
      to?: string;
    };
    if (p.gesture === 'entry') {
      bulkDemo.on = true;
      bulkDemo.selected = [];
    } else if (p.gesture === 'toggle') {
      bulkDemo.selected = p.selected ?? [];
    } else if (p.gesture === 'reorder' && p.from && p.to) {
      const ids = bulkDemo.tasks.map((t) => t.id);
      const from = ids.indexOf(p.from);
      const to = ids.indexOf(p.to);
      if (from >= 0 && to >= 0 && from !== to) {
        ids.splice(to, 0, ids.splice(from, 1)[0]);
        const byId = new Map(bulkDemo.tasks.map((t) => [t.id, t]));
        bulkDemo.tasks = ids.map((id) => byId.get(id) as (typeof bulkDemo.tasks)[number]);
      }
    } else if (p.gesture === 'action' && p.option === 'done') {
      bulkDemo.on = false;
      bulkDemo.selected = [];
    } else if (p.gesture === 'action' && p.option === 'pin') {
      bulkDemo.tasks = bulkDemo.tasks.map((t) =>
        bulkDemo.selected.includes(t.id) ? { ...t, pinned: true } : t,
      );
    } else if (p.gesture === 'action' && p.option === 'delete') {
      bulkDemo.tasks = bulkDemo.tasks.filter((t) => !bulkDemo.selected.includes(t.id));
      bulkDemo.selected = [];
    }
    return;
  }
  if (e.source === 'panel' && e.action === 'fields-demo-add') {
    fieldsDemo.added += 1;
    const id = `extra-${fieldsDemo.added}`;
    fieldsDemo.rows = [...fieldsDemo.rows, { id, label: `Field ${fieldsDemo.added}`, hidden: false }];
    return;
  }
  if (e.source === 'panel' && e.action === 'fields-demo-row') {
    const p = e.payload as {
      gesture?: string;
      id?: string;
      option?: string;
      button?: string;
      x?: number;
      y?: number;
      open?: (x: number, y: number) => void;
    };
    if (p.gesture === 'menu' && p.id && (p.option === 'show' || p.option === 'hide')) {
      fieldsDemo.rows = fieldsDemo.rows.map((r) =>
        r.id === p.id ? { ...r, hidden: p.option === 'hide' } : r,
      );
    } else if (p.gesture === 'button' && p.button === 'options' && p.id) {
      p.open?.(p.x ?? 0, p.y ?? 0);
    } else if (p.gesture === 'button' && p.button === 'delete' && p.id) {
      fieldsDemo.rows = fieldsDemo.rows.filter((r) => r.id !== p.id);
    }
    return;
  }
  if (e.source === 'utility' && e.action === 'demo-filter' && typeof e.payload === 'string') {
    const key = e.payload as keyof typeof demoFilter;
    demoFilter[key] = !demoFilter[key];
    return;
  }
  if (e.source !== 'panel') return;
  const payload = e.payload as Record<string, unknown> | undefined;
  switch (e.action) {
    case 'demo-add':
      demo.count += 1;
      demo.note = `added row ${demo.count}`;
      break;
    case 'demo-open':
      if (payload?.gesture === 'menu' && payload.option === 'pin') demo.pinned = !demo.pinned;
      else if (payload?.gesture === 'menu' && payload.option === 'delete') demo.note = 'delete requested';
      else if (payload?.gesture === 'button') demo.note = `${String(payload.button)} requested`;
      else if (payload?.gesture === 'switch') demo.enabled = Boolean(payload.value);
      else demo.note = `opened ${String(payload?.id ?? '')}`;
      break;
    case 'demo-card':
      if (payload?.gesture === 'switch') {
        demo.enabled = Boolean(payload.value);
        demo.note = `card ${demo.enabled ? 'on' : 'off'}`;
      } else if (payload?.gesture === 'button') demo.note = `card ${String(payload.button)}`;
      break;
    case 'demo-form':
      if (payload?.key === 'level' && typeof payload.value === 'string') demo.level = payload.value;
      if (payload?.key === 'caps' && typeof payload.value === 'number') demo.caps = payload.value;
      if (payload?.key === 'pinned' && typeof payload.value === 'boolean') demo.pinned = payload.value;
      if (payload?.key === 'rowLabel' && typeof payload.value === 'string') demo.rowLabel = payload.value;
      if (payload?.key === 'scope' && typeof payload.value === 'string') demo.scope = payload.value;
      if (payload?.key === 'when' && typeof payload.value === 'string') demo.when = payload.value;
      break;
    case 'demo-input':
      if (typeof payload?.value === 'string') {
        demo.typed = payload.value;
        demo.note = `typed: ${payload.value || '—'}`;
      }
      break;
    case 'demo-menu-pick': {
      const data = (e.payload as { data?: { level?: string } } | undefined)?.data;
      if (data?.level) demo.level = data.level;
      break;
    }
    case 'demo-tree-node': {
      const id = String((e.payload as TreeNode | undefined)?.id ?? '');
      if (demo.treeChecked.has(id)) demo.treeChecked.delete(id);
      else demo.treeChecked.add(id);
      break;
    }
    default:
      break;
  }
}

declare global {
  interface Window {
    __sfWorkspace?: WorkspaceApi;
  }
}

createApp(Framework, {
  onWorkspaceReady: (api: WorkspaceApi) => (window.__sfWorkspace = api),
  onAction,
}).mount('#framework');
