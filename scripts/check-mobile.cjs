/**
 * Headless UI check for Mobile mode (window width < 500px).
 *
 * Usage: SF_TEST_PORT=7494 npm run check:mobile   (demo dev server on a test port)
 *
 * Covers: auto-trigger below 500px (menu bar + status bar + side panels
 * hidden, bottom dock instead of the left rail), the flat single-tile
 * workspace holding ALL tabs (the real tile tree stays untouched), dock
 * taps opening/closing fullscreen panels, and the tile structure resuming
 * exactly when the window widens again (relationship not lost).
 */
const { chromium } = require('playwright');
const { ensureServer, makeReporter, finish } = require('./lib/ui-test.cjs');

const WS = '.sf-workspace';

(async () => {
  const serverProc = await ensureServer();
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1300, height: 900 } });
  // Clear localStorage on the FIRST navigation only (a reload must keep it).
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
  /** Mobile compact bar: the active-tab label (not the desktop strip). */
  const mobileBarLabel = () => page.locator('.sf-mobile-tab-label').textContent();
  const mobileSelectorItems = async () => {
    await page.locator('.sf-mobile-tab-selector').click();
    await page.waitForTimeout(200);
    return page.locator('.sf-menu-row .sf-menu-cell--label').allTextContents();
  };
  const resizeTo = async (w) => {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(300);
  };

  // ── Desktop baseline: split into 2 tiles + a new tab ────────────────────
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

  // Split right: framework.ts to the right edge → 2 tiles.
  const wb = await wsBox();
  await tab('framework.ts').dragTo(page.locator(WS), {
    targetPosition: { x: wb.width - 10, y: wb.height / 2 },
  });
  await page.waitForTimeout(400);
  report('split right → 2 tiles', (await tileCount()) === 2);
  // The 2-tile layout is auto-saved; reload now so the mobile switch below
  // runs on the restored (unsplit) boot state? No — keep the split live.
  await page.locator('.sf-tab-new').first().click();
  await page.waitForTimeout(300);
  const desktopTiles = [await tileTabs(0), await tileTabs(1)];
  const allTabs = desktopTiles.flat();
  report('new tab added (5 tabs total)', allTabs.length === 5);

  // ── Mobile: auto-trigger below 500px ────────────────────────────────────
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
    'mobile bar: [⋯ menu | selector | active tab | close | right panel]',
    (await page.locator('.sf-mobile-menu-btn').count()) === 1 &&
      (await page.locator('.sf-mobile-tab-selector').count()) === 1 &&
      (await page.locator('.sf-mobile-tab-label').count()) === 1 &&
      (await page.locator('.sf-mobile-tab-close').count()) === 1 &&
      (await page.locator('.sf-mobile-rp-btn').count()) === 1,
  );
  report("mobile bar: shows the focused tile's active tab", allTabs.includes(await mobileBarLabel()));

  // ⋯ button: opens the layout's menu tree as a FULLSCREEN sheet (like a
  // panel) — body takes all the space, [← back] left when nested, [✕
  // close] right. Parent rows navigate on tap (no hover on touch).
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
      Math.round(sheetBox.height) === vp.height - 85,
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
    };
  });
  report(
    "⋯ root title is 'menu', centered",
    rootTitle.text === 'menu' && rootTitle.center === rootTitle.barCenter,
  );
  // Simulated iPhone notch: the sheet covers the top safe-area zone with
  // its own background and the bar stays below the inset.
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
  // Back button pops to the parent level (reopen first).
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
  // ✕ closes from any level.
  await page.locator('.sf-menu-sheet .sf-menu-row', { hasText: 'Help' }).click();
  await page.waitForTimeout(200);
  await page.locator('.sf-menu-sheet-close').click();
  await page.waitForTimeout(200);
  report('✕ closes the sheet', (await page.locator('.sf-menu-sheet').count()) === 0);

  // Tab selector: lists ALL tabs in visual order; selecting routes to the
  // REAL tile behind the tab (survives the switch back to desktop).
  report(
    'selector lists all tabs in order',
    JSON.stringify(await mobileSelectorItems()) === JSON.stringify(allTabs),
  );
  await page.locator('.sf-menu-row', { hasText: 'styles.css' }).click();
  await page.waitForTimeout(200);
  report('selecting a tab activates it', (await mobileBarLabel()) === 'styles.css');

  // Close button: closes the ACTIVE tab (routed to the real tree).
  await page.locator('.sf-mobile-tab-close').click();
  await page.waitForTimeout(200);
  const afterCloseTiles = [desktopTiles[0].filter((t) => t !== 'styles.css'), desktopTiles[1]];
  report(
    '✕ closes the active tab (4 tabs left)',
    JSON.stringify(await mobileSelectorItems()) === JSON.stringify(afterCloseTiles.flat()),
  );
  // The selector menu is still open from the item-count check — pick the
  // next tab directly (a row click both selects and closes).
  await page.locator('.sf-menu-row', { hasText: 'layout.json' }).click();
  await page.waitForTimeout(200);
  report('activation survives (layout.json active)', (await mobileBarLabel()) === 'layout.json');

  // Right-panel button: opens the right panel fullscreen; the overlay's ✕
  // closes it (the fullscreen panel covers the bar, so the button is not
  // reachable while open).
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

  // ── Mobile: fullscreen panels from the dock ─────────────────────────────
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
  // Simulated notch: the panel overlay covers the top safe-area zone with
  // the SAME color as the menu sheet (bg-light) and its header stays below.
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
      safePanelBg === 'rgb(37, 37, 38)',
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

  // Different app + the ✕ close button.
  await page.locator('.sf-docker-app[title="Search"]').click();
  await page.waitForTimeout(300);
  report(
    'switching apps swaps the panel',
    (await page.locator('.sf-mobile-panel .sf-panel-title').textContent()) === 'Search',
  );
  await page.locator('.sf-panel-close-btn').click();
  await page.waitForTimeout(300);
  report('✕ closes the panel', (await page.locator('.sf-mobile-panel').count()) === 0);

  // ── Back to desktop: the tile tree resumes exactly ──────────────────────
  await resizeTo(1300);
  report(
    'tile structure resumes (2 tiles, styles.css closed)',
    (await tileCount()) === 2 &&
      JSON.stringify(await tileTabs(0)) === JSON.stringify(afterCloseTiles[0]) &&
      JSON.stringify(await tileTabs(1)) === JSON.stringify(afterCloseTiles[1]),
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

  // ── No errors ──────────────────────────────────────────────────────────
  report('no console/page errors', errors.length === 0, errors.join('; '));

  await finish(browser, serverProc, isFailed(), 'MOBILE CHECKS');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
