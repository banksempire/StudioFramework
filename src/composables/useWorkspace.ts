import { reactive, type InjectionKey } from 'vue';
import type { WorkspaceDef, WorkspaceTabDef } from '../types/layout';
import {
  findNode,
  findTile,
  findTileByTab,
  nextId,
  treeCloseTab,
  treeInsertTab,
  treeMoveTab,
  treeNewTab,
  treeSetRatio,
  treeSplitTile,
  collectAllTabs,
  type DropZone,
  type SplitDir,
  type TileNode,
  type WorkspaceNode,
} from '../workspace/tree';

// ── Root group model ────────────────────────────────────────────────────────
// The workspace has N root groups arranged in a single direction (row = side
// by side, column = stacked). Each root is an independent tree that can
// contain both row and column splits. Splits on a root tile in the root
// direction create new root groups; all other splits stay within the tree.

export interface RootGroup {
  id: string;
  node: WorkspaceNode;
  /** width fraction (0..1); all roots sum to 1 */
  ratio: number;
}

export interface WorkspaceOps {
  activateTab(tileId: string, tabId: string): void;
  closeTab(tabId: string): void;
  newTab(tileId: string): void;
  /** Insert a runtime-defined tab (definition registered in tabDefs). */
  openTab(tileId: string, tab: WorkspaceTabDef): void;
  /** Insert a runtime-defined tab at a specific position in a tile. */
  insertTab(tileId: string, index: number, tab: WorkspaceTabDef): void;
  /** Split a tile and open a runtime-defined tab in the new half. */
  splitOpen(tileId: string, dir: SplitDir, side: 'start' | 'end', tab: WorkspaceTabDef): void;
  setRatio(splitId: string, ratio: number): void;
  setRootRatio(index: number, ratio: number): void;
  evenlySpace(): void;
  mergeAll(): void;
  splitTile(tileId: string, dir: SplitDir, side: 'start' | 'end', tabId: string): void;
  moveTab(tabId: string, targetTileId: string, index: number): void;
  focusTile(tileId: string): void;
}

export interface DndRect {
  x: number;
  y: number;
  w: number;
  h: number;
  /** per-corner border-radius (tl tr br bl); only workspace-edge corners round */
  radius?: string;
}

