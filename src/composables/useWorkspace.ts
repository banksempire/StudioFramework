import { reactive, type InjectionKey } from 'vue';
import type { WorkspaceDef, WorkspaceTabDef } from '../types/layout';
import {
  findTile,
  findTileByTab,
  nextId,
  treeCloseTab,
  treeMoveTab,
  treeNewTab,
  treeSetRatio,
  treeSplitTile,
  type DropZone,
  type SplitDir,
  type WorkspaceNode,
} from '../workspace/tree';

export interface WorkspaceOps {
  activateTab(tileId: string, tabId: string): void;
  closeTab(tabId: string): void;
  newTab(tileId: string): void;
  setRatio(splitId: string, ratio: number): void;
  splitTile(tileId: string, dir: SplitDir, side: 'start' | 'end', tabId: string): void;
  moveTab(tabId: string, targetTileId: string, index: number): void;
  focusTile(tileId: string): void;
}

export interface DndRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Drag-to-tile runtime state (shared between the overlay and the tiles). */
export interface DndState {
  dragging: boolean;
  tabId: string;
  sourceTileId: string;
  fromIndex: number;
  /** currently hovered tile id, '' when over no tile */
  tileId: string;
  zone: DropZone;
  /** insertion index when zone === 'center' */
  index: number;
  /** split preview rect (workspace-local coords) for edge zones */
  preview: DndRect | null;
  /** full-tile highlight rect for center (move) zones */
  glow: DndRect | null;
  /** reorder indicator (workspace-local coords) for center drops on a strip */
  indicator: { x: number; y: number; h: number } | null;
}

export interface WorkspaceApi {
  /** reactive root of the split tree */
  root: WorkspaceNode;
  /** id of the currently focused tile (bright accent); others are dimmed */
  focusedTileId: string;
  /** id of the top-right tile (where the right-panel toggle is shown) */
  readonly topRightTileId: string;
  tabDefs: Record<string, WorkspaceTabDef>;
  minTileWidth: number;
  minTileHeight: number;
  ops: WorkspaceOps;
  dnd: DndState;
  startDrag(tabId: string, tileId: string, index: number): void;
  endDrag(): void;
  registerTileEl(id: string, el: HTMLElement | null): void;
  /** live registry of tile root elements (id → el) for DnD hit-testing */
  tileEls: Map<string, HTMLElement>;
}

/** Same shape as WorkspaceApi - the whole api is provided to descendants. */
export type WorkspaceContext = WorkspaceApi;

export const kWorkspace: InjectionKey<WorkspaceContext> = Symbol('sf.workspace');

/** Right-panel toggle info, provided by Workspace.vue for tiles to use. */
export interface RightPanelToggleApi {
  visible: boolean;
  toggle: () => void;
}

export const kRightPanelToggle: InjectionKey<RightPanelToggleApi> = Symbol('sf.rightPanelToggle');

/** Find the top-right tile id in a split tree (row -> right, column -> top). */
function findTopRightTileId(node: WorkspaceNode): string {
  if (node.kind === 'tile') return node.id;
  return findTopRightTileId(node.dir === 'row' ? node.children[1] : node.children[0]);
}

export function useWorkspace(def: WorkspaceDef): WorkspaceApi {
  const minTileWidth = def.minTileWidth ?? 160;
  const minTileHeight = def.minTileHeight ?? 100;

  const state = reactive<{ root: WorkspaceNode; focusedTileId: string }>({
    root: {
      kind: 'tile',
      id: nextId('tile'),
      tabs: def.tabs.map((t) => t.id),
      activeId: def.tabs[0]?.id ?? '',
    },
    focusedTileId: '',
  });
  state.focusedTileId = state.root.id;

  const tabDefs: Record<string, WorkspaceTabDef> = {};
  for (const t of def.tabs) tabDefs[t.id] = t;

  /** Ensure focusedTileId points to an existing tile (after tree mutations). */
  function ensureFocus() {
    if (findTile(state.root, state.focusedTileId)) return;
    const stack: WorkspaceNode[] = [state.root];
    while (stack.length) {
      const n = stack.pop()!;
      if (n.kind === 'tile') { state.focusedTileId = n.id; return; }
      stack.push(n.children[1], n.children[0]);
    }
  }

  const ops: WorkspaceOps = {
    activateTab(tileId, tabId) {
      const tile = findTile(state.root, tileId);
      if (tile) {
        tile.activeId = tabId;
        state.focusedTileId = tileId;
      }
    },
    closeTab(tabId) {
      state.root = treeCloseTab(state.root, tabId);
      ensureFocus();
    },
    newTab(tileId) {
      const id = `untitled-${nextId('tab')}`;
      state.root = treeNewTab(state.root, tileId, id);
      tabDefs[id] = { id, label: 'Untitled', icon: '📄' };
    },
    setRatio(splitId, ratio) {
      state.root = treeSetRatio(state.root, splitId, ratio);
    },
    splitTile(tileId, dir, side, tabId) {
      state.root = treeSplitTile(state.root, tileId, dir, side, tabId);
      const newTile = findTileByTab(state.root, tabId);
      if (newTile) state.focusedTileId = newTile.id;
    },
    moveTab(tabId, targetTileId, index) {
      state.root = treeMoveTab(state.root, tabId, targetTileId, index);
      state.focusedTileId = targetTileId;
    },
    focusTile(tileId) {
      state.focusedTileId = tileId;
    },
  };

  // ── Drag-to-tile state ───────────────────────────────────────────────────
  const dnd = reactive<DndState>({
    dragging: false,
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

  return {
    get root() {
      return state.root;
    },
    get focusedTileId() {
      return state.focusedTileId;
    },
    get topRightTileId() {
      return findTopRightTileId(state.root);
    },
    tabDefs,
    minTileWidth,
    minTileHeight,
    ops,
    dnd,
    startDrag,
    endDrag,
    registerTileEl,
    tileEls,
  };
}
