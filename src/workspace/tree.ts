/**
 * Split-tree model for the multi-tab workspace.
 *
 * A workspace is a binary tree:
 *   - SplitNode: divides its container into two children along a direction
 *     ('row' = left|right, 'column' = top|bottom). `ratio` is the fraction of
 *     the container given to children[0] (0..1).
 *   - TileNode: a tile - an ordered list of tab ids + the active id.
 *
 * All functions are PURE (no Vue reactivity) so the tree logic is unit
 * testable in Node. The Vue composable (useWorkspace.ts) wraps them in a
 * reactive root.
 *
 * Sizing rules (implemented in the components via flexbox):
 *   - Each tile has a min width / min height (from the layout JSON).
 *   - Sizes stay proportional while the workspace resizes (ratios are fixed);
 *     the proportion is only broken when a tile reaches its min size.
 *   - A split created by drag-to-tile always gives the dragged tab 50% of
 *     the target tile (ratio 0.5), clamped by min sizes at render time.
 */

export type SplitDir = 'row' | 'column';

export type DropZone = 'left' | 'right' | 'top' | 'bottom' | 'center';

export interface SplitNode {
  kind: 'split';
  id: string;
  dir: SplitDir;
  /** fraction (0..1) of the container given to children[0] */
  ratio: number;
  children: [WorkspaceNode, WorkspaceNode];
}

export interface TileNode {
  kind: 'tile';
  id: string;
  /** ordered tab ids */
  tabs: string[];
  /** active tab id, '' when the tile is empty */
  activeId: string;
}

export type WorkspaceNode = SplitNode | TileNode;

