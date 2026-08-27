const { chromium } = require('playwright');
const { ensureServer, makeReporter, finish } = require('./lib/ui-test.cjs');

const WS = '.sf-workspace';
const PANEL = '.sf-ws-panel';

(async () => {
  const serverProc = await ensureServer();
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    if (!sessionStorage.getItem('ws-check-cleared')) {
      sessionStorage.setItem('ws-check-cleared', '1');
      localStorage.clear();
    }
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(`http://localhost:${process.env.SF_TEST_PORT || '7493'}/`, {
    waitUntil: 'networkidle',
    timeout: 15000,
  });
  await page.waitForFunction(() => (document.getElementById('framework')?.innerHTML.length ?? 0) > 1000, {
    timeout: 10000,
  });
  const { report, isFailed } = makeReporter();

  const tab = (label) => page.locator(`.sf-tab:has-text("${label}")`);
  const tileCount = () => page.locator('.sf-tile').count();
  const tileTabs = (i) => page.locator('.sf-tile').nth(i).locator('.sf-tab-label').allTextContents();
  const tileBox = (i) => page.locator('.sf-tile').nth(i).boundingBox();
  const wsBox = () => page.locator(WS).boundingBox();
  const wsItem = (name) => page.locator('.sf-ws-item', { hasText: name });
  const panelVisible = () => page.locator(PANEL).isVisible();
  const openWsPanel = async () => {
    for (let i = 0; i < 2 && !(await panelVisible()); i++) {
      await page.locator('.sf-docker-app[title="Workspace"]').click();
      await page.waitForTimeout(300);
    }
  };

  const wsApp = page.locator('.sf-docker-app[title="Workspace"]');
  report('Workspace app in the docker bar', (await wsApp.count()) === 1);
  await wsApp.click();
  await page.waitForTimeout(300);
  report('Workspace panel opens', await panelVisible());
  report(
    'save input + empty hint visible',
    (await page.locator('.sf-ws-save .sf-ws-input').isVisible()) &&
      (await page.locator('.sf-ws-empty').count()) === 1,
  );
  report(
    'initial layout: single tile with 4 demo tabs',
    (await tileCount()) === 1 && (await tileTabs(0)).length === 4,
  );

  await page.evaluate(() => {
    const dt = new DataTransfer();
    document
      .querySelector('.sf-tab')
      .dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
  });
  await page.evaluate(() => {
    const ws = document.querySelector('.sf-workspace');
    const r = document.querySelector('.sf-tile').getBoundingClientRect();
    const strip = document.querySelector('.sf-tile-tabs').getBoundingClientRect();
    const dt = new DataTransfer();
    ws.dispatchEvent(
      new DragEvent('dragover', {
        bubbles: true,
        cancelable: true,
        clientX: r.left + r.width / 2,
        clientY: strip.bottom + (r.bottom - strip.bottom) / 2,
        dataTransfer: dt,
      }),
    );
  });
  await page.waitForSelector('.sf-dnd-glow', { timeout: 3000 });
  const glowRadius = await page.evaluate(
    () => getComputedStyle(document.querySelector('.sf-dnd-glow')).borderRadius,
  );
  const expRadius = await page.evaluate(() => {
    const cs = getComputedStyle(document.querySelector('.sf-workspace'));
    const rad = (side) => parseFloat(cs[`border${side}Radius`]) || 0;
    const bw = Math.max(parseFloat(cs.borderTopWidth) || 0, parseFloat(cs.borderLeftWidth) || 0);
    const inner = (v) => `${Math.max(0, v - bw)}px`;
    return `${inner(rad('TopLeft'))} 0px 0px ${inner(rad('BottomLeft'))}`;
  });
  report(
    'drop glow matches the rounded workspace edge',
    glowRadius === expRadius,
    `${glowRadius} vs clip ${expRadius}`,
  );
  const gb = await page.locator('.sf-dnd-glow').boundingBox();
  const tb = await tileBox(0);
  report(
    'drop glow covers the hovered tile exactly',
    Math.abs(gb.x - tb.x) <= 1 &&
      Math.abs(gb.y - tb.y) <= 1 &&
      Math.abs(gb.width - tb.width) <= 1 &&
      Math.abs(gb.height - tb.height) <= 1,
    `glow ${gb.x.toFixed(1)},${gb.y.toFixed(1)} ${gb.width.toFixed(1)}x${gb.height.toFixed(1)} vs tile ${tb.x.toFixed(1)},${tb.y.toFixed(1)} ${tb.width.toFixed(1)}x${tb.height.toFixed(1)}`,
  );
  await page.evaluate(() => {
    const ws = document.querySelector('.sf-workspace');
    ws.dispatchEvent(new DragEvent('dragleave', { bubbles: true }));
    document.querySelector('.sf-tab').dispatchEvent(new DragEvent('dragend', { bubbles: true }));
  });
  await page.waitForTimeout(150);
  report('synthetic drag cleans up the overlay', (await page.locator('.sf-dnd-layer').count()) === 0);

  const wb = await wsBox();
  await tab('framework.ts').dragTo(page.locator(WS), {
    targetPosition: { x: wb.width - 10, y: wb.height / 2 },
  });
  await page.waitForTimeout(400);
  report('split right → 2 tiles', (await tileCount()) === 2);

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

  await tab('framework.ts').hover();
  await tab('framework.ts').locator('.sf-tab-close').click();
  await page.waitForTimeout(350);
  report(
    'layout changed: merged back to one tile',
    (await tileCount()) === 1 && (await tileTabs(0)).length === 3,
  );

  await wsItem('My Layout').locator('.sf-ws-btn[title="Load this workspace"]').click();
  await page.waitForTimeout(400);
  report('load restores 2 tiles', (await tileCount()) === 2);
  report(
    'load restores tab placement',
    JSON.stringify(await tileTabs(1)) === JSON.stringify(['framework.ts']),
  );
  const rL = (await tileBox(0)).width;
  const rR = (await tileBox(1)).width;
  report(
    'load restores sash spacing',
    Math.abs(rL - rR - (wL - wR)) < 24,
    `Δ ${(rL - rR).toFixed(0)} vs saved Δ ${(wL - wR).toFixed(0)}`,
  );
  report('no ghost note for a complete load', (await page.locator('.sf-ws-ghosts').count()) === 0);

  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('sf.workspaces') || '[]');
    saved.push({
      id: 'ghost-ws',
      name: 'With Ghost',
      savedAt: Date.now(),
      snapshot: {
        version: 1,
        rootDir: null,
        roots: [
          {
            ratio: 1,
            node: { kind: 'tile', tabs: ['framework-ts', 'ghost-session-42'], activeId: 'ghost-session-42' },
          },
        ],
      },
    });
    localStorage.setItem('sf.workspaces', JSON.stringify(saved));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await openWsPanel();
  await wsItem('With Ghost').locator('.sf-ws-btn[title="Load this workspace"]').click();
  await page.waitForTimeout(400);
  report(
    'ghost load keeps the tile structure',
    (await tileCount()) === 1 && (await tileTabs(0)).length === 2,
  );
  report(
    'missing window renders the blank page',
    (await page.locator('.sf-blank-tab:has-text("Window unavailable")').count()) === 1,
  );
  const ghostTab = page.locator('.sf-tab--ghost');
  report(
    'ghost tab is dimmed/italic',
    (await ghostTab.count()) === 1 &&
      (await ghostTab.locator('.sf-tab-label').textContent()) === 'ghost-session-42',
  );
  report(
    'panel notes the unavailable window',
    (await page.locator('.sf-ws-ghosts').textContent()).includes('1 unavailable window'),
  );
  report('existing window keeps its content', (await tileTabs(0))[0] === 'framework.ts');

  const ghostDefGone = () =>
    page.evaluate(() => {
      const el = document.querySelector('.sf-workspace');
      let inst = el.__vueParentComponent;
      while (inst && !inst.setupState?.api) inst = inst.parent;
      return !('ghost-session-42' in (inst?.setupState?.api?.tabDefs ?? {}));
    });
  await wsItem('My Layout').locator('.sf-ws-btn[title="Load this workspace"]').click();
  await page.waitForTimeout(400);
  report(
    'loading without the ghost drops its def',
    (await ghostDefGone()) && (await page.locator('.sf-tab--ghost').count()) === 0,
  );
  await wsItem('With Ghost').locator('.sf-ws-btn[title="Load this workspace"]').click();
  await page.waitForTimeout(400);
  report(
    'loading the ghost workspace recreates the blank window',
    (await page.locator('.sf-blank-tab').count()) === 1 &&
      (await page.locator('.sf-tab--ghost').count()) === 1,
  );

  await wsItem('My Layout').locator('.sf-ws-btn[title="Rename"]').click();
  await page.fill('.sf-ws-rename', 'Renamed Layout');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  report(
    'rename applies',
    (await wsItem('Renamed Layout').count()) === 1 && (await wsItem('My Layout').count()) === 0,
  );

  await page.fill('.sf-ws-search', 'Ghost');
  await page.waitForTimeout(250);
  report(
    'search filters the list',
    (await page.locator('.sf-ws-item').count()) === 1 &&
      (await page.locator('.sf-ws-item .sf-ws-name').first().textContent()) === 'With Ghost',
  );
  await page.fill('.sf-ws-search', '');

  const namesBefore = () => page.locator('.sf-ws-item .sf-ws-name').allTextContents();
  const before = await namesBefore();
  await wsItem('With Ghost').locator('.sf-ws-btn[title="Move up"]').click();
  await page.waitForTimeout(250);
  const after = await namesBefore();
  report(
    'reorder moves the item up',
    after[0] === 'With Ghost' && before[0] === 'Renamed Layout',
    JSON.stringify(after),
  );

  await wsItem('With Ghost').locator('.sf-ws-btn[title="Delete"]').click();
  await page.waitForTimeout(250);
  report('delete removes the item', (await page.locator('.sf-ws-item').count()) === 1);

  await wsItem('Renamed Layout').locator('.sf-ws-btn[title="Load this workspace"]').click();
  await page.waitForTimeout(400);
  report('2-tile layout loaded for the reload test', (await tileCount()) === 2);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  report(
    'reload restores the last layout (structure)',
    (await tileCount()) === 2 && JSON.stringify(await tileTabs(1)) === JSON.stringify(['framework.ts']),
  );
  const sL = (await tileBox(0)).width;
  const sR = (await tileBox(1)).width;
  report(
    'reload restores the last layout (spacing)',
    Math.abs(sL - sR - (wL - wR)) < 24,
    `Δ ${(sL - sR).toFixed(0)} vs ${(wL - wR).toFixed(0)}`,
  );
  await openWsPanel();
  report(
    'saved workspaces survive reload',
    (await page.locator('.sf-ws-item').count()) === 1 &&
      (await page.locator('.sf-ws-item .sf-ws-name').first().textContent()) === 'Renamed Layout',
  );

  const rightPanel = page.locator('.sf-panel--right');
  const rpBtn = (title) => page.locator(`.sf-tab-panel-toggle[title="${title}"]`);
  report('right panel starts visible', await rightPanel.isVisible());

  await rpBtn('Collapse Right Panel').click();
  await page.waitForTimeout(400);
  report('right panel collapses', !(await rightPanel.isVisible()));
  await page.fill('.sf-ws-save .sf-ws-input', 'Panels Off');
  await page.click('.sf-ws-save .sf-ws-btn--primary');
  await page.waitForTimeout(300);
  await rpBtn('Expand Right Panel').click();
  await page.waitForTimeout(400);
  report('right panel expands again', await rightPanel.isVisible());
  await wsItem('Panels Off').locator('.sf-ws-btn[title="Load this workspace"]').click();
  await page.waitForTimeout(500);
  report('loading a workspace restores the collapsed right panel', !(await rightPanel.isVisible()));
  await rpBtn('Expand Right Panel').click();
  await page.waitForTimeout(400);

  await page.click('text=View');
  await page.waitForTimeout(200);
  await page.hover('text=Appearance');
  await page.waitForTimeout(200);
  await page.click('text="Toggle Left Panel"');
  await page.waitForTimeout(400);
  report('left panel collapses via the menu', !(await page.locator('.sf-left-group').isVisible()));
  await page.waitForTimeout(800);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  report(
    'reload restores the collapsed left panel',
    !(await page.locator('.sf-left-group').isVisible()) &&
      (await page.locator('.sf-panel--right').isVisible()),
  );
  await page.click('text=View');
  await page.waitForTimeout(200);
  await page.hover('text=Appearance');
  await page.waitForTimeout(200);
  await page.click('text="Toggle Left Panel"');
  await page.waitForTimeout(300);
  report('left panel reopens', await page.locator('.sf-left-group').isVisible());

  const panelDisplayed = (side) =>
    page.evaluate((s) => {
      const el = document.querySelector(`.sf-panel--${s}`);
      return el ? getComputedStyle(el).display !== 'none' : null;
    }, side);
  await page.setViewportSize({ width: 900, height: 800 });
  await page.waitForTimeout(400);
  report(
    'narrow window auto-hides both panels',
    (await panelDisplayed('left')) === false && (await panelDisplayed('right')) === false,
  );
  await page.locator('.sf-docker-app[title="Explorer"]').click();
  await page.waitForTimeout(400);
  report('docker click overrides auto-hide (left opens)', (await panelDisplayed('left')) === true);
  await page.locator('.sf-docker-app[title="Workspace"]').click();
  await page.waitForTimeout(400);
  await page.fill('.sf-ws-save .sf-ws-input', 'AH');
  await page.click('.sf-ws-save .sf-ws-btn--primary');
  await page.waitForTimeout(300);
  await wsItem('AH').locator('.sf-ws-btn[title="Load this workspace"]').click();
  await page.waitForTimeout(600);
  report(
    'loading a workspace re-enforces auto-hide',
    (await panelDisplayed('left')) === false && (await panelDisplayed('right')) === false,
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(500);
  report(
    'wide window restores both panels',
    (await panelDisplayed('left')) === true && (await panelDisplayed('right')) === true,
  );

  const rightTitle = () => page.locator('.sf-panel--right .sf-panel-title').textContent();
  report(
    'right panel shows the default layout',
    ((await rightTitle()) ?? '').trim() === 'Properties',
    `title=${await rightTitle()}`,
  );
  await tab('layout.json').first().click({ force: true });
  await page.waitForTimeout(400);
  report(
    'right panel switches to the welcome variant for the welcome tab',
    ((await rightTitle()) ?? '').trim() === 'Welcome Info',
    `title=${await rightTitle()}`,
  );
  await tab('framework.ts').first().click({ force: true });
  await page.waitForTimeout(400);
  report(
    'right panel falls back to the default layout on other tabs',
    ((await rightTitle()) ?? '').trim() === 'Properties',
    `title=${await rightTitle()}`,
  );

  report('no page errors during the whole check', errors.length === 0, errors.join('; ').slice(0, 300));

  await finish(browser, serverProc, isFailed(), 'WORKSPACE-APP CHECKS');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
