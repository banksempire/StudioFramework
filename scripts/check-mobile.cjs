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
  report('mobile: status bar hidden', (await page.locator('.sf-status-bar').count()) === 0);
  report(
    'mobile: bottom dock instead of the left rail',
    (await page.locator('.sf-docker--bottom').count()) === 1 &&
      (await page.locator('.sf-left-group').count()) === 0,
  );
  report('mobile: right panel hidden', (await page.locator('.sf-panel--right').count()) === 0);
  report('mobile: ONE tile', (await tileCount()) === 1);
  report(
    'mobile bar: [selector | active tab | close | right panel]',
    (await page.locator('.sf-mobile-tab-selector').count()) === 1 &&
      (await page.locator('.sf-mobile-tab-label').count()) === 1 &&
      (await page.locator('.sf-mobile-tab-close').count()) === 1 &&
      (await page.locator('.sf-mobile-rp-btn').count()) === 1,
  );
  report("mobile bar: shows the focused tile's active tab", allTabs.includes(await mobileBarLabel()));

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
      (await page.locator('.sf-mobile-panel-title').textContent()) === 'Properties',
  );
  await page.locator('.sf-mobile-panel-close').click();
  await page.waitForTimeout(300);
  report('overlay ✕ closes it', (await page.locator('.sf-mobile-panel').count()) === 0);

  // ── Mobile: fullscreen panels from the dock ─────────────────────────────
  const explorer = page.locator('.sf-docker-app[title="Explorer"]');
  await explorer.click();
  await page.waitForTimeout(300);
  report(
    'dock tap opens the app panel fullscreen',
    (await page.locator('.sf-mobile-panel').isVisible()) &&
      (await page.locator('.sf-mobile-panel-title').textContent()) === 'Explorer',
  );
  report(
    'fullscreen panel shows the app content (Files)',
    (await page.locator('.sf-mobile-panel .sf-panel-title').textContent()) === 'Files',
  );
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
  await page.locator('.sf-mobile-panel-close').click();
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
