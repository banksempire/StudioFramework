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
  const desktopUtils = await page.evaluate(() => {
    const utils = Array.from(document.querySelectorAll('.sf-panel--right .sf-subsection-utils'));
    return {
      count: utils.length,
      allHidden: utils.every((u) => getComputedStyle(u).display === 'none'),
    };
  });
  report(
    'desktop: subsection utility buttons hidden until hover/activate',
    desktopUtils.count > 0 && desktopUtils.allHidden,
    `count=${desktopUtils.count}`,
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
  const mobileSubUtils = await page.evaluate(() => {
    const utils = Array.from(document.querySelectorAll('.sf-mobile-panel .sf-subsection-utils'));
    return {
      count: utils.length,
      allShown: utils.every((u) => getComputedStyle(u).display === 'flex'),
    };
  });
  report(
    'mobile: subsection utility buttons always visible',
    mobileSubUtils.count > 0 && mobileSubUtils.allShown,
    `count=${mobileSubUtils.count}`,
  );
  await page.locator('.sf-mobile-panel .sf-subsection-header').first().click();
  await page.waitForTimeout(200);
  report(
    'mobile: utility buttons stay visible on a collapsed subsection',
    (await page.evaluate(
      () =>
        getComputedStyle(
          document.querySelector('.sf-mobile-panel .sf-subsection--collapsed .sf-subsection-utils'),
        ).display,
    )) === 'flex',
  );
  await page.locator('.sf-mobile-panel .sf-subsection-header').first().click();
  await page.waitForTimeout(200);
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
  report(
    'list items are NOT wrapped in a rounded box',
    (await page.locator('.sf-tab-dropdown-group').count()) === 0 &&
      (await page.evaluate(() => {
        const r = document.querySelector('.sf-tab-dropdown-row');
        return r && getComputedStyle(r.parentElement).borderRadius === '0px';
      })),
  );
  report(
    'list items are 60px tall',
    (await page.locator('.sf-tab-dropdown-row').first().boundingBox()).height === 60,
  );
  report(
    'the list is ALWAYS a scroll container (even when the 5 rows fit)',
    (await page.evaluate(() => {
      const b = document.querySelector('.sf-tab-dropdown-body');
      return b && getComputedStyle(b).overflowY === 'scroll' && b.scrollHeight > b.clientHeight;
    })) === true,
  );
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
  const tapEl = async (locator) => {
    const b = await locator.boundingBox();
    const x = b.x + b.width / 2;
    const y = b.y + b.height / 2;
    await touch('touchStart', [{ x, y }]);
    await touch('touchEnd', []);
    await page.waitForTimeout(250);
  };

  const vrow = sheetRow('styles.css');
  const vb = await vrow.boundingBox();
  const vx = vb.x + vb.width / 2;
  const vy0 = vb.y + vb.height / 2;
  await touch('touchStart', [{ x: vx, y: vy0 }]);
  for (let i = 1; i <= 6; i += 1) {
    await touch('touchMove', [{ x: vx, y: vy0 - i * 24 }]);
    await page.waitForTimeout(16);
  }
  const scrolledMidDrag = await page.evaluate(() => {
    const b = document.querySelector('.sf-tab-dropdown-body');
    return b.scrollTop > 0;
  });
  await touch('touchEnd', []);
  await page.waitForTimeout(250);
  report('vertical pan on a row scrolls the list natively (no JS scroll)', scrolledMidDrag);

  report(
    'every tab row shows an always-visible ⋮ button',
    (await page.locator('.sf-tab-dropdown-row .sf-tab-dropdown-more').count()) === 5,
  );
  const tabBox = await sheetRow('styles.css')
    .locator('.sf-tab-dropdown-more')
    .evaluate((el) => {
      const cs = getComputedStyle(el);
      const hex = cs.getPropertyValue('--sf-text').trim();
      const m = /^#([0-9a-f]{6})$/i.exec(hex);
      const want = m ? `rgb(${[1, 3, 5].map((i) => parseInt(hex.substr(i, 2), 16)).join(', ')})` : null;
      return {
        bw: cs.borderTopWidth,
        br: cs.borderTopLeftRadius,
        bg: cs.backgroundColor,
        color: cs.color,
        want,
      };
    });
  report(
    'tab ⋮ button box: #292929 fill + border + radius, dots not dimmed',
    parseFloat(tabBox.bw) >= 1 &&
      tabBox.br !== '0px' &&
      tabBox.bg === 'rgb(41, 41, 41)' &&
      tabBox.color === tabBox.want,
    JSON.stringify(tabBox),
  );

  const moreStyles = sheetRow('styles.css').locator('.sf-tab-dropdown-more');
  await tapEl(moreStyles);
  await page.waitForTimeout(250);
  report(
    'tapping ⋮ opens the popup with the tab title + Close + Cancel',
    (await page.locator('.sf-sm-dialog').count()) === 1 &&
      (await page.locator('.sf-sm-dialog-title').textContent()) === 'styles.css' &&
      JSON.stringify(await page.locator('.sf-sm-dialog .sf-sm-menu-row').allTextContents()) ===
        JSON.stringify(['Close']) &&
      (await page.locator('.sf-sm-dialog-cancel').count()) === 1,
  );
  await tapEl(page.locator('.sf-sm-dialog-cancel'));
  await page.waitForTimeout(200);
  report(
    'Cancel keeps the tab and closes the popup',
    (await page.locator('.sf-sm-dialog').count()) === 0 && (await sheetRow('styles.css').count()) === 1,
  );

  await tapEl(moreStyles);
  await page.waitForTimeout(200);
  await tapEl(page.locator('.sf-sm-dialog .sf-sm-menu-row', { hasText: 'Close' }));
  await page.waitForTimeout(200);
  const rowsB = await page.locator('.sf-tab-dropdown-label').allTextContents();
  report(
    'Close from the popup removes the tab (4 left), active tab untouched',
    rowsB.length === 4 && !rowsB.includes('styles.css') && (await mobileBarLabel()) === 'layout.json',
  );

  await tapEl(sheetRow('layout.json').locator('.sf-tab-dropdown-more'));
  await page.waitForTimeout(200);
  await tapEl(page.locator('.sf-sm-dialog .sf-sm-menu-row', { hasText: 'Close' }));
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

  const drow = sheetRow(rowsC.find((l) => !l.includes('framework.t')));
  const db = await drow.boundingBox();
  const dy = db.y + db.height / 2;
  const dx = db.x + db.width - 18;
  await touch('touchStart', [{ x: dx, y: dy }]);
  for (let i = 1; i <= 8; i += 1) {
    await touch('touchMove', [{ x: dx - i * 20, y: dy }]);
    await page.waitForTimeout(16);
  }
  await touch('touchEnd', []);
  await page.waitForTimeout(300);
  report(
    'swipe gestures are fully removed: a leftward drag on a tab row does nothing',
    (await drow.count()) === 1 &&
      (await page.locator('.sf-tab-dropdown-close-btn, .sf-tab-dropdown-slide').count()) === 0 &&
      (await page.locator('.sf-sm-dialog').count()) === 0,
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
