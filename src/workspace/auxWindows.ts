import { nextTick, type Ref, reactive, shallowReactive, watch } from 'vue';
import type { WorkspaceOps } from '../composables/useWorkspace';
import type { WorkspaceTabDef } from '../types/layout';
import { type AuxWindowHandle, openAuxWindow } from './auxWindow';
import { type AuxWindowSnapshot, auxWindowTabIds, captureAuxWindows, nodeFromSnapshot } from './snapshots';
import {
  BLANK_CONTENT,
  collectAllTabs,
  type DropZone,
  dirOf,
  findNode,
  findTile,
  findTileByTab,
  firstTile,
  nextId,
  type RootGroup,
  type SplitDir,
  sideOf,
  type TileNode,
  treeCloseTab,
  treeInsertTab,
  treeMoveTab,
  treeNewTab,
  treeSetRatio,
  treeSplitTile,
  type WorkspaceNode,
} from './tree';
import { registerWindowForDragTracking } from './windowDragTracker';

export interface AuxDetachOptions {
  width?: number;
  height?: number;
  windowId?: number;
  left?: number;
  top?: number;
  tileId?: string;
  zone?: DropZone;
  index?: number;
}

export interface AuxTreeState {
  roots: RootGroup[];
  rootDir: SplitDir | null;
  focusedTileId: string;
}

export const EMPTY_AUX_TREE: AuxTreeState = { roots: [], rootDir: null, focusedTileId: '' };

export interface AuxWindowsHost {
  readonly mainWindow: Window;
  readonly tabDefs: Record<string, WorkspaceTabDef>;
  readonly mobile: Ref<boolean> | null;
  mainOps(): WorkspaceOps;
  onGesture(windowId: number): void;
  onAuxWindowClosed(windowId: number): void;
  releaseTabResources(tabId: string): void;
  ownsTab(tabId: string): boolean;
  evictTab(tabId: string): void;
  adoptTab(tabId: string, tileId: string | undefined, index: number | undefined): boolean;
}

export interface AuxWindows {
  readonly detached: ReadonlyMap<string, number>;
  readonly auxMobile: ReadonlyMap<number, boolean>;
  readonly auxTrees: ReadonlyMap<number, AuxTreeState>;
  ids(): number[];
  isMobile(windowId: number): boolean;
  contentEl(windowId: number): HTMLElement | null;
  isIdle(): boolean;
  cachedApi(windowId: number): unknown;
  registerApi(windowId: number, api: unknown): void;
  ownerOf(tabId: string): number | undefined;
  removeTab(tabId: string): number | undefined;
  closeEmpty(windowId: number, closeNow?: boolean): void;
  tabWindow(tabId: string): number | null;
  focusTab(tabId: string): boolean;
  closeTab(tabId: string): boolean;
  detachTab(tabId: string, opts?: AuxDetachOptions): boolean;
  reattachTab(tabId: string, tileId?: string, index?: number): boolean;
  activateAuxTab(windowId: number, tabId: string): void;
  moveTabIntoWindow(tabId: string, windowId: number, tileId: string, zone: DropZone, index?: number): void;
  moveDetachedTab(
    tabId: string,
    targetWindowId: number | undefined,
    position?: { screenX?: number; screenY?: number },
  ): boolean;
  inActionWindow(run: (ops: WorkspaceOps, tileId: string) => void): boolean;
  latchActionWindow(windowId: number): void;
  ops(windowId: number): WorkspaceOps;
  allTabIds(): string[];
  windowSnapshots(skipTab?: (tabId: string) => boolean): AuxWindowSnapshot[];
  restoreWindows(windows: AuxWindowSnapshot[], foldBack: (ids: string[]) => void): void;
}

function singleTabTree(tabId: string): AuxTreeState {
  return {
    roots: [
      {
        id: nextId('root'),
        node: { kind: 'tile', id: nextId('tile'), tabs: [tabId], activeId: tabId },
        ratio: 1,
      },
    ],
    rootDir: null,
    focusedTileId: '',
  };
}

