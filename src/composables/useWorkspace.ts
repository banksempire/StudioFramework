import { type InjectionKey, inject, nextTick, type Ref, reactive, shallowReactive, watch } from 'vue';
import type { MenuNodeDef, WorkspaceDef, WorkspaceTabDef } from '../types/layout';
import { type AuxWindowHandle, openAuxWindow } from '../workspace/auxWindow';
import {
  captureSnapshot,
  restoreSnapshot,
  type SnapshotPanels,
  type WorkspaceSnapshot,
} from '../workspace/snapshots';
import {
  collectAllTabs,
  type DropZone,
  findNode,
  findTile,
  findTileByTab,
  firstTile,
  nextId,
  type SplitDir,
  type TileNode,
  treeCloseTab,
  treeInsertTab,
  treeMoveTab,
  treeNewTab,
  treeSetRatio,
  treeSplitTile,
  type WorkspaceNode,
} from '../workspace/tree';
import {
  isAnyWindowDraggedOver,
  registerWindowForDragTracking,
  resetWindowDragTracking,
} from '../workspace/windowDragTracker';
import type { TabResourceLifecycle, TabStateChange } from './tabResources';

export interface RootGroup {
  id: string;
  node: WorkspaceNode;
  ratio: number;
}

export interface WorkspaceOps {
  activateTab(tileId: string, tabId: string): void;
  closeTab(tabId: string): void;
  newTab(tileId: string): void;
  openTab(tileId: string, tab: WorkspaceTabDef): void;
  insertTab(tileId: string, index: number, tab: WorkspaceTabDef): void;
  splitOpen(tileId: string, dir: SplitDir, side: 'start' | 'end', tab: WorkspaceTabDef): void;
  setRatio(splitId: string, ratio: number): void;
  setRootRatio(index: number, ratio: number): void;
  evenlySpace(): void;
  mergeAll(): void;
  splitTile(tileId: string, dir: SplitDir, side: 'start' | 'end', tabId: string): void;
  moveTab(tabId: string, targetTileId: string, index: number): void;
  focusTile(tileId: string): void;
  detachTab(tabId: string, opts?: AuxDetachOptions): boolean;
  reattachTab(tabId: string, tileId?: string, index?: number): boolean;
  activateAuxTab(windowId: number, tabId: string): void;
  moveAuxTabIntoWorkspace(tabId: string, tileId: string, zone: DropZone, index: number): void;
}

export const BLANK_CONTENT = 'sf-blank';

export interface AuxDetachOptions {
  width?: number;
  height?: number;
  windowId?: number;
  left?: number;
  top?: number;
}

export interface DndRect {
  x: number;
  y: number;
  w: number;
  h: number;
  radius?: string;
}

export interface DndState {
  dragging: boolean;
  externalDrop: boolean;
  tabId: string;
  sourceTileId: string;
  fromIndex: number;
  tileId: string;
  zone: DropZone;
  index: number;
  preview: DndRect | null;
  glow: DndRect | null;
  indicator: { x: number; y: number; h: number } | null;
}

export interface ExternalDropTarget {
  tileId: string;
  zone: DropZone;
  index: number;
}

export interface PanelStateProvider {
  read: () => SnapshotPanels | null;
  apply: (panels: SnapshotPanels) => void;
}

export interface WindowStateProvider {
  read: () => Record<string, unknown> | null;
  apply: (state: Record<string, unknown>) => void;
}

export interface UiStateProvider {
  read: () => Record<string, unknown> | null;
  apply: (values: Record<string, unknown>) => void;
}

export interface TabSlot {
  el: HTMLElement;
  tileId: string;
}

export interface WorkspaceApi {
  roots: RootGroup[];
  rootDir: SplitDir | null;
  focusedTileId: string;
  readonly topRightTileId: string;
  tabDefs: Record<string, WorkspaceTabDef>;
  readonly emptyContent: string;
  minTileWidth: number;
  minTileHeight: number;
  ops: WorkspaceOps;
  dnd: DndState;
  readonly tabSlots: ReadonlyMap<string, TabSlot>;
  registerTabSlot(tabId: string, el: HTMLElement | null, tileId: string): void;
  readonly detachedTabs: ReadonlyMap<string, number>;
  readonly auxMobile: ReadonlyMap<number, boolean>;
  auxWindowIsMobile(windowId: number): boolean;
  isTabDetached(tabId: string): boolean;
  startDrag(tabId: string, tileId: string, index: number): void;
  endDrag(): void;
  registerTileEl(id: string, el: HTMLElement | null): void;
  readonly newTabTitle: string;
  setNewTabHandler(handler: ((tileId: string) => void) | null, title?: string): void;
  tileEls: Map<string, HTMLElement>;
  findTileGlobal(tileId: string): TileNode | null;
  findTabGlobal(tabId: string): TileNode | null;
  setTabClickHandler(handler: ((tabId: string) => void) | null): void;
  notifyTabClick(tabId: string): void;
  setTabLongPressHandler(handler: ((tabId: string) => void) | null): void;
  notifyTabLongPress(tabId: string): void;
  readonly mobileSheetEpoch: number;
  dismissMobileSheets(): void;
  registerTabResources(tabId: string, lifecycle: TabResourceLifecycle): void;
  unregisterTabResources(tabId: string, lifecycle: TabResourceLifecycle): void;
  setExternalDropHandler(
    accepts: ((types: string[]) => boolean) | null,
    handler: ((e: DragEvent, target: ExternalDropTarget) => void) | null,
  ): void;
  acceptsExternal(types: string[]): boolean;
  deliverExternalDrop(e: DragEvent, target: ExternalDropTarget): void;
  capture(): WorkspaceSnapshot;
  apply(snapshot: WorkspaceSnapshot): string[];
  setPanelStateProvider(provider: PanelStateProvider | null): void;
  setWindowStateProvider(provider: WindowStateProvider | null): void;
  setUiStateProvider(provider: UiStateProvider | null): void;
  persistNow(): void;
}