export interface DndState {
  dragging: boolean;
  /** True while an EXTERNAL drag (non-tab, e.g. a panel item) hovers the workspace. */
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

/** Drop target for external drags: the tile, its drop zone, and the tab index. */
export interface ExternalDropTarget {
  tileId: string;
  zone: DropZone;
  /** tab insertion index for zone 'center' (tab-strip hover) */
  index: number;
}

export interface WorkspaceApi {
  roots: RootGroup[];
  /** direction of root arrangement (set by first root-level split) */
  rootDir: SplitDir | null;
  focusedTileId: string;
  readonly topRightTileId: string;
  tabDefs: Record<string, WorkspaceTabDef>;
  /** tab-content key rendered inside an empty tile (no tabs open), if any */
  readonly emptyContent: string;
  minTileWidth: number;
  minTileHeight: number;
  ops: WorkspaceOps;
  dnd: DndState;
  startDrag(tabId: string, tileId: string, index: number): void;
  endDrag(): void;
  registerTileEl(id: string, el: HTMLElement | null): void;
  /** Tooltip of the tile strip "+" button (default "New file"). */
  readonly newTabTitle: string;
  /**
   * Override the tile strip "+" button. When a handler is set, clicking "+"
   * calls it (with the tile id) instead of creating the generic "Untitled"
   * tab — host apps decide what a new workspace item means (e.g. "New Chat").
   * Pass `null` to restore the default behavior/title.
   */
  setNewTabHandler(handler: ((tileId: string) => void) | null, title?: string): void;
  tileEls: Map<string, HTMLElement>;
  /** Find a tile across all roots. */
  findTileGlobal(tileId: string): TileNode | null;
  /** Find the tile holding a tab across all roots. */
  findTabGlobal(tabId: string): TileNode | null;
  /**
   * Tab-click notification: called whenever the user clicks a tab element
   * (host apps can distinguish real clicks from programmatic activation,
   * e.g. for preview/review semantics). Pass `null` to disable.
   */
  setTabClickHandler(handler: ((tabId: string) => void) | null): void;
  /** Internal: fire the registered tab-click handler (called by tiles). */
  notifyTabClick(tabId: string): void;
  /**
   * External drop support: host apps register a predicate over the
   * dataTransfer types (their own drag payload) and a handler that receives
   * the drop event + target. The framework stays payload-agnostic — it only
   * shows the same hover zones/previews as tab drags and forwards the drop.
   * Pass `null`/`null` to disable.
   */
  setExternalDropHandler(
    accepts: ((types: string[]) => boolean) | null,
    handler: ((e: DragEvent, target: ExternalDropTarget) => void) | null,
  ): void;
  /** Does the registered predicate accept this dataTransfer's types? */
  acceptsExternal(types: string[]): boolean;
  /** Forward a drop to the registered handler (no-op if none). */
  deliverExternalDrop(e: DragEvent, target: ExternalDropTarget): void;
}

export type WorkspaceContext = WorkspaceApi;

export const kWorkspace: InjectionKey<WorkspaceContext> = Symbol('sf.workspace');

export interface RightPanelToggleApi {
  visible: boolean;
  toggle: () => void;
}

export const kRightPanelToggle: InjectionKey<RightPanelToggleApi> = Symbol('sf.rightPanelToggle');

/** Find the top-right tile in a tree (row -> right, column -> top). */
function findTopRightTileId(node: WorkspaceNode): string {
  if (node.kind === 'tile') return node.id;
  return findTopRightTileId(node.dir === 'row' ? node.children[1] : node.children[0]);
}

export function useWorkspace(def: WorkspaceDef): WorkspaceApi {
  const minTileWidth = def.minTileWidth ?? 160;
  const minTileHeight = def.minTileHeight ?? 100;

  const initialTileId = nextId('tile');
  const state = reactive<{ roots: RootGroup[]; focusedTileId: string; rootDir: SplitDir | null; newTabTitle: string }>({
    roots: [{
      id: nextId('root'),
      node: {
        kind: 'tile',
        id: initialTileId,
        tabs: def.tabs.map((t) => t.id),
        activeId: def.tabs[0]?.id ?? '',
      },
      ratio: 1,
    }],
    // The initial root is always a single tile, so it starts focused.
    focusedTileId: initialTileId,
    rootDir: null,
    newTabTitle: 'New file',
  });

  // ── Tile strip "+" extension point ─────────────────────────────────────
  // By default "+" appends a generic "Untitled" tab (editor-like default).
  // Host apps can replace the whole behavior via setNewTabHandler so what a
  // new workspace item means is decided by the app, not the framework.
  let newTabHandler: ((tileId: string) => void) | null = null;

  function setNewTabHandler(handler: ((tileId: string) => void) | null, title?: string) {
    newTabHandler = handler;
    if (title !== undefined) state.newTabTitle = title;
    else if (!handler) state.newTabTitle = 'New file';
  }

  // ── External drop support ──────────────────────────────────────────────
  // Host apps register a payload predicate + drop handler; the framework
  // only renders the hover zones and forwards the drop (payload-agnostic).
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

  // ── Tab-click hook ──────────────────────────────────────────────────────
  // Real user clicks on a tab element (distinct from programmatic
  // activation via ops). Host apps decide what a click means.
  let tabClickHandler: ((tabId: string) => void) | null = null;

  function setTabClickHandler(handler: ((tabId: string) => void) | null) {
    tabClickHandler = handler;
  }

  function notifyTabClick(tabId: string) {
    tabClickHandler?.(tabId);
  }

  const tabDefs = reactive<Record<string, WorkspaceTabDef>>({});
  for (const t of def.tabs) tabDefs[t.id] = t;

  // ── Helpers ─────────────────────────────────────────────────────────────

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

  /** Remove a root by index and redistribute its ratio proportionally. */
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
      state.roots.forEach((r) => (r.ratio = 1 / state.roots.length));
    }
  }

  /** Remove a tab from whichever root contains it. Empty roots are removed. */
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
      const n = stack.pop()!;
      if (n.kind === 'tile') { state.focusedTileId = n.id; return; }
      stack.push(n.children[1], n.children[0]);
    }
  }

  // ── Operations ──────────────────────────────────────────────────────────

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
      // Host-app override: the app decides what "+" creates (if anything).
      if (newTabHandler) { newTabHandler(tileId); return; }
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

      // A split on a root tile (in the root arrangement direction) creates a
      // new root group; the new tab gets the new half. Mirrors splitTile,
      // minus the source-tab removal (the tab never existed before).
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
        // Insert-then-split: append the tab to the target tile, then split
        // it — treeSplitTile moves the tab into the new half.
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
      // Collect all tabs from all roots in visual order
      const allTabs: string[] = [];
      for (const root of state.roots) allTabs.push(...collectAllTabs(root.node));
      if (allTabs.length === 0) return;

      // Try to keep the currently active tab active
      let activeId = allTabs[0];
      for (const root of state.roots) {
        const tile = findTile(root.node, state.focusedTileId);
        if (tile && tile.activeId && allTabs.includes(tile.activeId)) {
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

      // A split on a root tile (root.node IS this tile) creates a new root
      // group, IF the direction matches the root arrangement direction (or
      // no direction is set yet - the first split sets it).
      // Splits in the orthogonal direction, or splits on nested tiles, use
      // treeSplitTile within the root's tree.
      const isRootTile = root.node.kind === 'tile' && root.node.id === tileId;
      const createsNewRoot = isRootTile && (state.rootDir === null || state.rootDir === dir);

      if (createsNewRoot) {
        // Set root direction on first split
        if (state.rootDir === null) state.rootDir = dir;

        const targetRootId = root.id;
        const targetOrigIdx = state.roots.indexOf(root);

        // Remove tab from source
        removeTabFromRoots(tabId);

        // Create new root
        const newTile: TileNode = { kind: 'tile', id: nextId('tile'), tabs: [tabId], activeId: tabId };
        const newRoot: RootGroup = { id: nextId('root'), node: newTile, ratio: 0 };

        // Check if target root still exists
        const targetIdx = state.roots.findIndex((r) => r.id === targetRootId);
        if (targetIdx >= 0) {
          const target = state.roots[targetIdx];
          if (isRootEmpty(target)) {
            // Target root became empty (had only the dragged tab) - replace it
            newRoot.ratio = target.ratio;
            state.roots.splice(targetIdx, 1, newRoot);
          } else {
            // Target root still has tabs - take half its ratio
            newRoot.ratio = target.ratio / 2;
            target.ratio /= 2;
            const insertIdx = side === 'start' ? targetIdx : targetIdx + 1;
            state.roots.splice(insertIdx, 0, newRoot);
          }
        } else {
          // Target root was removed - take half from nearest root or use full ratio
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
        state.focusedTileId = newTile.id;
      } else {
        // Split within the root's tree (nested tile, or orthogonal direction)
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
        // Cross-root: remove from source, insert into target
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

  // ── Drag-to-tile state ───────────────────────────────────────────────────

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
      // Row-direction: rightmost root (last). Column-direction: topmost root (first).
      const root = state.rootDir === 'column'
        ? state.roots[0]
        : state.roots[state.roots.length - 1];
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
  };
}
