const { chromium } = require('playwright');
const { ensureServer, makeReporter, finish } = require('./lib/ui-test.cjs');

const WS = '.sf-workspace';

(async () => {
  const serverProc = await ensureServer();
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1300, height: 900 } });
  await context.addInitScript(() => {
    if (!sessionStorage.getItem('mobile-check-cleared')) {
      sessionStorage.setItem('mobile-check-cleared', '1');
      localStorage.clear();
    }
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(`http://localhost:${process.env.SF_TEST_PORT || '7492'}/`, {
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
  const wsBox = () => page.locator(WS).boundingBox();
  const activeTabLabel = () => page.locator('.sf-tab.active .sf-tab-label').first().textContent();
  const mobileBarLabel = () => page.locator('.sf-mobile-tab-label').textContent();
  const mobileSelectorItems = async () => {
    await page.locator('.sf-mobile-tab-label').click();
    await page.waitForTimeout(200);
    return page.locator('.sf-tab-dropdown .sf-tab-dropdown-label').allTextContents();
  };
  const resizeTo = async (w) => {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(300);
  };

  report(
    'desktop: menu bar + status bar visible',
    (await page.locator('.sf-menu-bar').count()) === 1 &&
      (await page.locator('.sf-status-bar').count()) === 1,
  );
  report(
    'desktop: left docker rail + right panel present',
    (await page.locator('.sf-docker').count()) === 1 &&
      (await page.locator('.sf-panel--right').count()) === 1,
  );
  report(
    'desktop: single tile with 4 demo tabs',
    (await tileCount()) === 1 && (await tileTabs(0)).length === 4,
  );

  const wb = await wsBox();
  await tab('framework.ts').dragTo(page.locator(WS), {
    targetPosition: { x: wb.width - 10, y: wb.height / 2 },
  });
  await page.waitForTimeout(400);
  report('split right → 2 tiles', (await tileCount()) === 2);
  await page.evaluate(() => {
    const api = window.__sfWorkspace;
    const walk = (node) => (node.kind === 'tile' ? node.id : walk(node.children[0]));
    api.ops.newTab(walk(api.roots[0].node));
  });
  await page.waitForTimeout(300);
  const desktopTiles = [await tileTabs(0), await tileTabs(1)];
  const allTabs = desktopTiles.flat();
  report('new tab added (5 tabs total)', allTabs.length === 5);

  await resizeTo(450);
  report('mobile: menu bar hidden', (await page.locator('.sf-menu-bar').count()) === 0);
  report('mobile: status bar visible', (await page.locator('.sf-status-bar').count()) === 1);
  report(
    'mobile: bottom dock instead of the left rail',
    (await page.locator('.sf-docker--bottom').count()) === 1 &&
      (await page.locator('.sf-left-group').count()) === 0,
  );
  report('mobile: right panel hidden', (await page.locator('.sf-panel--right').count()) === 0);
  report('mobile: ONE tile', (await tileCount()) === 1);
  report(
    'mobile bar: [⋯ menu | active tab (tap opens the tab list) | right panel]',
    (await page.locator('.sf-mobile-menu-btn').count()) === 1 &&
      (await page.locator('.sf-mobile-tab-selector').count()) === 0 &&
      (await page.locator('.sf-mobile-tab-label').count()) === 1 &&
      (await page.locator('.sf-mobile-tab-close').count()) === 0 &&
      (await page.locator('.sf-mobile-rp-btn').count()) === 1,
  );
  report("mobile bar: shows the focused tile's active tab", allTabs.includes(await mobileBarLabel()));

  await page.locator('.sf-mobile-menu-btn').click();
  await page.waitForTimeout(200);
  const menuRows = await page.locator('.sf-menu-sheet .sf-menu-row .sf-menu-cell--label').allTextContents();
  report(
    '⋯ opens the layout menu tree',
    JSON.stringify(menuRows) === JSON.stringify(['File', 'Edit', 'Selection', 'View', 'Help']),
  );
  const sheetBox = await page.locator('.sf-menu-sheet').boundingBox();
  const vp = page.viewportSize();
  report(
    '⋯ sheet takes ALL the space',
    Math.round(sheetBox.x) === 0 &&
      Math.round(sheetBox.y) === 0 &&
      Math.round(sheetBox.width) === vp.width &&
      Math.round(sheetBox.height) === vp.height - 98,
  );
  report('⋯ no back button at the root level', (await page.locator('.sf-menu-sheet-back').count()) === 0);
  report(
    '⋯ no section-tab strip (menus do not have sections)',
    (await page.locator('.sf-menu-crumb, .sf-menu-sheet-crumbs').count()) === 0,
  );
  const rootTitle = await page.evaluate(() => {
    const t = document.querySelector('.sf-menu-sheet-title');
    const bar = document.querySelector('.sf-menu-sheet-bar');
    const tr = t.getBoundingClientRect();
    const br = bar.getBoundingClientRect();
    return {
      text: t.textContent,
      center: Math.round(tr.x + tr.width / 2),
      barCenter: Math.round(br.x + br.width / 2),
      caps: getComputedStyle(t).textTransform,
    };
  });
  report(
    "⋯ root title is 'menu', centered, capitalized",
    rootTitle.text === 'menu' && rootTitle.center === rootTitle.barCenter && rootTitle.caps === 'capitalize',
  );
  const closeAtRight = await page.evaluate(() => {
    const c = document.querySelector('.sf-menu-sheet-close').getBoundingClientRect();
    const bar = document.querySelector('.sf-menu-sheet-bar').getBoundingClientRect();
    return Math.round(c.x + c.width) === Math.round(bar.x + bar.width);
  });
  report('⋯ close button on the top right at the root level', closeAtRight);
  await page.evaluate(() => {
    const root = document.querySelector('.sf-root--mobile');
    root.style.setProperty('--sf-safe-top', '44px');
    root.style.setProperty('--sf-safe-bottom', '34px');
  });
  await page.waitForTimeout(200);
  const safeSheet = await page.locator('.sf-menu-sheet').boundingBox();
  const safeBar = await page.locator('.sf-menu-sheet-bar').boundingBox();
  report(
    '⋯ safe-area: sheet covers the notch zone, bar below it',
    Math.round(safeSheet.y) === 0 && Math.round(safeBar.y) === 44,
  );
  await page.evaluate(() => {
    const root = document.querySelector('.sf-root--mobile');
    root.style.removeProperty('--sf-safe-top');
    root.style.removeProperty('--sf-safe-bottom');
  });
  await page.waitForTimeout(200);
  report('⋯ ✕ close button present', (await page.locator('.sf-menu-sheet-close').count()) === 1);
  await page.locator('.sf-menu-sheet .sf-menu-row', { hasText: 'File' }).click();
  await page.waitForTimeout(200);
  const lvl2 = await page.locator('.sf-menu-sheet .sf-menu-row .sf-menu-cell--label').allTextContents();
  report('tapping a parent navigates into it', lvl2.includes('New File') && lvl2.includes('Open Folder...'));
  report('back button appears when nested', (await page.locator('.sf-menu-sheet-back').count()) === 1);
  const nestedTitle = await page.evaluate(() => {
    const t = document.querySelector('.sf-menu-sheet-title');
    const bar = document.querySelector('.sf-menu-sheet-bar');
    const tr = t.getBoundingClientRect();
    const br = bar.getBoundingClientRect();
    return {
      text: t.textContent,
      center: Math.round(tr.x + tr.width / 2),
      barCenter: Math.round(br.x + br.width / 2),
    };
  });
  report(
    '⋯ nested title shows the level, centered',
    nestedTitle.text === 'File' && nestedTitle.center === nestedTitle.barCenter,
  );
  await page.locator('.sf-menu-sheet .sf-menu-row', { hasText: 'New File' }).click();
  await page.waitForTimeout(200);
  const lvl3 = await page.locator('.sf-menu-sheet .sf-menu-row .sf-menu-cell--label').allTextContents();
  report('deep navigation works (3 levels)', lvl3.includes('Text File') && lvl3.includes('Vue SFC'));
  await page.locator('.sf-menu-sheet .sf-menu-row', { hasText: 'Text File' }).click();
  await page.waitForTimeout(200);
  report('selecting a leaf closes the menu', (await page.locator('.sf-menu-sheet').count()) === 0);
  await page.locator('.sf-mobile-menu-btn').click();
  await page.waitForTimeout(200);
  await page.locator('.sf-menu-sheet .sf-menu-row', { hasText: 'View' }).click();
  await page.waitForTimeout(200);
  await page.locator('.sf-menu-sheet-back').click();
  await page.waitForTimeout(200);
  report(
    '← back returns to the root level',
    JSON.stringify(
      await page.locator('.sf-menu-sheet .sf-menu-row .sf-menu-cell--label').allTextContents(),
    ) === JSON.stringify(['File', 'Edit', 'Selection', 'View', 'Help']),
  );
  await page.locator('.sf-menu-sheet .sf-menu-row', { hasText: 'Help' }).click();
  await page.waitForTimeout(200);
  await page.locator('.sf-menu-sheet-close').click();
  await page.waitForTimeout(200);
  report('✕ closes the sheet', (await page.locator('.sf-menu-sheet').count()) === 0);

  report(
    'label tap lists all tabs in order',
    JSON.stringify(await mobileSelectorItems()) === JSON.stringify(allTabs),
  );
  await page.locator('.sf-tab-dropdown-row', { hasText: 'styles.css' }).click();
  await page.waitForTimeout(200);
  report('selecting a tab activates it', (await mobileBarLabel()) === 'styles.css');
  await page.locator('.sf-mobile-tab-label').click();
  await page.waitForTimeout(200);
  await page.locator('.sf-tab-dropdown-row', { hasText: 'layout.json' }).click();
  await page.waitForTimeout(200);
  report('activation survives (layout.json active)', (await mobileBarLabel()) === 'layout.json');

  await page.locator('.sf-mobile-rp-btn').click();
  await page.waitForTimeout(300);
  report(
    'right-panel button opens the right panel fullscreen',
    (await page.locator('.sf-mobile-panel').isVisible()) &&
      (await page.locator('.sf-mobile-panel .sf-panel-title').textContent()) === 'Properties',
  );
  await page.locator('.sf-panel-close-btn').click();
  await page.waitForTimeout(300);
  report('overlay ✕ closes it', (await page.locator('.sf-mobile-panel').count()) === 0);

  const explorer = page.locator('.sf-docker-app[title="Explorer"]');
  await explorer.click();
  await page.waitForTimeout(300);
  report(
    'dock tap opens the app panel fullscreen (header shows the panel name)',
    (await page.locator('.sf-mobile-panel').isVisible()) &&
      (await page.locator('.sf-mobile-panel .sf-panel-title').textContent()) === 'Files',
  );
  report(
    'fullscreen panel shows the app content (Files)',
    (await page.locator('.sf-mobile-panel .sf-panel-title').textContent()) === 'Files',
  );
  const panelTitle = await page.evaluate(() => {
    const h = document.querySelector('.sf-mobile-panel .sf-panel-header');
    const t = document.querySelector('.sf-mobile-panel .sf-panel-title');
    const d = document.querySelector('.sf-mobile-panel .sf-panel-header-btn');
    const c = document.querySelector('.sf-mobile-panel .sf-panel-close-btn');
    const hr = h.getBoundingClientRect();
    const tr = t.getBoundingClientRect();
    const dr = d.getBoundingClientRect();
    const cr = c.getBoundingClientRect();
    return {
      center: Math.round(tr.x + tr.width / 2),
      barCenter: Math.round(hr.x + hr.width / 2),
      closeRight: Math.round(cr.x + cr.width),
      barRight: Math.round(hr.x + hr.width),
      ellipsisLeft: Math.abs(Math.round(dr.x) - Math.round(hr.x)) <= 1,
    };
  });
  report(
    '⋯ panel title centered, ⋯ pinned left, ✕ pinned right',
    panelTitle.center === panelTitle.barCenter &&
      panelTitle.closeRight === panelTitle.barRight &&
      panelTitle.ellipsisLeft,
  );
  await page.evaluate(() => {
    const root = document.querySelector('.sf-root--mobile');
    root.style.setProperty('--sf-safe-top', '44px');
    root.style.setProperty('--sf-safe-bottom', '34px');
  });
  await page.waitForTimeout(200);
  const safePanel = await page.locator('.sf-mobile-panel').boundingBox();
  const safePanelHeader = await page.locator('.sf-panel--mobile .sf-panel-header').boundingBox();
  const safePanelBg = await page.evaluate(
    () => getComputedStyle(document.querySelector('.sf-mobile-panel')).backgroundColor,
  );
  report(
    'panel safe-area: covers the notch zone, header below it, same bg as the sheet',
    Math.round(safePanel.y) === 0 &&
      Math.round(safePanelHeader.y) === 44 &&
      safePanelBg === 'rgb(16, 16, 16)',
  );
  await page.evaluate(() => {
    const root = document.querySelector('.sf-root--mobile');
    root.style.removeProperty('--sf-safe-top');
    root.style.removeProperty('--sf-safe-bottom');
  });
  await page.waitForTimeout(200);
  await explorer.click();
  await page.waitForTimeout(300);
  report('tapping the open app again closes it', (await page.locator('.sf-mobile-panel').count()) === 0);

  await page.locator('.sf-docker-app[title="Search"]').click();
  await page.waitForTimeout(300);
  report(
    'switching apps swaps the panel',
    (await page.locator('.sf-mobile-panel .sf-panel-title').textContent()) === 'Search',
  );
  await page.locator('.sf-panel-close-btn').click();
  await page.waitForTimeout(300);
  report('✕ closes the panel', (await page.locator('.sf-mobile-panel').count()) === 0);

  await resizeTo(1300);
  report(
    'tile structure resumes (2 tiles, all 5 tabs intact)',
    (await tileCount()) === 2 &&
      JSON.stringify(await tileTabs(0)) === JSON.stringify(desktopTiles[0]) &&
      JSON.stringify(await tileTabs(1)) === JSON.stringify(desktopTiles[1]),
  );
  report(
    'menu bar + status bar back',
    (await page.locator('.sf-menu-bar').count()) === 1 &&
      (await page.locator('.sf-status-bar').count()) === 1,
  );
  report(
    'left rail + right panel back',
    (await page.locator('.sf-docker--bottom').count()) === 0 &&
      (await page.locator('.sf-panel--right').count()) === 1,
  );
  report('mobile activation survived (layout.json active)', (await activeTabLabel()) === 'layout.json');

  await resizeTo(450);
  report('mobile again: one flat tile, 5 tabs', (await tileCount()) === 1);
  await page.locator('.sf-mobile-tab-label').click();
  await page.waitForTimeout(200);
  const rowsA = await page.locator('.sf-tab-dropdown .sf-tab-dropdown-label').allTextContents();
  report('tab list reopens with all 5 tabs', JSON.stringify(rowsA) === JSON.stringify(allTabs));
  report('active tab is layout.json', (await mobileBarLabel()) === 'layout.json');

  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 450,
    height: 900,
    deviceScaleFactor: 1,
    mobile: true,
    screenWidth: 450,
    screenHeight: 900,
  });
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  const sheetRow = (label) => page.locator('.sf-tab-dropdown-row', { hasText: label });
  const touch = (type, touchPoints) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
  const swipeStart = async (locator) => {
    const b = await locator.boundingBox();
    const y = b.y + b.height / 2;
    const x0 = b.x + b.width - 18;
    await touch('touchStart', [{ x: x0, y }]);
    return { x0, y };
  };
  const swipeMoveTo = async (x, y, steps = 1) => {
    for (let i = 1; i <= steps; i += 1) {
      await touch('touchMove', [{ x, y }]);
      await page.waitForTimeout(16);
    }
  };
  const swipeEnd = async () => {
    await touch('touchEnd', []);
    await page.waitForTimeout(320);
  };
  const tapEl = async (locator) => {
    const b = await locator.boundingBox();
    const x = b.x + b.width / 2;
    const y = b.y + b.height / 2;
    await touch('touchStart', [{ x, y }]);
    await touch('touchEnd', []);
    await page.waitForTimeout(250);
  };

  const mid = await swipeStart(sheetRow('styles.css'));
  await swipeMoveTo(mid.x0 - 110, mid.y, 3);
  const midBody = sheetRow('styles.css').locator('.sf-tab-dropdown-slide');
  const midTransform = await midBody.evaluate((el) => getComputedStyle(el).transform);
  const txOf = (tf) => {
    const m = /^matrix\(1, 0, 0, 1, (-?[\d.]+)/.exec(tf);
    return m ? Number(m[1]) : null;
  };
  const midTx = txOf(midTransform);
  const fullBleed = await page.evaluate(() => {
    const row = Array.from(document.querySelectorAll('.sf-tab-dropdown-row')).find((r) =>
      r.textContent?.includes('styles.css'),
    );
    const slide = row?.querySelector('.sf-tab-dropdown-slide');
    const rb = row.getBoundingClientRect();
    const sb = slide.getBoundingClientRect();
    return {
      w: rb.width - sb.width <= 2.5,
      h: rb.height - sb.height <= 1.5,
      rowW: rb.width,
      slideW: sb.width,
      rowH: rb.height,
      slideH: sb.height,
    };
  });
  const midBtn = sheetRow('styles.css').locator('.sf-tab-dropdown-close-btn');
  const midBtnActive = sheetRow('styles.css').locator('.sf-tab-dropdown-close-btn.active');
  report(
    'mid-drag: the WHOLE row block slides (full width + height), button already visible',
    fullBleed.w && fullBleed.h && midTx !== null && midTx < 0 && (await midBtn.isVisible()),
    `row=${fullBleed.rowW}x${fullBleed.rowH} slide=${fullBleed.slideW}x${fullBleed.slideH} tf=${midTransform}`,
  );
  report('mid-drag: button carries the active (unveiled) class', (await midBtnActive.count()) === 1);
  await swipeEnd();
  const rowBody = sheetRow('styles.css').locator('.sf-tab-dropdown-slide');
  const closeBtn1 = sheetRow('styles.css').locator('.sf-tab-dropdown-close-btn');
  const bodyTransform = await rowBody.evaluate((el) => getComputedStyle(el).transform);
  report(
    'released: row snaps open (-86px), Close button revealed',
    (await closeBtn1.isVisible()) && /-86/.test(bodyTransform) && bodyTransform !== 'none',
  );
  report(
    'only the swiped row is revealed',
    (await page.locator('.sf-tab-dropdown-close-btn.revealed').count()) === 1,
  );

  await tapEl(closeBtn1);
  await page.waitForTimeout(200);
  const rowsB = await page.locator('.sf-tab-dropdown-label').allTextContents();
  report(
    'Close removes the tab (4 left), active tab untouched',
    rowsB.length === 4 && !rowsB.includes('styles.css') && (await mobileBarLabel()) === 'layout.json',
  );

  const act = await swipeStart(sheetRow('layout.json'));
  for (let i = 1; i <= 8; i += 1) {
    await touch('touchMove', [{ x: act.x0 - (110 * i) / 8, y: act.y }]);
    await page.waitForTimeout(16);
  }
  await swipeEnd();
  const closeBtn2 = sheetRow('layout.json').locator('.sf-tab-dropdown-close-btn');
  report('the active row is also swipeable', await closeBtn2.isVisible());
  await tapEl(closeBtn2);
  await page.waitForTimeout(200);
  const newActive = await mobileBarLabel();
  const rowsC = await page.locator('.sf-tab-dropdown-label').allTextContents();
  report(
    'closing the ACTIVE tab activates a neighbor',
    rowsC.length === 3 && newActive !== 'layout.json' && Boolean(newActive),
  );
  const markedMatches = await page.evaluate((lbl) => {
    const mark = document.querySelector('.sf-tab-dropdown-mark');
    return mark?.closest('.sf-tab-dropdown-row')?.textContent?.includes(lbl) ?? false;
  }, newActive);
  report(
    'selection marker follows the new active tab',
    (await page.locator('.sf-tab-dropdown-mark').count()) === 1 && markedMatches,
  );

  await tapEl(sheetRow('framework.t'));
  await page.waitForTimeout(250);
  report(
    'a plain tap still selects and closes the dropdown',
    (await mobileBarLabel()) === 'framework.ts' && (await page.locator('.sf-tab-dropdown').count()) === 0,
  );

  report('no console/page errors', errors.length === 0, errors.join('; '));

  await finish(browser, serverProc, isFailed(), 'MOBILE CHECKS');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
