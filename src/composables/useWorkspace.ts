import { type InjectionKey, inject, type Ref, reactive, watch } from 'vue';
import type { MenuNodeDef, WorkspaceDef, WorkspaceTabDef } from '../types/layout';
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
}

export const BLANK_CONTENT = 'sf-blank';

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

export function useWorkspaceContext(): WorkspaceContext {
  const api = inject(kWorkspace);
  if (!api) throw new Error('useWorkspaceContext: workspace context not provided');
  return api;
}

function findTopRightTileId(node: WorkspaceNode): string {
  if (node.kind === 'tile') return node.id;
  return findTopRightTileId(node.dir === 'row' ? node.children[1] : node.children[0]);
}

export function useWorkspace(def: WorkspaceDef): WorkspaceApi {
  const minTileWidth = def.minTileWidth ?? 160;
  const minTileHeight = def.minTileHeight ?? 100;

  const initialTileId = nextId('tile');
  const state = reactive<{
    roots: RootGroup[];
    focusedTileId: string;
    rootDir: SplitDir | null;
    newTabTitle: string;
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

  const tabDefs = reactive<Record<string, WorkspaceTabDef>>({});
  for (const t of def.tabs) tabDefs[t.id] = t;

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
  function currentSnapshot(withUi = false): WorkspaceSnapshot {
    return captureSnapshot(
      state.roots,
      state.rootDir,
      (id) => !!tabDefs[id]?.transient,
      panelProvider?.read() ?? undefined,
      windowProvider?.read() ?? undefined,
      withUi ? (uiProvider?.read() ?? undefined) : undefined,
    );
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
            tabDefs[t] = ghostDef(t);
            ghosts.push(t);
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
    state.roots = restored;
    state.rootDir = snap.rootDir ?? null;
    ensureFocus();
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
    startDrag,
    endDrag,
    registerTileEl,
    tileEls,
    setExternalDropHandler,
    acceptsExternal,
    deliverExternalDrop,
    setTabClickHandler,
    notifyTabClick,
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