let seq = 0;
export function nextId(prefix: 'tile' | 'split' | 'tab' | 'root'): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}-${Math.random().toString(36).slice(2, 6)}`;
}

// ── Lookup (iterative - no recursion, so tiling depth never touches the ──
//    call stack; only the Vue recursive renderer is inherently recursive)  ──

/**
 * Iterative DFS for a node id, returning the path [root, …, target]
 * (empty when not found). Paths drive the iterative replace/remove below.
 */
function findPath(root: WorkspaceNode, id: string): WorkspaceNode[] {
  const stack: WorkspaceNode[] = [root];
  const parent = new Map<WorkspaceNode, WorkspaceNode>();
  while (stack.length) {
    const n = stack.pop();
    if (!n) break;
    if (n.id === id) {
      const path = [n];
      let cur = n;
      while (parent.has(cur)) {
        const p = parent.get(cur);
        if (!p) break;
        cur = p;
        path.push(cur);
      }
      return path.reverse();
    }
    if (n.kind === 'split') {
      parent.set(n.children[1], n);
      parent.set(n.children[0], n);
      stack.push(n.children[1], n.children[0]);
    }
  }
  return [];
}

export function findNode(root: WorkspaceNode, id: string): WorkspaceNode | null {
  const stack: WorkspaceNode[] = [root];
  while (stack.length) {
    const n = stack.pop();
    if (!n) break;
    if (n.id === id) return n;
    if (n.kind === 'split') stack.push(n.children[1], n.children[0]);
  }
  return null;
}

export function findTileByTab(root: WorkspaceNode, tabId: string): TileNode | null {
  const stack: WorkspaceNode[] = [root];
  while (stack.length) {
    const n = stack.pop();
    if (!n) break;
    if (n.kind === 'tile') {
      if (n.tabs.includes(tabId)) return n;
    } else {
      stack.push(n.children[1], n.children[0]);
    }
  }
  return null;
}

export function findTile(root: WorkspaceNode, tileId: string): TileNode | null {
  const n = findNode(root, tileId);
  return n && n.kind === 'tile' ? n : null;
}

/** First tile in visual order (left-to-right, top-to-bottom). */
export function firstTile(root: WorkspaceNode): TileNode | null {
  const stack: WorkspaceNode[] = [root];
  while (stack.length) {
    const n = stack.pop();
    if (!n) break;
    if (n.kind === 'tile') return n;
    stack.push(n.children[1], n.children[0]);
  }
  return null;
}

/** Replace the node with the given id (the node itself may be the root). */
export function replaceNode(root: WorkspaceNode, id: string, newNode: WorkspaceNode): WorkspaceNode {
  const path = findPath(root, id);
  if (path.length === 0) return root; // not found
  let node = newNode;
  // Rebuild from the target up: each ancestor keeps its other child intact.
  for (let i = path.length - 2; i >= 0; i--) {
    const parent = path[i] as SplitNode;
    const other = parent.children[0].id === path[i + 1].id ? parent.children[1] : parent.children[0];
    node = { ...parent, children: parent.children[0].id === path[i + 1].id ? [node, other] : [other, node] };
  }
  return node;
}

/** Remove the tile with the given id. The root tile is never removed. */
export function removeTile(root: WorkspaceNode, tileId: string): WorkspaceNode {
  if (root.kind === 'tile') return root;
  const path = findPath(root, tileId);
  if (path.length < 2) return root; // not found, or the root itself
  // The tile's parent split is replaced by the sibling subtree (merge).
  const parent = path[path.length - 2] as SplitNode;
  const sibling = parent.children[0].id === tileId ? parent.children[1] : parent.children[0];
  return path.length === 2 ? sibling : replaceNode(path[0], parent.id, sibling);
}

// ── Min sizes (iterative post-order) ───────────────────────────────────────

/**
 * Smallest size a subtree can occupy along a dimension.
 * Tiles contribute their min; a split in the same direction sums its
 * children, an orthogonal split takes the max of its children.
 */
export function subtreeMinSize(
  node: WorkspaceNode,
  dimension: 'width' | 'height',
  minTileWidth: number,
  minTileHeight: number,
): number {
  const stack: WorkspaceNode[] = [node];
  const memo = new Map<WorkspaceNode, number>();
  while (stack.length) {
    const n = stack[stack.length - 1];
    if (n.kind === 'tile') {
      memo.set(n, dimension === 'width' ? minTileWidth : minTileHeight);
      stack.pop();
      continue;
    }
    const [a, b] = n.children;
    const va = memo.get(a);
    const vb = memo.get(b);
    if (va !== undefined && vb !== undefined) {
      const sameDir = n.dir === (dimension === 'width' ? 'row' : 'column');
      memo.set(n, sameDir ? va + vb : Math.max(va, vb));
      stack.pop();
    } else {
      stack.push(b, a);
    }
  }
  return memo.get(node) ?? (dimension === 'width' ? minTileWidth : minTileHeight);
}

/**
 * Active tab after `tabId` (at index `idx`) leaves: keep the current one if
 * it remains, else activate the tab that slid into the removed slot.
 */
function nextActive(remaining: string[], idx: number, current: string): string {
  if (remaining.includes(current)) return current;
  return remaining[Math.min(idx, remaining.length - 1)] ?? '';
}

// ── Operations (pure; each returns the new root) ───────────────────────────

/**
 * Drag-to-tile: split the tile containing `tileId` so the dragged tab gets
 * its own new tile on the given side. The new tile takes ratio 0.5 of the
 * target tile ("always try to take half").
 *   side 'start' → new tile first  (left / top)
 *   side 'end'   → new tile second (right / bottom)
 */
export function treeSplitTile(
  root: WorkspaceNode,
  tileId: string,
  dir: SplitDir,
  side: 'start' | 'end',
  tabId: string,
): WorkspaceNode {
  const target = findNode(root, tileId);
  if (target?.kind !== 'tile') return root;
  const source = findTileByTab(root, tabId);
  const sourceIsTarget = source?.id === target.id;

  const newTile: TileNode = { kind: 'tile', id: nextId('tile'), tabs: [tabId], activeId: tabId };
  const remaining = target.tabs.filter((t) => t !== tabId);
  const targetTile: TileNode = {
    ...target,
    tabs: remaining,
    activeId: nextActive(remaining, target.tabs.indexOf(tabId), target.activeId),
  };
  const split: SplitNode = {
    kind: 'split',
    id: nextId('split'),
    dir,
    ratio: 0.5,
    children: side === 'start' ? [newTile, targetTile] : [targetTile, newTile],
  };

  let newRoot = replaceNode(root, tileId, split);

  // The dragged tab also leaves its source tile (unless it was the target).
  if (source && !sourceIsTarget) {
    const sourceRemaining = source.tabs.filter((t) => t !== tabId);
    newRoot =
      sourceRemaining.length === 0
        ? removeTile(newRoot, source.id)
        : replaceNode(newRoot, source.id, {
            ...source,
            tabs: sourceRemaining,
            activeId: nextActive(sourceRemaining, source.tabs.indexOf(tabId), source.activeId),
          });
  }

  // The target lost its tab; if it became empty (and it is no longer the
  // root) remove the empty tile and merge the split away.
  if (remaining.length === 0) {
    newRoot = removeTile(newRoot, target.id);
  }
  return newRoot;
}

/**
 * Move a tab into (or within) a tile at `index`. Empty source tiles are
 * removed (unless the source is the root — an empty root tile stays).
 */
export function treeMoveTab(
  root: WorkspaceNode,
  tabId: string,
  targetTileId: string,
  index: number,
): WorkspaceNode {
  const source = findTileByTab(root, tabId);
  const target = findNode(root, targetTileId);
  if (!source || !target || target.kind !== 'tile') return root;

  const clampIndex = (i: number, len: number) => Math.min(Math.max(i, 0), len);

  if (source.id === target.id) {
    const tabs = source.tabs.filter((t) => t !== tabId);
    const idx = clampIndex(index, tabs.length);
    return replaceNode(root, source.id, {
      ...source,
      tabs: [...tabs.slice(0, idx), tabId, ...tabs.slice(idx)],
      activeId: tabId,
    });
  }

  const remaining = source.tabs.filter((t) => t !== tabId);
  const newRoot =
    remaining.length === 0
      ? removeTile(root, source.id)
      : replaceNode(root, source.id, {
          ...source,
          tabs: remaining,
          activeId: nextActive(remaining, source.tabs.indexOf(tabId), source.activeId),
        });

  const idx = clampIndex(index, target.tabs.length);
  return replaceNode(newRoot, targetTileId, {
    ...target,
    tabs: [...target.tabs.slice(0, idx), tabId, ...target.tabs.slice(idx)],
    activeId: tabId,
  });
}

export function treeCloseTab(root: WorkspaceNode, tabId: string): WorkspaceNode {
  const tile = findTileByTab(root, tabId);
  if (!tile) return root;
  const idx = tile.tabs.indexOf(tabId);
  const tabs = tile.tabs.filter((t) => t !== tabId);
  if (tabs.length === 0) {
    // An empty root tile stays (shows the empty state); any other empty
    // tile is removed and the surrounding split merges away.
    return tile.id === root.id ? { ...tile, tabs: [], activeId: '' } : removeTile(root, tile.id);
  }
  const activeId = tile.activeId === tabId ? tabs[Math.min(idx, tabs.length - 1)] : tile.activeId;
  return replaceNode(root, tile.id, { ...tile, tabs, activeId });
}

export function treeNewTab(root: WorkspaceNode, tileId: string, tabId: string): WorkspaceNode {
  const tile = findNode(root, tileId);
  if (tile?.kind !== 'tile') return root;
  return replaceNode(root, tileId, { ...tile, tabs: [...tile.tabs, tabId], activeId: tabId });
}

export function treeSetRatio(root: WorkspaceNode, splitId: string, ratio: number): WorkspaceNode {
  const split = findNode(root, splitId);
  if (split?.kind !== 'split') return root;
  const r = Math.min(0.95, Math.max(0.05, ratio));
  return replaceNode(root, splitId, { ...split, ratio: r });
}

/** Insert a tab into a tile at a specific index (no source removal).
 *  Used for cross-root moves where the tab is already removed from its
 *  source root. */
export function treeInsertTab(
  root: WorkspaceNode,
  tileId: string,
  tabId: string,
  index: number,
): WorkspaceNode {
  const tile = findTile(root, tileId);
  if (!tile) return root;
  const idx = Math.min(Math.max(index, 0), tile.tabs.length);
  const tabs = [...tile.tabs.slice(0, idx), tabId, ...tile.tabs.slice(idx)];
  return replaceNode(root, tileId, { ...tile, tabs, activeId: tabId });
}

/** Collect all tab ids from a tree in visual order (left-to-right, top-to-bottom). */
export function collectAllTabs(root: WorkspaceNode): string[] {
  const tabs: string[] = [];
  const stack: WorkspaceNode[] = [root];
  while (stack.length) {
    const n = stack.pop();
    if (!n) break;
    if (n.kind === 'tile') {
      tabs.push(...n.tabs);
    } else {
      stack.push(n.children[1], n.children[0]);
    }
  }
  return tabs;
}
