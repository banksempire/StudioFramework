/**
 * Workspace snapshots — plain-JSON capture/restore of the split-tree layout.
 *
 * A snapshot stores the tile structure AND all spacing (split ratios + root
 * ratios) with NO node ids: ids are runtime identities (they carry timestamps
 * and randomness), so they are regenerated on restore. This lets a snapshot
 * be applied onto a live workspace without colliding with the current tree.
 *
 * Tabs keep their ids — a tab id identifies the CONTENT (a chat session, a
 * file…), not the slot. A restored tab whose id has no definition (e.g. the
 * session was deleted) becomes a ghost window rendered as a blank page.
 *
 * Pure functions (no Vue reactivity) — unit tested under Node.
 */
import { nextId, type SplitDir, type WorkspaceNode } from './tree.ts';

export interface TileSnapshot {
  kind: 'tile';
  /** ordered tab ids */
  tabs: string[];
  activeId: string;
}

export interface SplitSnapshot {
  kind: 'split';
  dir: SplitDir;
  /** fraction (0..1) given to children[0] — spacing */
  ratio: number;
  children: [NodeSnapshot, NodeSnapshot];
}

export type NodeSnapshot = TileSnapshot | SplitSnapshot;

export interface RootSnapshot {
  /** width fraction (0..1) of this root group — spacing */
  ratio: number;
  node: NodeSnapshot;
}

export interface WorkspaceSnapshot {
  version: 1;
  /** root arrangement direction (null = single root) */
  rootDir: SplitDir | null;
  roots: RootSnapshot[];
}

/** Serialize a live tree node into its snapshot form (ids stripped). */
export function nodeToSnapshot(node: WorkspaceNode): NodeSnapshot {
  if (node.kind === 'tile') {
    return { kind: 'tile', tabs: [...node.tabs], activeId: node.activeId };
  }
  return {
    kind: 'split',
    dir: node.dir,
    ratio: node.ratio,
    children: [nodeToSnapshot(node.children[0]), nodeToSnapshot(node.children[1])],
  };
}

/** Rebuild a live tree node from a snapshot, with fresh ids. */
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

/** Capture the current layout (structure + spacing) as a plain object. */
export function captureSnapshot(
  roots: Array<{ node: WorkspaceNode; ratio: number }>,
  rootDir: SplitDir | null,
): WorkspaceSnapshot {
  return { version: 1, rootDir, roots: roots.map((r) => ({ ratio: r.ratio, node: nodeToSnapshot(r.node) })) };
}

/** Rebuild roots (fresh ids) from a snapshot, preserving structure + spacing. */
export function restoreSnapshot(snap: WorkspaceSnapshot): Array<{ id: string; node: WorkspaceNode; ratio: number }> {
  if (snap.version !== 1) throw new Error(`unsupported workspace snapshot version ${snap.version}`);
  return snap.roots.map((r) => ({ id: nextId('root'), node: nodeFromSnapshot(r.node), ratio: r.ratio }));
}
