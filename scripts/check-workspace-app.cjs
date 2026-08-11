/**
 * Headless UI check for the Workspace app (docker item "workspace").
 *
 * Usage: SF_TEST_PORT=7494 npm run check:ws   (demo dev server on a test port)
 *
 * Covers: save current layout, load restores structure AND spacing (sash
 * ratios), ghost windows (missing tab ids → built-in blank page + note),
 * rename, delete, search, reorder, and reload survival (localStorage auto
 * snapshot + saved-workspace list).
 */
const { chromium } = require('playwright');
const { ensureServer, makeReporter, finish } = require('./lib/ui-test.cjs');

const WS = '.sf-workspace';
const PANEL = '.sf-ws-panel';

(async () => {
  const serverProc = await ensureServer();
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  // Clear localStorage on the FIRST navigation only (a reload must keep it).
  await context.addInitScript(() => {
    if (!sessionStorage.getItem('ws-check-cleared')) {
      sessionStorage.setItem('ws-check-cleared', '1');
      localStorage.clear();
    }
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto('http://localhost:' + (process.env.SF_TEST_PORT || '7492') + '/', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForFunction(() => (document.getElementById('framework')?.innerHTML.length ?? 0) > 1000, { timeout: 10000 });
  const { report, isFailed } = makeReporter();

  const tab = (label) => page.locator(`.sf-tab:has-text("${label}")`);
  const tileCount = () => page.locator('.sf-tile').count();
  const tileTabs = (i) => page.locator('.sf-tile').nth(i).locator('.sf-tab-label').allTextContents();
  const tileBox = (i) => page.locator('.sf-tile').nth(i).boundingBox();
  const wsBox = () => page.locator(WS).boundingBox();
  const wsItem = (name) => page.locator('.sf-ws-item', { hasText: name });
  const panelVisible = () => page.locator(PANEL).isVisible();

  // ── App present + panel opens ───────────────────────────────────────────
  const wsApp = page.locator('.sf-docker-app[title="Workspace"]');
  report('Workspace app in the docker bar', (await wsApp.count()) === 1);
  await wsApp.click();
  await page.waitForTimeout(300);
  report('Workspace panel opens', await panelVisible());
  report('save input + empty hint visible', await page.locator('.sf-ws-save .sf-ws-input').isVisible()
    && (await page.locator('.sf-ws-empty').count()) === 1);
  report('initial layout: single tile with 4 demo tabs', (await tileCount()) === 1 && (await tileTabs(0)).length === 4);

  // ── Save a named workspace from a modified layout ───────────────────────
  // Split right: framework.ts to the right edge → 2 tiles.
  const wb = await wsBox();
  await tab('framework.ts').dragTo(page.locator(WS), { targetPosition: { x: wb.width - 10, y: wb.height / 2 } });
  await page.waitForTimeout(400);
  report('split right → 2 tiles', (await tileCount()) === 2);

  // Resize the sash +70px so the left tile is visibly wider (spacing test).
  const sash = page.locator('.sf-sash--row');
  const sashBox = await sash.boundingBox();
  await page.mouse.move(sashBox.x + sashBox.width / 2, sashBox.y + sashBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(sashBox.x + sashBox.width / 2 + 70, sashBox.y + sashBox.height / 2, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  const wL = (await tileBox(0)).width;
  const wR = (await tileBox(1)).width;
  report('sash resize makes left tile wider', wL > wR + 40, `${wL.toFixed(0)} vs ${wR.toFixed(0)}`);

  await page.fill('.sf-ws-save .sf-ws-input', 'My Layout');
  await page.click('.sf-ws-save .sf-ws-btn--primary');
  await page.waitForTimeout(300);
  report('saved workspace appears in the list', (await wsItem('My Layout').count()) === 1);
  report('save input cleared', (await page.inputValue('.sf-ws-save .sf-ws-input')) === '');

  // ── Modify the layout away from the saved one ───────────────────────────
  await tab('framework.ts').hover();
  await tab('framework.ts').locator('.sf-tab-close').click();
  await page.waitForTimeout(350);
  report('layout changed: merged back to one tile', (await tileCount()) === 1 && (await tileTabs(0)).length === 3);

  // ── Load → structure AND spacing restored ───────────────────────────────
  await wsItem('My Layout').locator('.sf-ws-btn[title="Load this workspace"]').click();
  await page.waitForTimeout(400);
  report('load restores 2 tiles', (await tileCount()) === 2);
  report('load restores tab placement', JSON.stringify(await tileTabs(1)) === JSON.stringify(['framework.ts']));
  const rL = (await tileBox(0)).width;
  const rR = (await tileBox(1)).width;
  report('load restores sash spacing', Math.abs(rL - rR - (wL - wR)) < 24, `Δ ${(rL - rR).toFixed(0)} vs saved Δ ${(wL - wR).toFixed(0)}`);
  report('no ghost note for a complete load', (await page.locator('.sf-ws-ghosts').count()) === 0);

  // ── Ghost window: a saved layout referencing a deleted window ───────────
  // Inject a saved workspace whose snapshot contains a tab id with no
  // definition (the deleted-session case) and load it through the panel.
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('sf.workspaces') || '[]');
    saved.push({
      id: 'ghost-ws', name: 'With Ghost', savedAt: Date.now(),
      snapshot: {
        version: 1, rootDir: null,
        roots: [{ ratio: 1, node: { kind: 'tile', tabs: ['framework-ts', 'ghost-session-42'], activeId: 'ghost-session-42' } }],
      },
    });
    localStorage.setItem('sf.workspaces', JSON.stringify(saved));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.locator('.sf-docker-app[title="Workspace"]').click();
  await page.waitForTimeout(300);
  await wsItem('With Ghost').locator('.sf-ws-btn[title="Load this workspace"]').click();
  await page.waitForTimeout(400);
  report('ghost load keeps the tile structure', (await tileCount()) === 1 && (await tileTabs(0)).length === 2);
  report('missing window renders the blank page', (await page.locator('.sf-blank-tab:has-text("Window unavailable")').count()) === 1);
  const ghostTab = page.locator('.sf-tab--ghost');
  report('ghost tab is dimmed/italic', (await ghostTab.count()) === 1 && (await ghostTab.locator('.sf-tab-label').textContent()) === 'ghost-session-42');
  report('panel notes the unavailable window', (await page.locator('.sf-ws-ghosts').textContent()).includes('1 unavailable window'));
  report('existing window keeps its content', (await tileTabs(0))[0] === 'framework.ts');

  // ── Ghost pruning: loading a workspace without the missing window must ──
  //    drop the stale ghost def (tabDefs never grows without bound), and
  //    loading it back recreates the blank window. ──
  const ghostDefGone = () => page.evaluate(() => {
    const el = document.querySelector('.sf-workspace');
    let inst = el.__vueParentComponent;
    while (inst && !inst.setupState?.api) inst = inst.parent;
    return !('ghost-session-42' in (inst?.setupState?.api?.tabDefs ?? {}));
  });
  await wsItem('My Layout').locator('.sf-ws-btn[title="Load this workspace"]').click();
  await page.waitForTimeout(400);
  report('loading without the ghost drops its def', (await ghostDefGone()) && (await page.locator('.sf-tab--ghost').count()) === 0);
  await wsItem('With Ghost').locator('.sf-ws-btn[title="Load this workspace"]').click();
  await page.waitForTimeout(400);
  report('loading the ghost workspace recreates the blank window',
    (await page.locator('.sf-blank-tab').count()) === 1 && (await page.locator('.sf-tab--ghost').count()) === 1);

  // ── Manage: rename, search, reorder, delete ─────────────────────────────
  await wsItem('My Layout').locator('.sf-ws-btn[title="Rename"]').click();
  await page.fill('.sf-ws-rename', 'Renamed Layout');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  report('rename applies', (await wsItem('Renamed Layout').count()) === 1 && (await wsItem('My Layout').count()) === 0);

  await page.fill('.sf-ws-search', 'Ghost');
  await page.waitForTimeout(250);
  report('search filters the list', (await page.locator('.sf-ws-item').count()) === 1
    && (await page.locator('.sf-ws-item .sf-ws-name').first().textContent()) === 'With Ghost');
  await page.fill('.sf-ws-search', '');

  // Reorder: move the last item (With Ghost) up.
  const namesBefore = () => page.locator('.sf-ws-item .sf-ws-name').allTextContents();
  const before = await namesBefore();
  await wsItem('With Ghost').locator('.sf-ws-btn[title="Move up"]').click();
  await page.waitForTimeout(250);
  const after = await namesBefore();
  report('reorder moves the item up', after[0] === 'With Ghost' && before[0] === 'Renamed Layout', JSON.stringify(after));

  await wsItem('With Ghost').locator('.sf-ws-btn[title="Delete"]').click();
  await page.waitForTimeout(250);
  report('delete removes the item', (await page.locator('.sf-ws-item').count()) === 1);

  // ── Reload survival ─────────────────────────────────────────────────────
  // Load the 2-tile workspace first (the current layout was left as the
  // ghost one), then reload: the layout (structure + spacing) auto-restores
  // from localStorage and the saved-workspaces list survives too.
  await wsItem('Renamed Layout').locator('.sf-ws-btn[title="Load this workspace"]').click();
  await page.waitForTimeout(400);
  report('2-tile layout loaded for the reload test', (await tileCount()) === 2);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  report('reload restores the last layout (structure)', (await tileCount()) === 2
    && JSON.stringify(await tileTabs(1)) === JSON.stringify(['framework.ts']));
  const sL = (await tileBox(0)).width;
  const sR = (await tileBox(1)).width;
  report('reload restores the last layout (spacing)', Math.abs(sL - sR - (wL - wR)) < 24, `Δ ${(sL - sR).toFixed(0)} vs ${(wL - wR).toFixed(0)}`);
  await page.locator('.sf-docker-app[title="Workspace"]').click();
  await page.waitForTimeout(300);
  report('saved workspaces survive reload', (await page.locator('.sf-ws-item').count()) === 1
    && (await page.locator('.sf-ws-item .sf-ws-name').first().textContent()) === 'Renamed Layout');

  report('no page errors during the whole check', errors.length === 0, errors.join('; ').slice(0, 300));

  await finish(browser, serverProc, isFailed(), 'WORKSPACE-APP CHECKS');
})().catch((e) => { console.error(e); process.exit(1); });