export type WorkspaceContext = WorkspaceApi;

export const kWorkspace: InjectionKey<WorkspaceContext> = Symbol('sf.workspace');

export interface RightPanelToggleApi {
  visible: boolean;
  toggle: () => void;
}

export const kRightPanelToggle: InjectionKey<RightPanelToggleApi> = Symbol('sf.rightPanelToggle');

export interface TitleBarMenusApi {
  menus: MenuNodeDef[];
  onAction: (actionId: string) => void;
}

export const kTitleBarMenus: InjectionKey<TitleBarMenusApi> = Symbol('sf.titleBarMenus');

export const kIsMobile: InjectionKey<Ref<boolean>> = Symbol('sf.isMobile');

export const kMobilePanelDismiss: InjectionKey<() => void> = Symbol('sf.mobilePanelDismiss');

export const kSingleMenuOpen: InjectionKey<(item: unknown, x: number, y: number) => boolean> =
  Symbol('sf.singleMenuOpen');

export function useWorkspaceContext(): WorkspaceContext {
  const api = inject(kWorkspace);
  if (!api) throw new Error('useWorkspaceContext: workspace context not provided');
  return api;
}

function findTopRightTileId(node: WorkspaceNode): string {
  if (node.kind === 'tile') return node.id;
  return findTopRightTileId(node.dir === 'row' ? node.children[1] : node.children[0]);
}

