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

/** Side-panel visibility at capture time (user intent, not auto-hide). */
export interface SnapshotPanels {
  /** left group (docker bar + its panel) */
  left: boolean;
  /** the active docker app's panel */
  docker: boolean;
  /** right panel */
  right: boolean;
}

export interface WorkspaceSnapshot {
  version: 1;
  /** root arrangement direction (null = single root) */
  rootDir: SplitDir | null;
  roots: RootSnapshot[];
  /** side-panel visibility — applied on restore (absent = don't touch). */
  panels?: SnapshotPanels;
  /**
   * Per-window state, keyed by tab id — the host app's opaque payload
   * (e.g. a chat composer height). Captured with the layout, applied on
   * restore (absent = don't touch).
   */
  windows?: Record<string, unknown>;
}

/**
 * Serialize a live tree node into its snapshot form (ids stripped).
 * `skipTab` excludes tabs from the snapshot (host-app transient windows);
 * a tile left with no tabs collapses away — its split merges, and an
 * empty root group is dropped (remaining root ratios renormalized).
 * Returns null when nothing of this subtree should persist.
 */
export function nodeToSnapshot(node: WorkspaceNode, skipTab?: (tabId: string) => boolean): NodeSnapshot | null {
  if (node.kind === 'tile') {
    const tabs = skipTab ? node.tabs.filter((t) => !skipTab(t)) : [...node.tabs];
    if (tabs.length === 0) return null;
    const activeId = tabs.includes(node.activeId) ? node.activeId : tabs[0];
    return { kind: 'tile', tabs, activeId };
  }
  const a = nodeToSnapshot(node.children[0], skipTab);
  const b = nodeToSnapshot(node.children[1], skipTab);
  if (!a) return b; // the split collapses to its surviving child
  if (!b) return a;
  return { kind: 'split', dir: node.dir, ratio: node.ratio, children: [a, b] };
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

/**
 * Capture the current layout (structure + spacing) as a plain object.
 * `skipTab` (host-app transient windows) removes tabs from the snapshot;
 * tiles/splits/roots left empty collapse away and the surviving root
 * ratios are renormalized so the restored layout fills the workspace.
 */
export function captureSnapshot(
  roots: Array<{ node: WorkspaceNode; ratio: number }>,
  rootDir: SplitDir | null,
  skipTab?: (tabId: string) => boolean,
  panels?: SnapshotPanels,
  windows?: Record<string, unknown>,
): WorkspaceSnapshot {
  const kept: RootSnapshot[] = [];
  for (const r of roots) {
    const node = nodeToSnapshot(r.node, skipTab);
    if (node) kept.push({ ratio: r.ratio, node });
  }
  if (kept.length === 0 && roots.length > 0) {
    // Everything collapsed (all tabs transient/closed): persist a single
    // empty root so the layout survives as an empty workspace.
    kept.push({ ratio: 1, node: { kind: 'tile', tabs: [], activeId: '' } });
  } else if (kept.length > 0 && kept.length !== roots.length) {
    // Dropped roots: renormalize the survivors so they fill the workspace.
    const total = kept.reduce((s, r) => s + r.ratio, 0);
    if (total > 0) for (const r of kept) r.ratio /= total;
    else for (const r of kept) r.ratio = 1 / kept.length;
  }
  const snap: WorkspaceSnapshot = { version: 1, rootDir, roots: kept };
  if (panels) snap.panels = { ...panels };
  if (windows) snap.windows = { ...windows };
  return snap;
}

/** Rebuild roots (fresh ids) from a snapshot, preserving structure + spacing. */
export function restoreSnapshot(snap: WorkspaceSnapshot): Array<{ id: string; node: WorkspaceNode; ratio: number }> {
  if (snap.version !== 1) throw new Error(`unsupported workspace snapshot version ${snap.version}`);
  return snap.roots.map((r) => ({ id: nextId('root'), node: nodeFromSnapshot(r.node), ratio: r.ratio }));
}
