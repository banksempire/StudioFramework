import {
  collectAllTabs,
  findNode,
  findTile,
  findTileByTab,
  nextId,
  type SplitNode,
  subtreeMinSize,
  type TileNode,
  treeCloseTab,
  treeInsertTab,
  treeMoveTab,
  treeNewTab,
  treeSetRatio,
  treeSplitTile,
  type WorkspaceNode,
} from '../src/workspace/tree.ts';

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

function tile(tabs: string[], active = tabs[0] ?? ''): TileNode {
  return { kind: 'tile', id: nextId('tile'), tabs, activeId: active };
}

function row(a: WorkspaceNode, b: WorkspaceNode): SplitNode {
  return { kind: 'split', id: nextId('split'), dir: 'row', ratio: 0.5, children: [a, b] };
}

function col(a: WorkspaceNode, b: WorkspaceNode): SplitNode {
  return { kind: 'split', id: nextId('split'), dir: 'column', ratio: 0.5, children: [a, b] };
}

const tabsOf = (n: WorkspaceNode, id: string): string[] => {
  const t = findTile(n, id);
  return t ? t.tabs : [];
};

{
  const root = tile(['a', 'b', 'c'], 'a');
  const r = treeSplitTile(root, root.id, 'row', 'end', 'a');
  report('same-tile split: root becomes a split', r.kind === 'split', r.kind);
  if (r.kind === 'split') {
    report('same-tile split: ratio is 0.5', r.ratio === 0.5, String(r.ratio));
    report(
      'same-tile split: dragged tab on the end side',
      JSON.stringify(tabsOf(r, r.children[1].id)) === JSON.stringify(['a']),
    );
    report(
      'same-tile split: target keeps the rest',
      JSON.stringify(tabsOf(r, r.children[0].id)) === JSON.stringify(['b', 'c']),
    );
    const target = findTile(r, r.children[0].id);
    report('same-tile split: target active follows removed tab', target?.activeId === 'b', target?.activeId);
  }
}

{
  const root = tile(['a', 'b', 'c'], 'a');
  const r = treeSplitTile(root, root.id, 'column', 'start', 'a');
  report(
    'same-tile split start: dragged tab first',
    r.kind === 'split' && JSON.stringify(tabsOf(r, r.children[0].id)) === JSON.stringify(['a']),
  );
}

{
  const a = tile(['a', 'b']);
  const b = tile(['c', 'd'], 'c');
  const root = row(a, b);
  const r = treeSplitTile(root, b.id, 'row', 'end', 'a');
  report(
    'cross-tile split: source keeps remaining',
    JSON.stringify(tabsOf(r, a.id)) === JSON.stringify(['b']),
  );
  const newTile = findTileByTab(r, 'a');
  report(
    'cross-tile split: dragged tab lands in a new tile',
    newTile !== null && newTile.tabs.length === 1 && newTile.activeId === 'a',
  );
  report(
    'cross-tile split: target tile keeps its tabs',
    JSON.stringify(tabsOf(r, b.id)) === JSON.stringify(['c', 'd']),
  );
}

{
  const a = tile(['a']);
  const b = tile(['c', 'd'], 'c');
  const root = row(a, b);
  const r = treeSplitTile(root, b.id, 'row', 'start', 'a');
  report(
    'empty-source merge: root becomes the new split directly',
    r.kind === 'split' && r.children.length === 2,
  );
  if (r.kind === 'split') {
    report(
      'empty-source merge: dragged tab first (side start)',
      JSON.stringify(tabsOf(r, r.children[0].id)) === JSON.stringify(['a']),
    );
    report('empty-source merge: source tile is gone', findTile(r, a.id) === null);
  }
}

{
  const root = tile(['a']);
  const r = treeSplitTile(root, root.id, 'row', 'start', 'a');
  report(
    'single-tab target: root becomes the dragged-tab tile',
    r.kind === 'tile' && r.tabs.length === 1 && r.tabs[0] === 'a',
  );
}

{
  const root = tile(['a', 'b', 'c']);
  const r = treeMoveTab(root, 'c', root.id, 0);
  report(
    'reorder: tab moves to the front',
    JSON.stringify(tabsOf(r, root.id)) === JSON.stringify(['c', 'a', 'b']),
  );
  const t = findTile(r, root.id);
  report('reorder: moved tab becomes active', t?.activeId === 'c', t?.activeId);
}

{
  const root = tile(['a', 'b', 'c']);
  const r = treeMoveTab(root, 'a', root.id, 2);
  report(
    'reorder: tab moves to the end',
    JSON.stringify(tabsOf(r, root.id)) === JSON.stringify(['b', 'c', 'a']),
  );
}

{
  const root = tile(['a', 'b', 'c']);
  const r = treeMoveTab(root, 'a', root.id, 99);
  report(
    'reorder: index clamped to append',
    JSON.stringify(tabsOf(r, root.id)) === JSON.stringify(['b', 'c', 'a']),
  );
}

{
  const a = tile(['a', 'b']);
  const b = tile(['c', 'd'], 'c');
  const root = row(a, b);
  const r = treeMoveTab(root, 'a', b.id, 0);
  report(
    'cross-tile move: source keeps remaining',
    JSON.stringify(tabsOf(r, a.id)) === JSON.stringify(['b']),
  );
  report(
    'cross-tile move: target inserts at index',
    JSON.stringify(tabsOf(r, b.id)) === JSON.stringify(['a', 'c', 'd']),
  );
}

