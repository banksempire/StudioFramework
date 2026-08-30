export type SplitDir = 'row' | 'column';

export type DropZone = 'left' | 'right' | 'top' | 'bottom' | 'center';

export interface SplitNode {
  kind: 'split';
  id: string;
  dir: SplitDir;
  ratio: number;
  children: [WorkspaceNode, WorkspaceNode];
}

export interface TileNode {
  kind: 'tile';
  id: string;
  tabs: string[];
  activeId: string;
}

export type WorkspaceNode = SplitNode | TileNode;

let seq = 0;
export function nextId(prefix: 'tile' | 'split' | 'tab' | 'root'): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}-${Math.random().toString(36).slice(2, 6)}`;
}

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

export function replaceNode(root: WorkspaceNode, id: string, newNode: WorkspaceNode): WorkspaceNode {
  const path = findPath(root, id);
  if (path.length === 0) return root;
  let node = newNode;
  for (let i = path.length - 2; i >= 0; i--) {
    const parent = path[i] as SplitNode;
    const other = parent.children[0].id === path[i + 1].id ? parent.children[1] : parent.children[0];
    node = { ...parent, children: parent.children[0].id === path[i + 1].id ? [node, other] : [other, node] };
  }
  return node;
}

export function removeTile(root: WorkspaceNode, tileId: string): WorkspaceNode {
  if (root.kind === 'tile') return root;
  const path = findPath(root, tileId);
  if (path.length < 2) return root;
  const parent = path[path.length - 2] as SplitNode;
  const sibling = parent.children[0].id === tileId ? parent.children[1] : parent.children[0];
  return path.length === 2 ? sibling : replaceNode(path[0], parent.id, sibling);
}

const minSizeMemo = new WeakMap<WorkspaceNode, Map<string, number>>();

export function subtreeMinSize(
  node: WorkspaceNode,
  dimension: 'width' | 'height',
  minTileWidth: number,
  minTileHeight: number,
): number {
  const key = `${dimension}|${minTileWidth}|${minTileHeight}`;
  let perNode = minSizeMemo.get(node);
  if (perNode === undefined) {
    perNode = new Map();
    minSizeMemo.set(node, perNode);
  }
  const hit = perNode.get(key);
  if (hit !== undefined) return hit;
  let value: number;
  if (node.kind === 'tile') {
    value = dimension === 'width' ? minTileWidth : minTileHeight;
  } else {
    const a = subtreeMinSize(node.children[0], dimension, minTileWidth, minTileHeight);
    const b = subtreeMinSize(node.children[1], dimension, minTileWidth, minTileHeight);
    const sameDir = node.dir === (dimension === 'width' ? 'row' : 'column');
    value = sameDir ? a + b : Math.max(a, b);
  }
  perNode.set(key, value);
  return value;
}

function nextActive(remaining: string[], idx: number, current: string): string {
  if (remaining.includes(current)) return current;
  return remaining[Math.min(idx, remaining.length - 1)] ?? '';
}

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

  if (remaining.length === 0) {
    newRoot = removeTile(newRoot, target.id);
  }
  return newRoot;
}

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
