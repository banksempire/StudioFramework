/**
 * Unit tests for workspace snapshots (src/workspace/snapshots.ts).
 * Usage: npm run check:snap   (runs under Node's native TypeScript support)
 *
 * Covers: capture/restore round-trip (structure, spacing, tab order),
 * fresh-id regeneration, root-dir preservation, multi-root layouts.
 */
import {
  captureSnapshot,
  restoreSnapshot,
  nodeToSnapshot,
  nodeFromSnapshot,
  type WorkspaceSnapshot,
} from '../src/workspace/snapshots.ts';
import {
  nextId,
  type SplitDir,
  type TileNode,
  type SplitNode,
  type WorkspaceNode,
} from '../src/workspace/tree.ts';

// ── Tiny assertion harness (same style as check-tree.ts) ──────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function report(name: string, ok: boolean, extra = '') {
  if (ok) {
    passed += 1;
  } else {
    failed += 1;
    failures.push(`✗ ${name}${extra ? ` — ${extra}` : ''}`);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function tile(tabs: string[], active = tabs[0] ?? ''): TileNode {
  return { kind: 'tile', id: nextId('tile'), tabs, activeId: active };
}

function split(dir: SplitDir, ratio: number, a: WorkspaceNode, b: WorkspaceNode): SplitNode {
  return { kind: 'split', id: nextId('split'), dir, ratio, children: [a, b] };
}

/** Count tiles in a snapshot tree. */
function countTiles(node: WorkspaceNode): number {
  if (node.kind === 'tile') return 1;
  return countTiles(node.children[0]) + countTiles(node.children[1]);
}

/** Collect all tabs (visual order) from a live tree. */
function allTabs(node: WorkspaceNode): string[] {
  if (node.kind === 'tile') return [...node.tabs];
  return [...allTabs(node.children[0]), ...allTabs(node.children[1])];
}

// ── Round-trip: structure + spacing ────────────────────────────────────────

{
  // A deep mixed tree: row split with a nested column split, odd ratios.
  const tree = split('row', 0.28, tile(['a', 'b'], 'b'), split('column', 0.62, tile(['c'], 'c'), tile(['d', 'e'], 'e')));
  const roots = [{ id: nextId('root'), node: tree, ratio: 1 }];
  const snap = captureSnapshot(roots, null);

  report('snapshot version is 1', snap.version === 1, String(snap.version));
  report('snapshot strips node ids', JSON.stringify(snap).includes('"id"') === false);

  const restored = restoreSnapshot(snap);
  report('restore returns one root', restored.length === 1, String(restored.length));
  const root = restored[0];
  report('restored root ratio preserved', root.ratio === 1, String(root.ratio));

  report('structure preserved: 3 tiles', countTiles(root.node) === 3, String(countTiles(root.node)));
  report('tab order preserved', JSON.stringify(allTabs(root.node)) === JSON.stringify(['a', 'b', 'c', 'd', 'e']));

  // Spacing: split ratios must survive the round-trip exactly.
  const walkRatios = (n: WorkspaceNode, acc: number[]) => {
    if (n.kind === 'split') {
      acc.push(n.ratio);
      walkRatios(n.children[0], acc);
      walkRatios(n.children[1], acc);
    }
  };
  const before: number[] = [];
  const after: number[] = [];
  walkRatios(tree, before);
  walkRatios(root.node, after);
  report('split ratios preserved', JSON.stringify(before) === JSON.stringify(after), `${JSON.stringify(before)} vs ${JSON.stringify(after)}`);

  const t = root.node.kind === 'split' ? root.node : null;
  report('split direction preserved', t?.dir === 'row', t?.dir);
  report('active tab preserved', allTabs(root.node).length === 5);
}

// ── Fresh ids: no collision with the live tree ─────────────────────────────

{
  const live = tile(['x']);
  const snap = captureSnapshot([{ node: live, ratio: 1 }], null);
  const restored = restoreSnapshot(snap);
  report('restore regenerates tile ids', restored[0].node.kind === 'tile' && restored[0].node.id !== live.id);
  report('restore regenerates root ids', restored[0].id !== live.id);
}

// ── Multi-root layouts ─────────────────────────────────────────────────────

{
  const r1 = { id: nextId('root'), node: tile(['a']), ratio: 0.7 };
  const r2 = { id: nextId('root'), node: split('row', 0.4, tile(['b']), tile(['c'])), ratio: 0.3 };
  const snap = captureSnapshot([r1, r2], 'row');
  report('rootDir captured', snap.rootDir === 'row', String(snap.rootDir));

  const restored = restoreSnapshot(snap);
  report('two roots restored', restored.length === 2, String(restored.length));
  report('root ratios preserved (0.7/0.3)', restored[0].ratio === 0.7 && restored[1].ratio === 0.3,
    `${restored[0].ratio}/${restored[1].ratio}`);
  report('second root structure preserved', restored[1].node.kind === 'split' && restored[1].node.ratio === 0.4);

  // Round-trip again — snapshots are stable (idempotent).
  const again = captureSnapshot(restored, snap.rootDir);
  report('re-capture is stable', JSON.stringify(again) === JSON.stringify(snap), JSON.stringify(again));
}

// ── Empty tile / empty workspace edge cases ────────────────────────────────

{
  const snap: WorkspaceSnapshot = {
    version: 1,
    rootDir: null,
    roots: [{ ratio: 1, node: { kind: 'tile', tabs: [], activeId: '' } }],
  };
  const restored = restoreSnapshot(snap);
  report('empty root tile restores', restored.length === 1 && restored[0].node.kind === 'tile'
    && restored[0].node.tabs.length === 0 && restored[0].node.activeId === '');
}

{
  const snap: WorkspaceSnapshot = { version: 1, rootDir: null, roots: [] };
  const restored = restoreSnapshot(snap);
  report('empty workspace restores (no roots)', Array.isArray(restored) && restored.length === 0);
}

// ── Bad input ──────────────────────────────────────────────────────────────

{
  let threw = false;
  try {
    restoreSnapshot({ version: 99, rootDir: null, roots: [] } as unknown as WorkspaceSnapshot);
  } catch {
    threw = true;
  }
  report('unsupported version throws', threw);
}

// ── Transient tabs: excluded from snapshots, tiles collapse ───────────────

{
  // A transient tab is skipped; the tile keeps the rest and the active id
  // moves to the first remaining tab when the active one was transient.
  const tree = tile(['a', 'b'], 'a');
  const snap = captureSnapshot([{ node: tree, ratio: 1 }], null, (id) => id === 'a');
  const node = snap.roots[0].node;
  report('transient tab excluded from the snapshot', node.kind === 'tile'
    && JSON.stringify(node.tabs) === JSON.stringify(['b']), JSON.stringify(node));
  report('active id moves to the first remaining tab', node.kind === 'tile' && node.activeId === 'b');
}

{
  // A tile left with no tabs collapses away — the surrounding split merges
  // to the surviving child (with its internal ratios intact).
  const left = split('row', 0.4, tile(['x']), tile(['y']));
  const tree = split('column', 0.25, tile(['gone']), left);
  const snap = captureSnapshot([{ node: tree, ratio: 1 }], null, (id) => id === 'gone');
  const node = snap.roots[0].node;
  report('empty tile collapses the split to the survivor', node.kind === 'split' && node.dir === 'row' && node.ratio === 0.4);
}

{
  // A root left empty is dropped and the surviving roots' ratios are
  // renormalized so the restored layout fills the workspace.
  const r1 = { node: tile(['gone']), ratio: 0.6 };
  const r2 = { node: tile(['keep']), ratio: 0.4 };
  const snap = captureSnapshot([r1, r2], 'row', (id) => id === 'gone');
  report('empty root dropped', snap.roots.length === 1 && snap.roots[0].node.kind === 'tile'
    && JSON.stringify(snap.roots[0].node.tabs) === JSON.stringify(['keep']));
  report('surviving root renormalized to fill the workspace', snap.roots[0].ratio === 1, String(snap.roots[0].ratio));
}

{
  // Everything transient → a single empty root persists (the layout
  // survives as an empty workspace instead of vanishing).
  const snap = captureSnapshot([{ node: tile(['a', 'b']), ratio: 1 }], null, () => true);
  report('all-transient collapses to one empty root', snap.roots.length === 1
    && snap.roots[0].node.kind === 'tile' && snap.roots[0].node.tabs.length === 0 && snap.roots[0].ratio === 1);
}

{
  // No transients → behavior unchanged (structure + spacing preserved).
  const tree = split('row', 0.28, tile(['a', 'b'], 'b'), split('column', 0.62, tile(['c'], 'c'), tile(['d', 'e'], 'e')));
  const snap = captureSnapshot([{ node: tree, ratio: 1 }], null, () => false);
  const root = snap.roots[0];
  report('no-transient capture keeps ratios', root.node.kind === 'split' && root.node.ratio === 0.28);
}

{
  // Side-panel visibility is captured with the layout and round-trips.
  const tree = tile(['a']);
  const panels = { left: false, docker: false, right: true };
  const snap = captureSnapshot([{ node: tree, ratio: 1 }], null, undefined, panels);
  report('capture stores panel visibility', JSON.stringify(snap.panels) === JSON.stringify(panels));
  const snap2 = captureSnapshot([{ node: tree, ratio: 1 }], null);
  report('no panels arg → no panels field', snap2.panels === undefined);
}

// ── nodeToSnapshot / nodeFromSnapshot symmetry ─────────────────────────────

{
  const tree = split('column', 0.33, tile(['p', 'q'], 'q'), tile(['r']));
  const snap = nodeToSnapshot(tree);
  const back = nodeFromSnapshot(snap);
  report('node round-trip preserves tabs', JSON.stringify(allTabs(back)) === JSON.stringify(['p', 'q', 'r']));
  report('node round-trip preserves ratio', back.kind === 'split' && back.ratio === 0.33);
  report('node round-trip preserves dir', back.kind === 'split' && back.dir === 'column');
}

// ── Report ─────────────────────────────────────────────────────────────────

console.log(`\nSNAPSHOT CHECKS: ${passed} passed, ${failed} failed\n`);
for (const f of failures) console.log(f);
if (failed > 0) process.exit(1);
