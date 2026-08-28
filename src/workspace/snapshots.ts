import type { WorkspaceTabDef } from '../types/layout.ts';
import { nextId, type SplitDir, type WorkspaceNode } from './tree.ts';

export interface TileSnapshot {
  kind: 'tile';
  tabs: string[];
  activeId: string;
}

export interface SplitSnapshot {
  kind: 'split';
  dir: SplitDir;
  ratio: number;
  children: [NodeSnapshot, NodeSnapshot];
}

export type NodeSnapshot = TileSnapshot | SplitSnapshot;

export interface RootSnapshot {
  ratio: number;
  node: NodeSnapshot;
}

export interface SnapshotPanels {
  left: boolean;
  docker: boolean;
  right: boolean;
}

export interface WorkspaceSnapshot {
  version: 1;
  rootDir: SplitDir | null;
  roots: RootSnapshot[];
  panels?: SnapshotPanels;
  windows?: Record<string, unknown>;
  ui?: Record<string, unknown>;
  defs?: Record<string, WorkspaceTabDef>;
}

export function nodeToSnapshot(
  node: WorkspaceNode,
  skipTab?: (tabId: string) => boolean,
): NodeSnapshot | null {
  if (node.kind === 'tile') {
    const tabs = skipTab ? node.tabs.filter((t) => !skipTab(t)) : [...node.tabs];
    if (tabs.length === 0) return null;
    const activeId = tabs.includes(node.activeId) ? node.activeId : tabs[0];
    return { kind: 'tile', tabs, activeId };
  }
  const a = nodeToSnapshot(node.children[0], skipTab);
  const b = nodeToSnapshot(node.children[1], skipTab);
  if (!a) return b;
  if (!b) return a;
  return { kind: 'split', dir: node.dir, ratio: node.ratio, children: [a, b] };
}

export function nodeFromSnapshot(snap: NodeSnapshot): WorkspaceNode {
  if (snap.kind === 'tile') {
    return { kind: 'tile', id: nextId('tile'), tabs: [...snap.tabs], activeId: snap.activeId };
  }
  return {
    kind: 'split',
    id: nextId('split'),
    dir: snap.dir,
    ratio: snap.ratio,
    children: [nodeFromSnapshot(snap.children[0]), nodeFromSnapshot(snap.children[1])],
  };
}

export function captureSnapshot(
  roots: Array<{ node: WorkspaceNode; ratio: number }>,
  rootDir: SplitDir | null,
  skipTab?: (tabId: string) => boolean,
  panels?: SnapshotPanels,
  windows?: Record<string, unknown>,
  ui?: Record<string, unknown>,
  pickTabDef?: (tabId: string) => WorkspaceTabDef | undefined,
): WorkspaceSnapshot {
  const kept: RootSnapshot[] = [];
  for (const r of roots) {
    const node = nodeToSnapshot(r.node, skipTab);
    if (node) kept.push({ ratio: r.ratio, node });
  }
  if (kept.length === 0 && roots.length > 0) {
    kept.push({ ratio: 1, node: { kind: 'tile', tabs: [], activeId: '' } });
  } else if (kept.length > 0 && kept.length !== roots.length) {
    const total = kept.reduce((s, r) => s + r.ratio, 0);
    if (total > 0) for (const r of kept) r.ratio /= total;
    else for (const r of kept) r.ratio = 1 / kept.length;
  }
  const snap: WorkspaceSnapshot = { version: 1, rootDir, roots: kept };
  if (panels) snap.panels = { ...panels };
  if (windows) snap.windows = { ...windows };
  if (ui) snap.ui = { ...ui };
  if (pickTabDef) {
    const defs: Record<string, WorkspaceTabDef> = {};
    const live = new Set<string>();
    for (const r of kept) collectTabIds(r.node, live);
    for (const id of live) {
      const d = pickTabDef(id);
      if (d) defs[id] = d;
    }
    if (Object.keys(defs).length > 0) snap.defs = defs;
  }
  return snap;
}

function collectTabIds(node: NodeSnapshot, out: Set<string>): void {
  if (node.kind === 'tile') {
    for (const t of node.tabs) out.add(t);
    return;
  }
  collectTabIds(node.children[0], out);
  collectTabIds(node.children[1], out);
}

export function restoreSnapshot(
  snap: WorkspaceSnapshot,
): Array<{ id: string; node: WorkspaceNode; ratio: number }> {
  if (snap.version !== 1) throw new Error(`unsupported workspace snapshot version ${snap.version}`);
  return snap.roots.map((r) => ({ id: nextId('root'), node: nodeFromSnapshot(r.node), ratio: r.ratio }));
}
