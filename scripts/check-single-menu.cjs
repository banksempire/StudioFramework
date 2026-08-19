const { chromium } = require('playwright');
const { ensureServer, makeReporter, finish } = require('./lib/ui-test.cjs');

(async () => {
  const serverProc = await ensureServer();
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1300, height: 900 } });
  await context.addInitScript(() => {
    if (!sessionStorage.getItem('single-menu-cleared')) {
      sessionStorage.setItem('single-menu-cleared', '1');
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

  const row = (label) => page.locator('.sf-sm-row', { hasText: label }).first();
  const status = () => page.locator('.single-menu-demo-status').textContent();
  const rowCount = () => page.locator('.sf-sm-row').count();

  report(
    'demo list renders 5 rows with custom content',
    (await rowCount()) === 5 && (await page.locator('.single-menu-demo-name').count()) === 5,
  );

  await row('welcome.md').click();
  report('left-click activates the row without any menu', (await status()) === 'open welcome.md');

  const rcPoint = await row('SingleMenu.vue').boundingBox();
  await page.mouse.click(rcPoint.x + 40, rcPoint.y + rcPoint.height / 2, { button: 'right' });
  await page.waitForTimeout(300);
  const menuBox = await page.locator('.sf-sm-menu').boundingBox();
  report(
    'right-click opens a single-level option menu at the cursor',
    !!menuBox && menuBox.x >= rcPoint.x - 20 && menuBox.y >= rcPoint.y - 20,
    `row=(${rcPoint.x},${rcPoint.y}) menu=(${menuBox?.x},${menuBox?.y})`,
  );
  report(
    'menu lists exactly the 3 options (flat, no sub-level)',
    JSON.stringify(await page.locator('.sf-sm-menu .sf-sm-menu-row').allTextContents()) ===
      JSON.stringify(['Open', 'Rename', 'Delete']),
  );

  await page.locator('.sf-sm-menu .sf-sm-menu-row', { hasText: 'Rename' }).click();
  await page.waitForTimeout(300);
  report(
    'menu closed after selecting an option',
    (await page.locator('.sf-sm-menu').count()) === 0 &&
      (await page.locator('.single-menu-demo-input').count()) === 1,
  );
  await page.keyboard.type('SingleMenu2.vue');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  report(
    'committing the rename updates the row',
    (await row('SingleMenu2.vue').count()) === 1 && /rename/.test(await status()),
  );

  await page.mouse.click(rcPoint.x + 40, rcPoint.y, { button: 'right' });
  await page.waitForTimeout(150);
  await page.keyboard.press('Escape');
  report('Escape closes the menu', (await page.locator('.sf-sm-menu').count()) === 0);

  await page.mouse.click(rcPoint.x + 40, rcPoint.y, { button: 'right' });
  await page.waitForTimeout(150);
  await page.locator('.sf-workspace').click({ position: { x: 20, y: 20 } });
  report('clicking outside closes the menu', (await page.locator('.sf-sm-menu').count()) === 0);

  await page.keyboard.press('Escape');

  await row('SingleMenu2.vue')
    .locator('.sf-sm-slide')
    .evaluate((el) =>
      el.dispatchEvent(
        new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 1280, clientY: 870 }),
      ),
    );
  await page.waitForTimeout(300);
  const cornerBox = await page.locator('.sf-sm-menu').boundingBox();
  report(
    'menu opened near the viewport corner stays fully on screen',
    !!cornerBox &&
      cornerBox.x >= 0 &&
      cornerBox.y >= 0 &&
      cornerBox.x + cornerBox.width <= 1300 &&
      cornerBox.y + cornerBox.height <= 900,
  );
  await page.keyboard.press('Escape');

  const before = await rowCount();
  const scratch = row('scratch.txt');
  const sb = await scratch.boundingBox();
  await page.mouse.click(sb.x + 30, sb.y + sb.height / 2, { button: 'right' });
  await page.waitForTimeout(150);
  report(
    'single-option item shows exactly one option',
    JSON.stringify(await page.locator('.sf-sm-menu .sf-sm-menu-row').allTextContents()) ===
      JSON.stringify(['Delete']),
  );
  await page.locator('.sf-sm-menu .sf-sm-menu-row', { hasText: 'Delete' }).click();
  await page.waitForTimeout(300);
  report(
    'deleting from the menu removes the row',
    (await rowCount()) === before - 1 && (await row('scratch.txt').count()) === 0,
  );

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
  await page.setViewportSize({ width: 450, height: 900 });
  await page.waitForTimeout(300);
  await page.locator('.sf-docker--bottom .sf-docker-app').first().click();
  await page.waitForTimeout(300);
  report(
    'mobile: demo list reachable in the docker panel',
    (await rowCount()) === 5 && (await page.locator('.sf-mobile-panel .sf-sm-row').count()) === 5,
  );

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

  const st0 = await status();
  const wpt = await swipeStart(row('welcome.md'));
  await swipeMoveTo(wpt.x0 - 110, wpt.y, 4);
  await swipeEnd();
  report(
    'swipe left on a multi-option item opens the centered popup dialog',
    (await page.locator('.sf-sm-dialog').count()) === 1 && (await page.locator('.sf-sm-menu').count()) === 0,
  );
  report(
    'dialog shows the item title + its options + cancel',
    (await page.locator('.sf-sm-dialog-title').textContent()) === 'welcome.md' &&
      JSON.stringify(await page.locator('.sf-sm-dialog .sf-sm-menu-row').allTextContents()) ===
        JSON.stringify(['Open', 'Rename', 'Delete']) &&
      (await page.locator('.sf-sm-dialog-cancel').count()) === 1,
  );
  report('the swipe itself does not activate the row (suppressed click)', (await status()) === st0);
  const dbox = await page.locator('.sf-sm-dialog').boundingBox();
  report(
    'dialog is centered in the viewport',
    Math.abs(dbox.x + dbox.width / 2 - 225) <= 4 && Math.abs(dbox.y + dbox.height / 2 - 450) <= 80,
  );

  await tapEl(page.locator('.sf-sm-dialog-cancel'));
  await page.waitForTimeout(200);
  report(
    'Cancel closes the dialog without acting',
    (await page.locator('.sf-sm-dialog').count()) === 0 && (await status()) === st0,
  );

  const wpt2 = await swipeStart(row('welcome.md'));
  await swipeMoveTo(wpt2.x0 - 110, wpt2.y, 4);
  await swipeEnd();
  await tapEl(page.locator('.sf-sm-dialog .sf-sm-menu-row', { hasText: 'Rename' }));
  await page.waitForTimeout(200);
  report(
    'choosing Rename in the dialog starts inline rename',
    (await page.locator('.sf-sm-dialog').count()) === 0 &&
      (await page.locator('.single-menu-demo-input').count()) === 1,
  );
  await tapEl(page.locator('.single-menu-demo-input'));
  await page.keyboard.type('welcome2.md');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  report('rename from the dialog commits', (await row('welcome2.md').count()) === 1);

  const npt = await swipeStart(row('scratch.txt'));
  await swipeMoveTo(npt.x0 - 60, npt.y, 3);
  await swipeEnd();
  report(
    'single-option item reveals the option directly (no dialog)',
    (await page.locator('.sf-sm-dialog').count()) === 0 &&
      (await row('scratch.txt').locator('.sf-sm-under--revealed').count()) === 1 &&
      /Delete/.test((await row('scratch.txt').locator('.sf-sm-act--danger').textContent()) ?? ''),
  );
  await tapEl(row('scratch.txt').locator('.sf-sm-act'));
  await page.waitForTimeout(200);
  report(
    'tapping the revealed option deletes the row',
    (await row('scratch.txt').count()) === 0 && /delete scratch\.txt/.test(await status()),
  );

  const vrow = row('framework.layout.json');
  const vb = await vrow.boundingBox();
  const vx = vb.x + vb.width / 2;
  const vy0 = vb.y + vb.height / 2;
  await touch('touchStart', [{ x: vx, y: vy0 }]);
  for (let i = 1; i <= 6; i += 1) {
    await touch('touchMove', [{ x: vx, y: vy0 - i * 24 }]);
    await page.waitForTimeout(16);
  }
  await touch('touchEnd', []);
  await page.waitForTimeout(250);
  report(
    'a vertical pan never reveals the actions layer',
    (await page.locator('.sf-sm-under--revealed, .sf-sm-under--active').count()) === 0,
  );

  await tapEl(row('framework.layout.json'));
  await page.waitForTimeout(200);
  await row('framework.layout.json')
    .locator('.sf-sm-slide')
    .evaluate((el) => el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })));
  await page.waitForTimeout(200);
  report(
    'long-press contextmenu is suppressed on touch (no option menu)',
    (await page.locator('.sf-sm-menu').count()) === 0,
  );
  const rcb = await row('framework.layout.json').boundingBox();
  await page.mouse.click(rcb.x + 40, rcb.y + rcb.height / 2, { button: 'right' });
  await page.waitForTimeout(200);
  report(
    'mouse right-click still opens the menu after touch interaction',
    (await page.locator('.sf-sm-menu').count()) === 1,
  );

  report('no page errors during the run', errors.length === 0, errors.join(' | '));

  await finish(browser, serverProc, isFailed() || errors.length > 0, 'SINGLE-MENU CHECKS');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