export function createAuxWindows(host: AuxWindowsHost): AuxWindows {
  const detached = shallowReactive(new Map<string, number>());
  const auxWindows = new Map<number, AuxWindowHandle>();
  const auxTrees = reactive(new Map<number, AuxTreeState>());
  const auxMobile = shallowReactive(new Map<number, boolean>());
  const auxApis = new Map<number, unknown>();

  function auxTabsOf(windowId: number): string[] {
    const tree = auxTrees.get(windowId);
    if (!tree) return [];
    const tabs: string[] = [];
    for (const root of tree.roots) tabs.push(...collectAllTabs(root.node));
    return tabs;
  }

  function auxEnsureFocus(tree: AuxTreeState) {
    for (const root of tree.roots) {
      if (findTile(root.node, tree.focusedTileId)) return;
    }
    const first = tree.roots[0];
    if (!first) return;
    const stack: WorkspaceNode[] = [first.node];
    while (stack.length) {
      const n = stack.pop();
      if (!n) break;
      if (n.kind === 'tile') {
        tree.focusedTileId = n.id;
        return;
      }
      stack.push(n.children[1], n.children[0]);
    }
  }

  function auxRemoveRoot(tree: AuxTreeState, index: number) {
    const removed = tree.roots[index];
    if (!removed) return;
    tree.roots.splice(index, 1);
    if (tree.roots.length <= 1) tree.rootDir = null;
    if (tree.roots.length === 0) return;
    const total = tree.roots.reduce((s, r) => s + r.ratio, 0);
    if (total > 0) {
      for (const r of tree.roots) r.ratio += removed.ratio * (r.ratio / total);
    } else {
      tree.roots.forEach((r) => {
        r.ratio = 1 / tree.roots.length;
      });
    }
  }

  function detachRootFromTab(tree: AuxTreeState, root: RootGroup, tabId: string) {
    root.node = treeCloseTab(root.node, tabId);
    if (root.node.kind === 'tile' && root.node.tabs.length === 0 && tree.roots.length > 1) {
      auxRemoveRoot(tree, tree.roots.indexOf(root));
    }
  }

  function auxRootByTab(windowId: number, tabId: string): RootGroup | null {
    const tree = auxTrees.get(windowId);
    return tree?.roots.find((r) => findTileByTab(r.node, tabId)) ?? null;
  }

  function auxRootForTile(windowId: number, tileId: string): RootGroup | null {
    const tree = auxTrees.get(windowId);
    return tree?.roots.find((r) => findTile(r.node, tileId)) ?? null;
  }

  function auxWindowHoldingTab(tabId: string): number | undefined {
    for (const [auxId, tree] of auxTrees) {
      if (tree.roots.some((r) => findTileByTab(r.node, tabId))) return auxId;
    }
    return undefined;
  }

  let actionWindow = 0;
  const gestureCleanups = new Map<number, () => void>();

  function latchActionWindow(windowId: number) {
    actionWindow = windowId;
    host.onGesture(windowId);
  }

  function latchFromWindow(windowId: number) {
    return () => latchActionWindow(windowId);
  }

  host.mainWindow.addEventListener('pointerdown', latchFromWindow(0), true);
  host.mainWindow.addEventListener('keydown', latchFromWindow(0), true);

  function auxFocusedTileId(windowId: number): string {
    const tree = auxTrees.get(windowId);
    if (!tree) return '';
    for (const root of tree.roots) {
      if (findTile(root.node, tree.focusedTileId)) return tree.focusedTileId;
    }
    for (const root of tree.roots) {
      const first = firstTile(root.node);
      if (first) return first.id;
    }
    return '';
  }

  function inActionWindow(run: (ops: WorkspaceOps, tileId: string) => void): boolean {
    if (actionWindow === 0 || !auxWindows.has(actionWindow)) return false;
    run(auxOps(actionWindow), auxFocusedTileId(actionWindow));
    return true;
  }

  function auxRemoveTab(tabId: string): number | undefined {
    const windowId = detached.get(tabId) ?? auxWindowHoldingTab(tabId);
    if (windowId === undefined) return undefined;
    detached.delete(tabId);
    const tree = auxTrees.get(windowId);
    if (!tree) return windowId;
    const root = tree.roots.find((r) => findTileByTab(r.node, tabId));
    if (root) {
      detachRootFromTab(tree, root, tabId);
      auxEnsureFocus(tree);
    }
    return windowId;
  }

  function auxInsertIntoTile(
    windowId: number,
    tileId: string,
    tabId: string,
    index: number | undefined,
  ): boolean {
    const root = auxRootForTile(windowId, tileId);
    if (!root) return false;
    const tile = findTile(root.node, tileId);
    if (!tile) return false;
    root.node = treeInsertTab(root.node, tileId, tabId, index ?? tile.tabs.length);
    const tree = auxTrees.get(windowId);
    if (tree) tree.focusedTileId = tileId;
    detached.set(tabId, windowId);
    return true;
  }

  function auxInsertFocused(windowId: number, tabId: string): boolean {
    const tree = auxTrees.get(windowId);
    if (!tree) return false;
    return auxInsertIntoTile(windowId, tree.focusedTileId, tabId, undefined);
  }

  function auxSplitTile(
    windowId: number,
    tileId: string,
    dir: SplitDir,
    side: 'start' | 'end',
    tabId: string,
  ): boolean {
    const tree = auxTrees.get(windowId);
    if (!tree) return false;
    const targetRoot = auxRootForTile(windowId, tileId);
    if (!targetRoot) return false;
    const sourceRoot = auxRootByTab(windowId, tabId);
    if (sourceRoot && sourceRoot !== targetRoot) {
      detachRootFromTab(tree, sourceRoot, tabId);
    }
    const isRootTile = targetRoot.node.kind === 'tile' && targetRoot.node.id === tileId;
    const createsNewRoot = isRootTile && (tree.rootDir === null || tree.rootDir === dir);
    if (createsNewRoot) {
      if (sourceRoot) {
        detachRootFromTab(tree, sourceRoot, tabId);
      }
      if (tree.rootDir === null) tree.rootDir = dir;
      const targetIdx = tree.roots.indexOf(targetRoot);
      const newTile: TileNode = { kind: 'tile', id: nextId('tile'), tabs: [tabId], activeId: tabId };
      const newRoot: RootGroup = { id: nextId('root'), node: newTile, ratio: targetRoot.ratio / 2 };
      targetRoot.ratio /= 2;
      tree.roots.splice(side === 'start' ? targetIdx : targetIdx + 1, 0, newRoot);
      tree.focusedTileId = newTile.id;
      return true;
    }
    targetRoot.node = treeSplitTile(targetRoot.node, tileId, dir, side, tabId);
    const newTile = findTileByTab(targetRoot.node, tabId);
    if (newTile) tree.focusedTileId = newTile.id;
    return true;
  }

  function auxMoveTab(windowId: number, tabId: string, targetTileId: string, index: number): boolean {
    const tree = auxTrees.get(windowId);
    if (!tree) return false;
    const sourceRoot = auxRootByTab(windowId, tabId);
    const targetRoot = auxRootForTile(windowId, targetTileId);
    if (!sourceRoot || !targetRoot) return false;
    if (sourceRoot === targetRoot) {
      sourceRoot.node = treeMoveTab(sourceRoot.node, tabId, targetTileId, index);
    } else {
      detachRootFromTab(tree, sourceRoot, tabId);
      targetRoot.node = treeInsertTab(targetRoot.node, targetTileId, tabId, index);
    }
    tree.focusedTileId = targetTileId;
    return true;
  }

  function syncAuxTitle(windowId: number) {
    const handle = auxWindows.get(windowId);
    const tree = auxTrees.get(windowId);
    if (!handle || !tree) return;
    let focusedNode: WorkspaceNode | null = null;
    for (const root of tree.roots) {
      if (findTile(root.node, tree.focusedTileId)) {
        focusedNode = root.node;
        break;
      }
    }
    const tile = focusedNode ? findTile(focusedNode, tree.focusedTileId) : null;
    const def = tile ? host.tabDefs[tile.activeId] : undefined;
    const title = def?.label;
    if (title && handle.document.title !== title) handle.document.title = title;
  }

  watch(
    auxTrees,
    () => {
      for (const id of auxTrees.keys()) syncAuxTitle(id);
    },
    { deep: true },
  );

  function closeEmpty(windowId: number, closeNow = false) {
    if (auxTabsOf(windowId).length > 0) return;
    const handle = auxWindows.get(windowId);
    auxTrees.delete(windowId);
    auxApis.delete(windowId);
    if (handle) {
      if (closeNow) handle.close();
      else void nextTick().then(() => handle.close());
    }
  }

  function bindAuxWindow(handle: AuxWindowHandle) {
    auxWindows.set(handle.id, handle);
    auxMobile.set(handle.id, handle.isMobile());
    handle.onMobileChange(() => {
      auxMobile.set(handle.id, handle.isMobile());
    });
    registerWindowForDragTracking(handle.window, handle.id);
    const latch = latchFromWindow(handle.id);
    handle.window.addEventListener('pointerdown', latch, true);
    handle.window.addEventListener('keydown', latch, true);
    gestureCleanups.set(handle.id, () => {
      handle.window.removeEventListener('pointerdown', latch, true);
      handle.window.removeEventListener('keydown', latch, true);
    });
    handle.onClosed(() => {
      auxMobile.delete(handle.id);
      for (const tabId of auxTabsOf(handle.id)) {
        reattachDetached(tabId, undefined, undefined, true);
      }
      auxWindows.delete(handle.id);
      auxTrees.delete(handle.id);
      if (actionWindow === handle.id) actionWindow = 0;
      gestureCleanups.get(handle.id)?.();
      gestureCleanups.delete(handle.id);
      host.onAuxWindowClosed(handle.id);
    });
  }

  function moveDetachedTab(
    tabId: string,
    targetWindowId: number | undefined,
    position?: { screenX?: number; screenY?: number },
  ): boolean {
    const currentWindowId = detached.get(tabId);
    if (currentWindowId === undefined) return false;
    if (targetWindowId !== undefined) {
      if (targetWindowId === currentWindowId) return false;
      if (!auxTrees.has(targetWindowId)) return false;
      auxRemoveTab(tabId);
      if (!auxInsertFocused(targetWindowId, tabId)) return false;
      syncAuxTitle(targetWindowId);
      closeEmpty(currentWindowId);
      return true;
    }
    const handle = openAuxWindow({
      title: host.tabDefs[tabId]?.label ?? 'Window',
      width: 960,
      height: 720,
      left: position?.screenX ? Math.max(0, position.screenX - 80) : undefined,
      top: position?.screenY ? Math.max(0, position.screenY - 24) : undefined,
    });
    if (!handle) return false;
    bindAuxWindow(handle);
    auxRemoveTab(tabId);
    const tree = singleTabTree(tabId);
    auxTrees.set(handle.id, tree);
    auxEnsureFocus(tree);
    detached.set(tabId, handle.id);
    closeEmpty(currentWindowId);
    syncAuxTitle(handle.id);
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
    if (!host.adoptTab(tabId, tileId, index)) return false;
    auxRemoveTab(tabId);
    closeEmpty(windowId, closeNow);
    return true;
  }

  function activateAuxTab(windowId: number, tabId: string) {
    if (detached.get(tabId) !== windowId) return;
    const tree = auxTrees.get(windowId);
    if (!tree) return;
    for (const root of tree.roots) {
      const tile = findTileByTab(root.node, tabId);
      if (tile) {
        tile.activeId = tabId;
        tree.focusedTileId = tile.id;
        return;
      }
    }
  }

  function tabWindow(tabId: string): number | null {
    const wid = detached.get(tabId);
    if (wid !== undefined) return wid;
    if (host.ownsTab(tabId)) return 0;
    return auxWindowHoldingTab(tabId) ?? null;
  }

  function auxOps(windowId: number): WorkspaceOps {
    const mainOps = host.mainOps();
    return {
      activateTab(tileId, tabId) {
        const root = auxRootForTile(windowId, tileId);
        if (!root) return;
        const tile = findTile(root.node, tileId);
        if (!tile) return;
        tile.activeId = tabId;
        const tree = auxTrees.get(windowId);
        if (tree) tree.focusedTileId = tileId;
      },
      closeTab(tabId) {
        mainOps.closeTab(tabId);
      },
      newTab(tileId) {
        const root = auxRootForTile(windowId, tileId);
        if (!root) return;
        const id = `untitled-${nextId('tab')}`;
        root.node = treeNewTab(root.node, tileId, id);
        host.tabDefs[id] = { id, label: 'Untitled', icon: '📄' };
      },
      openTab(tileId, tab) {
        const root = auxRootForTile(windowId, tileId);
        if (!root) return;
        host.tabDefs[tab.id] = tab;
        root.node = treeNewTab(root.node, tileId, tab.id);
        const tree = auxTrees.get(windowId);
        if (tree) tree.focusedTileId = tileId;
      },
      insertTab(tileId, index, tab) {
        const root = auxRootForTile(windowId, tileId);
        if (!root) return;
        host.tabDefs[tab.id] = tab;
        root.node = treeInsertTab(root.node, tileId, tab.id, index);
        const tree = auxTrees.get(windowId);
        if (tree) tree.focusedTileId = tileId;
      },
      splitOpen(tileId, dir, side, tab) {
        const root = auxRootForTile(windowId, tileId);
        if (!root) return;
        host.tabDefs[tab.id] = tab;
        root.node = treeNewTab(root.node, tileId, tab.id);
        auxSplitTile(windowId, tileId, dir, side, tab.id);
        const newTile = findTileByTab(root.node, tab.id);
        const tree = auxTrees.get(windowId);
        if (newTile && tree) tree.focusedTileId = newTile.id;
      },
      setRatio(splitId, ratio) {
        const tree = auxTrees.get(windowId);
        if (!tree) return;
        const root = tree.roots.find((r) => findNode(r.node, splitId));
        if (!root) return;
        root.node = treeSetRatio(root.node, splitId, ratio);
      },
      setRootRatio(index, ratio) {
        const tree = auxTrees.get(windowId);
        if (!tree) return;
        if (index < 0 || index >= tree.roots.length - 1) return;
        const left = tree.roots[index];
        const right = tree.roots[index + 1];
        const total = left.ratio + right.ratio;
        const r = Math.min(0.95, Math.max(0.05, ratio));
        left.ratio = r * total;
        right.ratio = (1 - r) * total;
      },
      evenlySpace() {
        const tree = auxTrees.get(windowId);
        if (!tree) return;
        const n = tree.roots.length;
        if (n === 0) return;
        for (const r of tree.roots) r.ratio = 1 / n;
      },
      mergeAll() {
        const tree = auxTrees.get(windowId);
        if (!tree) return;
        const allTabs: string[] = [];
        for (const root of tree.roots) allTabs.push(...collectAllTabs(root.node));
        if (allTabs.length === 0) return;
        const newTile: TileNode = {
          kind: 'tile',
          id: nextId('tile'),
          tabs: allTabs,
          activeId: allTabs[0],
        };
        tree.roots = [{ id: nextId('root'), node: newTile, ratio: 1 }];
        tree.rootDir = null;
        tree.focusedTileId = newTile.id;
      },
      splitTile(tileId, dir, side, tabId) {
        auxSplitTile(windowId, tileId, dir, side, tabId);
      },
      moveTab(tabId, targetTileId, index) {
        auxMoveTab(windowId, tabId, targetTileId, index);
      },
      focusTile(tileId) {
        const tree = auxTrees.get(windowId);
        if (tree && auxRootForTile(windowId, tileId)) tree.focusedTileId = tileId;
      },
      detachTab(t, o) {
        return mainOps.detachTab(t, o);
      },
      reattachTab(t, tileId, index) {
        return mainOps.reattachTab(t, tileId, index);
      },
      activateAuxTab(w, t) {
        mainOps.activateAuxTab(w, t);
      },
      moveAuxTabIntoWorkspace(t, tileId, zone, index) {
        mainOps.moveTabIntoWindow(t, 0, tileId, zone, index);
      },
      moveTabIntoWindow(t, w, tileId, zone, index) {
        mainOps.moveTabIntoWindow(t, w, tileId, zone, index);
      },
      moveDetachedTab(t, w, p) {
        return mainOps.moveDetachedTab(t, w, p);
      },
    };
  }

  function detachTab(tabId: string, opts?: AuxDetachOptions): boolean {
    const def = host.tabDefs[tabId];
    if (!def?.content || def.content === BLANK_CONTENT) return false;
    if (detached.has(tabId)) return false;
    if (host.mobile?.value) return false;
    const targetWindowId = opts?.windowId;
    if (targetWindowId === undefined) {
      const handle = openAuxWindow({
        title: def.label,
        width: opts?.width,
        height: opts?.height,
        left: opts?.left,
        top: opts?.top,
      });
      if (!handle) return false;
      bindAuxWindow(handle);
      host.evictTab(tabId);
      const tree = singleTabTree(tabId);
      auxTrees.set(handle.id, tree);
      auxEnsureFocus(tree);
      detached.set(tabId, handle.id);
      syncAuxTitle(handle.id);
      return true;
    }
    if (!auxTrees.has(targetWindowId)) return false;
    if (opts?.tileId) {
      if (!auxInsertIntoTile(targetWindowId, opts.tileId, tabId, opts.index)) return false;
    } else if (!auxInsertFocused(targetWindowId, tabId)) {
      return false;
    }
    host.evictTab(tabId);
    if (opts?.zone && opts.zone !== 'center') {
      auxSplitTile(targetWindowId, opts.tileId ?? '', dirOf(opts.zone), sideOf(opts.zone), tabId);
    }
    syncAuxTitle(targetWindowId);
    return true;
  }

  function moveTabIntoWindow(
    tabId: string,
    windowId: number,
    tileId: string,
    zone: DropZone,
    index?: number,
  ): void {
    const mainOps = host.mainOps();
    if (windowId === 0) {
      if (host.mobile?.value) return;
      if (!detached.has(tabId)) return;
      if (!reattachDetached(tabId, tileId, undefined, false)) return;
      if (zone === 'center') {
        if (typeof index === 'number' && index >= 0) mainOps.moveTab(tabId, tileId, index);
        return;
      }
      mainOps.splitTile(tileId, dirOf(zone), sideOf(zone), tabId);
      return;
    }
    if (host.mobile?.value) return;
    const def = host.tabDefs[tabId];
    if (!def?.content || def.content === BLANK_CONTENT) return;
    if (!auxTrees.has(windowId)) return;
    const srcWin = tabWindow(tabId);
    if (srcWin === windowId) {
      if (zone === 'center') {
        if (typeof index === 'number' && index >= 0) auxMoveTab(windowId, tabId, tileId, index);
        return;
      }
      auxSplitTile(windowId, tileId, dirOf(zone), sideOf(zone), tabId);
      return;
    }
    if (srcWin === 0) {
      mainOps.detachTab(tabId, { windowId, tileId, zone, index });
      return;
    }
    if (!moveDetachedTab(tabId, windowId, undefined)) return;
    if (zone === 'center') {
      if (typeof index === 'number' && index >= 0) auxMoveTab(windowId, tabId, tileId, index);
      return;
    }
    auxSplitTile(windowId, tileId, dirOf(zone), sideOf(zone), tabId);
  }

  function restoreWindows(windows: AuxWindowSnapshot[], foldBack: (ids: string[]) => void) {
    for (const w of windows) {
      const ids = auxWindowTabIds(w);
      const firstSnap = w.roots[0]?.node;
      const firstActive = firstSnap?.kind === 'tile' ? firstSnap.activeId : '';
      const handle = openAuxWindow({
        title: host.tabDefs[firstActive]?.label ?? 'Window',
        width: w.geometry?.width,
        height: w.geometry?.height,
        left: w.geometry?.left,
        top: w.geometry?.top,
        windowId: w.id,
      });
      if (!handle) {
        foldBack(ids);
        continue;
      }
      bindAuxWindow(handle);
      const tree: AuxTreeState = {
        roots: w.roots.map((r) => ({
          id: nextId('root'),
          node: nodeFromSnapshot(r.node),
          ratio: r.ratio,
        })),
        rootDir: w.rootDir ?? null,
        focusedTileId: '',
      };
      for (const id of ids) detached.set(id, w.id);
      auxTrees.set(w.id, tree);
      auxEnsureFocus(tree);
      syncAuxTitle(w.id);
    }
  }

  return {
    detached,
    auxMobile,
    auxTrees,
    ids: () => [...auxTrees.keys()],
    isMobile: (windowId) => auxWindows.get(windowId)?.isMobile() ?? false,
    contentEl: (windowId) => auxWindows.get(windowId)?.content ?? null,
    isIdle: () => auxTrees.size === 0 && detached.size === 0,
    cachedApi: (windowId) => auxApis.get(windowId),
    registerApi: (windowId, api) => {
      auxApis.set(windowId, api);
    },
    ownerOf: (tabId) => detached.get(tabId) ?? auxWindowHoldingTab(tabId),
    removeTab: auxRemoveTab,
    closeEmpty,
    tabWindow,
    focusTab(tabId) {
      const owner = auxWindowHoldingTab(tabId);
      if (owner === undefined) return false;
      const tree = auxTrees.get(owner);
      const root = tree?.roots.find((r) => findTileByTab(r.node, tabId));
      const tile = root ? findTileByTab(root.node, tabId) : null;
      if (!tree || !root || !tile) return false;
      tile.activeId = tabId;
      tree.focusedTileId = tile.id;
      return true;
    },
    closeTab(tabId) {
      const windowId = detached.get(tabId) ?? auxWindowHoldingTab(tabId);
      if (windowId === undefined) return false;
      host.releaseTabResources(tabId);
      auxRemoveTab(tabId);
      closeEmpty(windowId);
      return true;
    },
    detachTab,
    reattachTab(tabId, tileId, index) {
      if (!detached.has(tabId)) return false;
      return reattachDetached(tabId, tileId, index, false);
    },
    activateAuxTab,
    moveTabIntoWindow,
    moveDetachedTab(tabId, targetWindowId, position) {
      if (host.mobile?.value) return false;
      return moveDetachedTab(tabId, targetWindowId, position);
    },
    inActionWindow,
    latchActionWindow,
    ops: auxOps,
    allTabIds() {
      const ids = new Set<string>();
      for (const id of detached.keys()) ids.add(id);
      for (const tree of auxTrees.values()) {
        for (const root of tree.roots) {
          for (const id of collectAllTabs(root.node)) ids.add(id);
        }
      }
      return [...ids];
    },
    windowSnapshots(skipTab) {
      return captureAuxWindows(
        [...auxTrees.entries()].map(([id, tree]) => ({
          id,
          rootDir: tree.rootDir,
          roots: tree.roots,
          geometry: auxWindows.get(id)?.geometry(),
        })),
        skipTab,
      );
    },
    restoreWindows,
  };
}