{
  const a = tile(['a']);
  const b = tile(['c', 'd'], 'c');
  const root = row(a, b);
  const r = treeMoveTab(root, 'a', b.id, 1);
  report('empty-source move: source tile merges away', r.kind === 'tile' && r.tabs.length === 3, r.kind);
  report(
    'empty-source move: tab inserted at index',
    JSON.stringify(tabsOf(r, b.id)) === JSON.stringify(['c', 'a', 'd']),
  );
}

{
  const root = tile(['a', 'b', 'c'], 'b');
  const r = treeCloseTab(root, 'b');
  const t = findTile(r, root.id);
  report('close middle: tab removed', JSON.stringify(tabsOf(r, root.id)) === JSON.stringify(['a', 'c']));
  report('close middle: next tab becomes active', t?.activeId === 'c', t?.activeId);
}

{
  const root = tile(['a', 'b', 'c'], 'a');
  const r = treeCloseTab(root, 'a');
  const t = findTile(r, root.id);
  report('close first: next tab becomes active', t?.activeId === 'b', t?.activeId);
}

{
  const root = tile(['a', 'b', 'c'], 'a');
  const r = treeCloseTab(root, 'c');
  const t = findTile(r, root.id);
  report('close inactive: active tab kept', t?.activeId === 'a', t?.activeId);
}

{
  const root = tile(['a']);
  const r = treeCloseTab(root, 'a');
  report(
    'close last root tab: root stays empty',
    r.kind === 'tile' && r.tabs.length === 0 && r.activeId === '',
  );
}

{
  const a = tile(['a', 'b']);
  const b = tile(['c'], 'c');
  const root = row(a, b);
  const r = treeCloseTab(root, 'c');
  report(
    'close non-root last tab: split merges',
    r.kind === 'tile' && JSON.stringify(r.tabs) === JSON.stringify(['a', 'b']),
    r.kind,
  );
}

{
  const c = tile(['c'], 'c');
  const inner = col(tile(['a'], 'a'), c);
  const root = row(inner, tile(['z'], 'z'));
  const r = treeCloseTab(root, 'c');
  report(
    'nested close: parent split replaced by sibling',
    findTile(r, c.id) === null && findTile(r, inner.id) === null,
  );
  report(
    'nested close: remaining tabs intact',
    JSON.stringify(collectAllTabs(r)) === JSON.stringify(['a', 'z']),
  );
}

{
  const W = 160,
    H = 100;
  const r = row(tile(['a']), tile(['b']));
  report('row split: width sums children', subtreeMinSize(r, 'width', W, H) === 2 * W);
  report('row split: height takes max', subtreeMinSize(r, 'height', W, H) === H);
  const c = col(tile(['a']), tile(['b']));
  report('column split: height sums children', subtreeMinSize(c, 'height', W, H) === 2 * H);
  report('column split: width takes max', subtreeMinSize(c, 'width', W, H) === W);
  const nested = row(tile(['a']), col(tile(['b']), tile(['c'])));
  report('nested: width composes row-sum of column-max', subtreeMinSize(nested, 'width', W, H) === 2 * W);
  report('nested: height composes row-max of column-sum', subtreeMinSize(nested, 'height', W, H) === 2 * H);
}

{
  const root = row(tile(['a']), tile(['b']));
  const low = treeSetRatio(root, root.id, 0.01);
  report(
    'ratio clamps to 0.05 minimum',
    low.kind === 'split' && low.ratio === 0.05,
    low.kind === 'split' ? String(low.ratio) : low.kind,
  );
  const high = treeSetRatio(root, root.id, 0.99);
  report(
    'ratio clamps to 0.95 maximum',
    high.kind === 'split' && high.ratio === 0.95,
    high.kind === 'split' ? String(high.ratio) : high.kind,
  );
  const mid = treeSetRatio(root, root.id, 0.4);
  report(
    'ratio passes through in range',
    mid.kind === 'split' && mid.ratio === 0.4,
    mid.kind === 'split' ? String(mid.ratio) : mid.kind,
  );
}

{
  const root = tile(['a'], 'a');
  const r = treeNewTab(root, root.id, 'untitled-1');
  const t = findTile(r, root.id);
  report(
    'new tab appends and activates',
    t?.tabs.length === 2 && t?.tabs[1] === 'untitled-1' && t?.activeId === 'untitled-1',
  );
}

{
  const root = tile(['a', 'c']);
  const r = treeInsertTab(root, root.id, 'b', 1);
  report('insert tab at index', JSON.stringify(tabsOf(r, root.id)) === JSON.stringify(['a', 'b', 'c']));
  const t = findTile(r, root.id);
  report('inserted tab becomes active', t?.activeId === 'b', t?.activeId);
}

{
  const cTile = tile(['c']);
  const root = row(tile(['a', 'b']), col(cTile, tile(['d', 'e'])));
  report(
    'findTileByTab finds nested tiles',
    findTileByTab(root, 'd') !== null && findTileByTab(root, 'z') === null,
  );
  report('findNode/findTile agree', findNode(root, cTile.id) !== null && findTile(root, cTile.id) !== null);
  report(
    'collectAllTabs walks in visual order',
    JSON.stringify(collectAllTabs(root)) === JSON.stringify(['a', 'b', 'c', 'd', 'e']),
  );
}

console.log(`\nTREE CHECKS: ${passed} passed, ${failed} failed\n`);
for (const f of failures) console.log(f);
if (failed > 0) process.exit(1);