export function useWorkspace(def: WorkspaceDef, opts?: { mobile?: Ref<boolean> }): WorkspaceApi {
  const minTileWidth = def.minTileWidth ?? 160;
  const minTileHeight = def.minTileHeight ?? 100;

  const initialTileId = nextId('tile');
  const state = reactive<{
    roots: RootGroup[];
    focusedTileId: string;
    rootDir: SplitDir | null;
    newTabTitle: string;
    mobileSheetEpoch: number;
  }>({
    roots: [
      {
        id: nextId('root'),
        node: {
          kind: 'tile',
          id: initialTileId,
          tabs: def.tabs.map((t) => t.id),
          activeId: def.tabs[0]?.id ?? '',
        },
        ratio: 1,
      },
    ],
    focusedTileId: initialTileId,
    rootDir: null,
    newTabTitle: 'New file',
    mobileSheetEpoch: 0,
  });

  let newTabHandler: ((tileId: string) => void) | null = null;

  function setNewTabHandler(handler: ((tileId: string) => void) | null, title?: string) {
    newTabHandler = handler;
    if (title !== undefined) state.newTabTitle = title;
    else if (!handler) state.newTabTitle = 'New file';
  }

  let extAccepts: ((types: string[]) => boolean) | null = null;
  let extHandler: ((e: DragEvent, target: ExternalDropTarget) => void) | null = null;

  function setExternalDropHandler(
    accepts: ((types: string[]) => boolean) | null,
    handler: ((e: DragEvent, target: ExternalDropTarget) => void) | null,
  ) {
    extAccepts = accepts;
    extHandler = handler;
  }

  function acceptsExternal(types: string[]): boolean {
    return !!extAccepts && extAccepts(types);
  }

  function deliverExternalDrop(e: DragEvent, target: ExternalDropTarget) {
    extHandler?.(e, target);
  }

  let tabClickHandler: ((tabId: string) => void) | null = null;

  function setTabClickHandler(handler: ((tabId: string) => void) | null) {
    tabClickHandler = handler;
  }

  function notifyTabClick(tabId: string) {
    tabClickHandler?.(tabId);
  }

  let tabLongPressHandler: ((tabId: string) => void) | null = null;

  function setTabLongPressHandler(handler: ((tabId: string) => void) | null) {
    tabLongPressHandler = handler;
  }

  function notifyTabLongPress(tabId: string) {
    tabLongPressHandler?.(tabId);
  }

  function dismissMobileSheets() {
    state.mobileSheetEpoch += 1;
  }

  const tabDefs = reactive<Record<string, WorkspaceTabDef>>({});
  for (const t of def.tabs) tabDefs[t.id] = t;

  const tabResources = new Map<string, TabResourceLifecycle>();
  const tabResourceProps = new Map<string, Record<string, unknown> | undefined>();

  function releaseTabResources(tabId: string) {
    const lifecycle = tabResources.get(tabId);
    if (!lifecycle) return;
    tabResources.delete(tabId);
    tabResourceProps.delete(tabId);
    lifecycle._on_tab_close_release_resources?.();
  }

  function registerTabResources(tabId: string, lifecycle: TabResourceLifecycle) {
    tabResources.set(tabId, lifecycle);
    tabResourceProps.set(tabId, tabDefs[tabId]?.props);
    lifecycle._on_tab_open_request_resources?.();
  }

  function unregisterTabResources(tabId: string, lifecycle: TabResourceLifecycle) {
    if (tabResources.get(tabId) !== lifecycle) return;
    releaseTabResources(tabId);
  }

  watch(
    tabDefs,
    () => {
      if (tabResources.size === 0) return;
      for (const [tabId, lifecycle] of tabResources) {
        const next = tabDefs[tabId]?.props;
        const prev = tabResourceProps.get(tabId);
        if (next === prev) continue;
        tabResourceProps.set(tabId, next);
        const change: TabStateChange = { prev, next };
        lifecycle._on_tab_states_change_reload_resources?.(change);
      }
    },
    { deep: true },
  );

  const tabSlots = reactive(new Map<string, TabSlot>());
  const detached = shallowReactive(new Map<string, number>());
  const auxWindows = new Map<number, AuxWindowHandle>();
  const auxActive = shallowReactive(new Map<number, string>());
  const auxMobile = shallowReactive(new Map<number, boolean>());
  const mobileRef = opts?.mobile ?? null;

  registerWindowForDragTracking(window, 0);

  function auxSlotId(windowId: number): string {
    return `aux:${windowId}`;
  }

  function auxTabsOf(windowId: number): string[] {
    return [...detached.entries()].filter(([, w]) => w === windowId).map(([t]) => t);
  }

  function syncAuxChrome(windowId: number) {
    const handle = auxWindows.get(windowId);
    if (!handle) return;
    const active = auxActive.get(windowId) ?? '';
    handle.chips.textContent = '';
    for (const tabId of auxTabsOf(windowId)) {
      const def = tabDefs[tabId];
      const chip = document.createElement('div');
      chip.className = active === tabId ? 'sf-aux-chip sf-aux-chip--active' : 'sf-aux-chip';
      chip.setAttribute('data-test', 'aux-tab');
      chip.setAttribute('data-tab-id', tabId);
      chip.title = def?.label ?? tabId;
      const icon = document.createElement('span');
      icon.className = 'sf-aux-chip-icon';
      icon.textContent = typeof def?.icon === 'string' ? def.icon : '';
      const label = document.createElement('span');
      label.className = 'sf-aux-chip-label';
      label.textContent = def?.label ?? tabId;
      chip.append(icon, label);
      if (def?.closeable !== false) {
        const closeChip = document.createElement('span');
        closeChip.className = 'sf-aux-chip-close';
        closeChip.setAttribute('data-test', 'aux-tab-close');
        closeChip.title = 'Close tab';
        closeChip.textContent = '✕';
        closeChip.addEventListener('click', (e) => {
          e.stopPropagation();
          ops.closeTab(tabId);
        });
        chip.appendChild(closeChip);
      }
      chip.draggable = !handle.isMobile();
      chip.addEventListener('click', () => activateAuxTab(windowId, tabId));
      chip.addEventListener('dragstart', (e) => {
        if (!e.dataTransfer) return;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', tabId);
        startDrag(tabId, auxSlotId(windowId), auxTabsOf(windowId).indexOf(tabId));
      });
      chip.addEventListener('dragend', (e) => {
        const wasDragging = dnd.dragging;
        endDrag();
        resetWindowDragTracking();
        if (!wasDragging) return;
        if (isAnyWindowDraggedOver()) return;
        if (mobileRef?.value) return;
        if (detached.get(tabId) !== windowId) return;
        void moveDetachedTab(tabId, undefined, { screenX: e.screenX, screenY: e.screenY });
      });
      handle.chips.appendChild(chip);
    }
    if (active) handle.document.title = tabDefs[active]?.label ?? handle.document.title;
  }

  function syncAllAuxChrome() {
    for (const id of [...auxWindows.keys()]) syncAuxChrome(id);
  }

  watch([detached, auxActive, tabDefs], syncAllAuxChrome, { deep: true });

  function activateAuxTab(windowId: number, tabId: string) {
    if (detached.get(tabId) !== windowId) return;
    if (auxActive.get(windowId) === tabId) return;
    const handle = auxWindows.get(windowId);
    if (!handle) return;
    const prev = auxActive.get(windowId);
    if (prev) {
      const cur = tabSlots.get(prev);
      if (cur && cur.tileId === auxSlotId(windowId)) tabSlots.delete(prev);
    }
    auxActive.set(windowId, tabId);
    tabSlots.set(tabId, { el: handle.content, tileId: auxSlotId(windowId) });
  }

  function bindAuxWindow(handle: AuxWindowHandle) {
    auxWindows.set(handle.id, handle);
    auxMobile.set(handle.id, handle.isMobile());
    handle.onMobileChange(() => {
      auxMobile.set(handle.id, handle.isMobile());
      syncAuxChrome(handle.id);
    });
    registerWindowForDragTracking(handle.window, handle.id);
    const acceptDrop = (el: HTMLElement) => {
      el.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        handle.document.body.classList.add('sf-aux-drop');
      });
      el.addEventListener('dragleave', () => {
        handle.document.body.classList.remove('sf-aux-drop');
      });
      el.addEventListener('drop', (e) => {
        e.preventDefault();
        handle.document.body.classList.remove('sf-aux-drop');
        const draggedTabId = dnd.tabId;
        const source = dnd.sourceTileId;
        endDrag();
        resetWindowDragTracking();
        if (!draggedTabId) return;
        if (source.startsWith('aux:')) {
          const sourceWindowId = Number(source.slice(4));
          if (sourceWindowId !== handle.id) moveDetachedTab(draggedTabId, handle.id, undefined);
          return;
        }
        ops.detachTab(draggedTabId, { windowId: handle.id });
      });
    };
    acceptDrop(handle.strip);
    acceptDrop(handle.content);
    handle.onClosed(() => {
      auxMobile.delete(handle.id);
      for (const tabId of auxTabsOf(handle.id)) {
        reattachDetached(tabId, undefined, undefined, true);
      }
      auxWindows.delete(handle.id);
      auxActive.delete(handle.id);
    });
  }

  function moveDetachedTab(
    tabId: string,
    targetWindowId: number | undefined,
    position?: { screenX?: number; screenY?: number },
  ): boolean {
    const currentWindowId = detached.get(tabId);
    if (currentWindowId === undefined) return false;
    const prevSlot = tabSlots.get(tabId);
    if (targetWindowId !== undefined) {
      if (targetWindowId === currentWindowId) return false;
      const target = auxWindows.get(targetWindowId);
      if (!target) return false;
      detached.set(tabId, targetWindowId);
      if (prevSlot && prevSlot.tileId === auxSlotId(currentWindowId)) tabSlots.delete(tabId);
      activateAuxTab(targetWindowId, tabId);
      const wasActive = auxActive.get(currentWindowId) === tabId || !auxActive.has(currentWindowId);
      if (wasActive) {
        const remaining = auxTabsOf(currentWindowId);
        if (remaining.length > 0) activateAuxTab(currentWindowId, remaining[0]);
      }
      syncAuxChrome(currentWindowId);
      syncAuxChrome(targetWindowId);
      const source = auxWindows.get(currentWindowId);
      if (source) {
        void nextTick().then(() => {
          if (source.content.childElementCount === 0) source.close();
        });
      }
      return true;
    }
    const def = tabDefs[tabId];
    const handle = openAuxWindow({
      title: def?.label ?? 'Window',
      width: 960,
      height: 720,
      left: position?.screenX ? Math.max(0, position.screenX - 80) : undefined,
      top: position?.screenY ? Math.max(0, position.screenY - 24) : undefined,
    });
    if (!handle) return false;
    bindAuxWindow(handle);
    detached.set(tabId, handle.id);
    if (prevSlot && prevSlot.tileId === auxSlotId(currentWindowId)) tabSlots.delete(tabId);
    activateAuxTab(handle.id, tabId);
    const remaining = auxTabsOf(currentWindowId);
    if (auxActive.get(currentWindowId) === tabId && remaining.length > 0) {
      activateAuxTab(currentWindowId, remaining[0]);
    }
    syncAuxChrome(currentWindowId);
    syncAuxChrome(handle.id);
    const source = auxWindows.get(currentWindowId);
    if (source) {
      void nextTick().then(() => {
        if (source.content.childElementCount === 0) source.close();
      });
    }
    return true;
  }

  function reattachDetached(
    tabId: string,
    tileId: string | undefined,
    index: number | undefined,
    closeNow: boolean,
  ): boolean {
    const windowId = detached.get(tabId);
    if (windowId === undefined) return false;
    let target = tileId ? findTileGlobal(tileId) : findTileGlobal(state.focusedTileId);
    if (!target && state.roots.length > 0) target = firstTile(state.roots[0].node);
    if (!target) return false;
    const root = findRootByTile(target.id);
    if (!root) return false;
    detached.delete(tabId);
    tabSlots.delete(tabId);
    root.node = treeInsertTab(root.node, target.id, tabId, index ?? target.tabs.length);
    state.focusedTileId = target.id;
    ensureFocus();
    const remaining = auxTabsOf(windowId);
    const handle = auxWindows.get(windowId);
    if (remaining.length > 0 && auxActive.get(windowId) === tabId) {
      activateAuxTab(windowId, remaining[0]);
    }
    if (remaining.length > 0) syncAuxChrome(windowId);
    if (handle && !closeNow) {
      void nextTick().then(() => {
        if (handle.content.childElementCount === 0) handle.close();
      });
    }
    return true;
  }

  function registerTabSlot(tabId: string, el: HTMLElement | null, tileId: string) {
    if (el) {
      tabSlots.set(tabId, { el, tileId });
      return;
    }
    const current = tabSlots.get(tabId);
    if (current && current.tileId === tileId) tabSlots.delete(tabId);
  }

  function findRootByTile(tileId: string): RootGroup | null {
    return state.roots.find((r) => findTile(r.node, tileId)) ?? null;
  }

  function findRootByTab(tabId: string): RootGroup | null {
    return state.roots.find((r) => findTileByTab(r.node, tabId)) ?? null;
  }

  function findRootByNode(nodeId: string): RootGroup | null {
    return state.roots.find((r) => findNode(r.node, nodeId)) ?? null;
  }

  function isRootEmpty(root: RootGroup): boolean {
    return root.node.kind === 'tile' && root.node.tabs.length === 0;
  }

  function removeRoot(index: number) {
    const removed = state.roots[index];
    if (!removed) return;
    state.roots.splice(index, 1);
    if (state.roots.length <= 1) state.rootDir = null;
    if (state.roots.length === 0) return;
    const total = state.roots.reduce((s, r) => s + r.ratio, 0);
    if (total > 0) {
      for (const r of state.roots) r.ratio += removed.ratio * (r.ratio / total);
    } else {
      state.roots.forEach((r) => {
        r.ratio = 1 / state.roots.length;
      });
    }
  }

  function removeTabFromRoots(tabId: string) {
    const root = findRootByTab(tabId);
    if (!root) return;
    root.node = treeCloseTab(root.node, tabId);
    if (isRootEmpty(root) && state.roots.length > 1) {
      removeRoot(state.roots.indexOf(root));
    }
  }

  function ensureFocus() {
    for (const root of state.roots) {
      if (findTile(root.node, state.focusedTileId)) return;
    }
    const first = state.roots[0];
    if (!first) return;
    const stack: WorkspaceNode[] = [first.node];
    while (stack.length) {
      const n = stack.pop();
      if (!n) break;
      if (n.kind === 'tile') {
        state.focusedTileId = n.id;
        return;
      }
      stack.push(n.children[1], n.children[0]);
    }
  }

  const AUTO_KEY = 'sf.workspace.layout';

  function loadAutoSnapshot(): WorkspaceSnapshot | null {
    try {
      const raw = localStorage.getItem(AUTO_KEY);
      if (!raw) return null;
      const snap = JSON.parse(raw);
      return snap && snap.version === 1 && Array.isArray(snap.roots) ? snap : null;
    } catch {
      return null;
    }
  }

  let lastAutoJson: string | null = null;
  function persistedTabDef(id: string): WorkspaceTabDef | undefined {
    const d = tabDefs[id];
    if (!d || d.transient || d.content === BLANK_CONTENT || !d.content) return undefined;
    return {
      id: d.id,
      label: d.label,
      icon: d.icon,
      closeable: d.closeable,
      content: d.content,
      props: d.props,
    };
  }
  function currentSnapshot(withUi = false): WorkspaceSnapshot {
    const snap = captureSnapshot(
      state.roots,
      state.rootDir,
      (id) => !!tabDefs[id]?.transient,
      panelProvider?.read() ?? undefined,
      windowProvider?.read() ?? undefined,
      withUi ? (uiProvider?.read() ?? undefined) : undefined,
      persistedTabDef,
    );
    const auxIds = [...detached.keys()];
    if (auxIds.length > 0) {
      snap.aux = auxIds;
      const defs = { ...(snap.defs ?? {}) };
      for (const id of auxIds) {
        const d = persistedTabDef(id);
        if (d) defs[id] = d;
      }
      snap.defs = defs;
    }
    return snap;
  }
  function saveAutoSnapshot() {
    try {
      const json = JSON.stringify(currentSnapshot());
      if (json === lastAutoJson) return;
      localStorage.setItem(AUTO_KEY, json);
      lastAutoJson = json;
    } catch {}
  }

  function ghostDef(id: string): WorkspaceTabDef {
    return { id, label: id, content: BLANK_CONTENT, tabClass: 'sf-tab--ghost' };
  }

  let panelProvider: PanelStateProvider | null = null;
  let pendingPanels: SnapshotPanels | null = null;

  let windowProvider: WindowStateProvider | null = null;
  let pendingWindows: Record<string, unknown> | null = null;

  let uiProvider: UiStateProvider | null = null;
  let pendingUi: Record<string, unknown> | null = null;

  function applySnapshot(snap: WorkspaceSnapshot): string[] {
    const restored = restoreSnapshot(snap);
    if (restored.length === 0) {
      restored.push({
        id: nextId('root'),
        node: { kind: 'tile', id: nextId('tile'), tabs: [], activeId: '' },
        ratio: 1,
      });
    }
    const live = new Set<string>();
    const ghosts: string[] = [];
    const walk = (node: WorkspaceNode) => {
      if (node.kind === 'tile') {
        for (const t of node.tabs) {
          live.add(t);
          if (!tabDefs[t]) {
            const restored = snap.defs?.[t];
            if (restored) {
              tabDefs[t] = { ...restored, transient: false, tabClass: undefined };
            } else {
              tabDefs[t] = ghostDef(t);
              ghosts.push(t);
            }
          }
        }
      } else {
        walk(node.children[0]);
        walk(node.children[1]);
      }
    };
    for (const r of restored) walk(r.node);
    for (const id of Object.keys(tabDefs)) {
      if (tabDefs[id].content === BLANK_CONTENT && !live.has(id)) delete tabDefs[id];
    }
    for (const tabId of [...tabResources.keys()]) {
      if (!live.has(tabId) && !detached.has(tabId)) releaseTabResources(tabId);
    }
    const auxIds = (snap.aux ?? []).filter((id) => !live.has(id));
    const windowsToMaybeClose = new Set<number>();
    for (const id of auxIds) {
      const detachedWindow = detached.get(id);
      if (detachedWindow !== undefined) {
        detached.delete(id);
        tabSlots.delete(id);
        if (auxTabsOf(detachedWindow).length === 0) windowsToMaybeClose.add(detachedWindow);
      }
      if (!tabDefs[id]) {
        const restoredDef = snap.defs?.[id];
        if (restoredDef) {
          tabDefs[id] = { ...restoredDef, transient: false, tabClass: undefined };
        } else {
          tabDefs[id] = ghostDef(id);
          ghosts.push(id);
        }
      }
      live.add(id);
    }
    state.roots = restored;
    state.rootDir = snap.rootDir ?? null;
    ensureFocus();
    for (const id of auxIds) {
      const tile = findTileGlobal(state.focusedTileId);
      if (!tile) break;
      const root = findRootByTile(tile.id);
      if (!root) break;
      root.node = treeInsertTab(root.node, tile.id, id, tile.tabs.length);
      state.focusedTileId = tile.id;
    }
    ensureFocus();
    for (const windowId of windowsToMaybeClose) {
      const handle = auxWindows.get(windowId);
      if (!handle) continue;
      void nextTick().then(() => {
        if (handle.content.childElementCount === 0) handle.close();
      });
    }
    if (snap.panels) {
      if (panelProvider) panelProvider.apply(snap.panels);
      else pendingPanels = snap.panels;
    }
    if (snap.windows) {
      if (windowProvider) windowProvider.apply(snap.windows);
      else pendingWindows = snap.windows;
    }
    if (snap.ui) {
      if (uiProvider) uiProvider.apply(snap.ui);
      else pendingUi = snap.ui;
    }
    return ghosts;
  }

  const ops: WorkspaceOps = {
    activateTab(tileId, tabId) {
      const root = findRootByTile(tileId);
      if (!root) return;
      const tile = findTile(root.node, tileId);
      if (tile) {
        tile.activeId = tabId;
        state.focusedTileId = tileId;
      }
    },

    closeTab(tabId) {
      const windowId = detached.get(tabId);
      if (windowId !== undefined) {
        detached.delete(tabId);
        tabSlots.delete(tabId);
        releaseTabResources(tabId);
        const remaining = auxTabsOf(windowId);
        if (remaining.length > 0 && auxActive.get(windowId) === tabId) {
          activateAuxTab(windowId, remaining[0]);
        }
        syncAuxChrome(windowId);
        const handle = auxWindows.get(windowId);
        if (handle) {
          void nextTick().then(() => {
            if (handle.content.childElementCount === 0) handle.close();
          });
        }
        return;
      }
      releaseTabResources(tabId);
      removeTabFromRoots(tabId);
      ensureFocus();
    },

    newTab(tileId) {
      if (newTabHandler) {
        newTabHandler(tileId);
        return;
      }
      const root = findRootByTile(tileId);
      if (!root) return;
      const id = `untitled-${nextId('tab')}`;
      root.node = treeNewTab(root.node, tileId, id);
      tabDefs[id] = { id, label: 'Untitled', icon: '📄' };
    },

    openTab(tileId, tab) {
      const root = findRootByTile(tileId);
      if (!root) return;
      tabDefs[tab.id] = tab;
      root.node = treeNewTab(root.node, tileId, tab.id);
      state.focusedTileId = tileId;
    },

    insertTab(tileId, index, tab) {
      const root = findRootByTile(tileId);
      if (!root) return;
      tabDefs[tab.id] = tab;
      const tile = findTile(root.node, tileId);
      const tabCount = tile ? tile.tabs.length : 0;
      root.node = treeInsertTab(root.node, tileId, tab.id, Math.max(0, Math.min(index, tabCount)));
      state.focusedTileId = tileId;
    },

    splitOpen(tileId, dir, side, tab) {
      const root = findRootByTile(tileId);
      if (!root) return;
      tabDefs[tab.id] = tab;

      const isRootTile = root.node.kind === 'tile' && root.node.id === tileId;
      const createsNewRoot = isRootTile && (state.rootDir === null || state.rootDir === dir);

      if (createsNewRoot) {
        if (state.rootDir === null) state.rootDir = dir;
        const targetIdx = state.roots.indexOf(root);
        const target = state.roots[targetIdx];
        const newTile: TileNode = { kind: 'tile', id: nextId('tile'), tabs: [tab.id], activeId: tab.id };
        const newRoot: RootGroup = { id: nextId('root'), node: newTile, ratio: target.ratio / 2 };
        target.ratio /= 2;
        state.roots.splice(side === 'start' ? targetIdx : targetIdx + 1, 0, newRoot);
        state.focusedTileId = newTile.id;
      } else {
        root.node = treeNewTab(root.node, tileId, tab.id);
        root.node = treeSplitTile(root.node, tileId, dir, side, tab.id);
        const newTile = findTileByTab(root.node, tab.id);
        if (newTile) state.focusedTileId = newTile.id;
      }
    },

    setRatio(splitId, ratio) {
      const root = findRootByNode(splitId);
      if (!root) return;
      root.node = treeSetRatio(root.node, splitId, ratio);
    },

    setRootRatio(index, ratio) {
      if (index < 0 || index >= state.roots.length - 1) return;
      const left = state.roots[index];
      const right = state.roots[index + 1];
      const total = left.ratio + right.ratio;
      const r = Math.min(0.95, Math.max(0.05, ratio));
      left.ratio = r * total;
      right.ratio = (1 - r) * total;
    },

    evenlySpace() {
      const n = state.roots.length;
      if (n === 0) return;
      const each = 1 / n;
      for (const r of state.roots) r.ratio = each;
    },

    mergeAll() {
      const allTabs: string[] = [];
      for (const root of state.roots) allTabs.push(...collectAllTabs(root.node));
      if (allTabs.length === 0) return;

      let activeId = allTabs[0];
      for (const root of state.roots) {
        const tile = findTile(root.node, state.focusedTileId);
        if (tile?.activeId && allTabs.includes(tile.activeId)) {
          activeId = tile.activeId;
          break;
        }
      }

      const newTile: TileNode = { kind: 'tile', id: nextId('tile'), tabs: allTabs, activeId };
      state.roots = [{ id: nextId('root'), node: newTile, ratio: 1 }];
      state.rootDir = null;
      state.focusedTileId = newTile.id;
    },

    splitTile(tileId, dir, side, tabId) {
      const root = findRootByTile(tileId);
      if (!root) return;

      const isRootTile = root.node.kind === 'tile' && root.node.id === tileId;
      const createsNewRoot = isRootTile && (state.rootDir === null || state.rootDir === dir);

      if (createsNewRoot) {
        if (state.rootDir === null) state.rootDir = dir;

        const targetRootId = root.id;
        const targetOrigIdx = state.roots.indexOf(root);

        removeTabFromRoots(tabId);

        const newTile: TileNode = { kind: 'tile', id: nextId('tile'), tabs: [tabId], activeId: tabId };
        const newRoot: RootGroup = { id: nextId('root'), node: newTile, ratio: 0 };

        const targetIdx = state.roots.findIndex((r) => r.id === targetRootId);
        if (targetIdx >= 0) {
          const target = state.roots[targetIdx];
          if (isRootEmpty(target)) {
            newRoot.ratio = target.ratio;
            state.roots.splice(targetIdx, 1, newRoot);
          } else {
            newRoot.ratio = target.ratio / 2;
            target.ratio /= 2;
            const insertIdx = side === 'start' ? targetIdx : targetIdx + 1;
            state.roots.splice(insertIdx, 0, newRoot);
          }
        } else {
          const fallbackIdx = Math.min(targetOrigIdx, state.roots.length - 1);
          if (state.roots.length > 0 && fallbackIdx >= 0) {
            const fallback = state.roots[fallbackIdx];
            newRoot.ratio = fallback.ratio / 2;
            fallback.ratio /= 2;
            const insertIdx = side === 'start' ? fallbackIdx : fallbackIdx + 1;
            state.roots.splice(insertIdx, 0, newRoot);
          } else {
            newRoot.ratio = 1;
            state.roots.push(newRoot);
          }
        }
        if (state.roots.length > 1) state.rootDir = dir;
        state.focusedTileId = newTile.id;
      } else {
        const sourceRoot = findRootByTab(tabId);
        if (sourceRoot && sourceRoot !== root) {
          sourceRoot.node = treeCloseTab(sourceRoot.node, tabId);
          if (isRootEmpty(sourceRoot) && state.roots.length > 1) {
            removeRoot(state.roots.indexOf(sourceRoot));
          }
        }

        root.node = treeSplitTile(root.node, tileId, dir, side, tabId);
        const newTile = findTileByTab(root.node, tabId);
        if (newTile) state.focusedTileId = newTile.id;
      }
    },

    moveTab(tabId, targetTileId, index) {
      const sourceRoot = findRootByTab(tabId);
      const targetRoot = findRootByTile(targetTileId);
      if (!sourceRoot || !targetRoot) return;

      if (sourceRoot === targetRoot) {
        sourceRoot.node = treeMoveTab(sourceRoot.node, tabId, targetTileId, index);
      } else {
        sourceRoot.node = treeCloseTab(sourceRoot.node, tabId);
        if (isRootEmpty(sourceRoot) && state.roots.length > 1) {
          removeRoot(state.roots.indexOf(sourceRoot));
        }
        targetRoot.node = treeInsertTab(targetRoot.node, targetTileId, tabId, index);
      }
      state.focusedTileId = targetTileId;
    },

    focusTile(tileId) {
      state.focusedTileId = tileId;
    },

    detachTab(tabId, opts) {
      const def = tabDefs[tabId];
      if (!def?.content || def.content === BLANK_CONTENT) return false;
      if (detached.has(tabId)) return false;
      if (mobileRef?.value) return false;
      const targetWindowId = opts?.windowId;
      if (targetWindowId !== undefined) {
        const existing = auxWindows.get(targetWindowId);
        if (!existing) return false;
        detached.set(tabId, targetWindowId);
        activateAuxTab(targetWindowId, tabId);
        removeTabFromRoots(tabId);
        ensureFocus();
        syncAuxChrome(targetWindowId);
        return true;
      }
      const handle = openAuxWindow({
        title: def.label,
        width: opts?.width,
        height: opts?.height,
        left: opts?.left,
        top: opts?.top,
      });
      if (!handle) return false;
      bindAuxWindow(handle);
      detached.set(tabId, handle.id);
      activateAuxTab(handle.id, tabId);
      removeTabFromRoots(tabId);
      ensureFocus();
      syncAuxChrome(handle.id);
      return true;
    },

    reattachTab(tabId, tileId, index) {
      if (!detached.has(tabId)) return false;
      return reattachDetached(tabId, tileId, index, false);
    },

    activateAuxTab(windowId, tabId) {
      activateAuxTab(windowId, tabId);
    },

    moveAuxTabIntoWorkspace(tabId, tileId, zone, index) {
      if (mobileRef?.value) return;
      if (!detached.has(tabId)) return;
      if (!reattachDetached(tabId, tileId, undefined, false)) return;
      if (zone === 'center') {
        if (typeof index === 'number' && index >= 0) ops.moveTab(tabId, tileId, index);
        return;
      }
      const dir = zone === 'left' || zone === 'right' ? 'row' : 'column';
      const side = zone === 'left' || zone === 'top' ? 'start' : 'end';
      ops.splitTile(tileId, dir, side, tabId);
    },
  };

  const dnd = reactive<DndState>({
    dragging: false,
    externalDrop: false,
    tabId: '',
    sourceTileId: '',
    fromIndex: 0,
    tileId: '',
    zone: 'center',
    index: 0,
    preview: null,
    glow: null,
    indicator: null,
  });

  const tileEls = new Map<string, HTMLElement>();

  function startDrag(tabId: string, tileId: string, index: number) {
    dnd.dragging = true;
    dnd.externalDrop = false;
    dnd.tabId = tabId;
    dnd.sourceTileId = tileId;
    dnd.fromIndex = index;
    dnd.tileId = '';
    dnd.zone = 'center';
    dnd.index = index;
    dnd.preview = null;
    dnd.glow = null;
    dnd.indicator = null;
  }

  function endDrag() {
    dnd.dragging = false;
    dnd.externalDrop = false;
    dnd.tabId = '';
    dnd.tileId = '';
    dnd.preview = null;
    dnd.glow = null;
    dnd.indicator = null;
  }

  function registerTileEl(id: string, el: HTMLElement | null) {
    if (el) tileEls.set(id, el);
    else tileEls.delete(id);
  }

  function findTileGlobal(tileId: string): TileNode | null {
    for (const root of state.roots) {
      const tile = findTile(root.node, tileId);
      if (tile) return tile;
    }
    return null;
  }

  function findTabGlobal(tabId: string): TileNode | null {
    for (const root of state.roots) {
      const tile = findTileByTab(root.node, tabId);
      if (tile) return tile;
    }
    return null;
  }

  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  const scheduleAutoSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(saveAutoSnapshot, 400);
  };
  watch(() => state.roots, scheduleAutoSave, { deep: true });
  window.addEventListener('beforeunload', saveAutoSnapshot);
  window.addEventListener('pagehide', () => {
    if (detached.size === 0) return;
    for (const tabId of [...detached.keys()]) {
      reattachDetached(tabId, undefined, undefined, true);
    }
    saveAutoSnapshot();
  });

  const auto = loadAutoSnapshot();
  if (auto) applySnapshot(auto);

  return {
    get roots() {
      return state.roots;
    },
    get rootDir() {
      return state.rootDir;
    },
    get focusedTileId() {
      return state.focusedTileId;
    },
    get topRightTileId() {
      const root = state.rootDir === 'column' ? state.roots[0] : state.roots[state.roots.length - 1];
      return root ? findTopRightTileId(root.node) : '';
    },
    tabDefs,
    emptyContent: def.emptyContent ?? '',
    minTileWidth,
    minTileHeight,
    ops,
    dnd,
    tabSlots,
    registerTabSlot,
    detachedTabs: detached,
    auxMobile,
    auxWindowIsMobile(windowId: number) {
      return auxWindows.get(windowId)?.isMobile() ?? false;
    },
    isTabDetached(tabId: string) {
      return detached.has(tabId);
    },
    startDrag,
    endDrag,
    registerTileEl,
    tileEls,
    setExternalDropHandler,
    acceptsExternal,
    deliverExternalDrop,
    setTabClickHandler,
    notifyTabClick,
    setTabLongPressHandler,
    notifyTabLongPress,
    get mobileSheetEpoch() {
      return state.mobileSheetEpoch;
    },
    dismissMobileSheets,
    registerTabResources,
    unregisterTabResources,
    get newTabTitle() {
      return state.newTabTitle;
    },
    setNewTabHandler,
    findTileGlobal,
    findTabGlobal,
    capture: () => currentSnapshot(true),
    apply: applySnapshot,
    setPanelStateProvider(provider: PanelStateProvider | null) {
      panelProvider = provider;
      if (provider && pendingPanels) {
        provider.apply(pendingPanels);
        pendingPanels = null;
      }
    },
    setWindowStateProvider(provider: WindowStateProvider | null) {
      windowProvider = provider;
      if (provider && pendingWindows) {
        provider.apply(pendingWindows);
        pendingWindows = null;
      }
    },
    setUiStateProvider(provider: UiStateProvider | null) {
      uiProvider = provider;
      if (provider && pendingUi) {
        provider.apply(pendingUi);
        pendingUi = null;
      }
    },
    persistNow: saveAutoSnapshot,
  };
}
