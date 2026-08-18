const { ensureServer, openApp, makeReporter, finish } = require('./lib/ui-test.cjs');

(async () => {
  const serverProc = await ensureServer();
  const { browser, page, errors } = await openApp({ viewport: { width: 1300, height: 900 } });
  const { report, isFailed } = makeReporter();

  try {
    const panelDisplayed = async (side) => {
      return page.evaluate((s) => {
        const el = document.querySelector(`.sf-panel--${s}`);
        if (!el) return null;
        return getComputedStyle(el).display !== 'none';
      }, side);
    };

    const leftGroupDisplayed = async () => {
      return page.evaluate(() => {
        const el = document.querySelector('.sf-left-group');
        if (!el) return null;
        return getComputedStyle(el).display !== 'none';
      });
    };

    const resizeTo = async (w) => {
      await page.setViewportSize({ width: w, height: 900 });
      await page.waitForTimeout(100);
    };

    const dragPanel = async (side, deltaPx) => {
      const handleClass =
        side === 'left' ? '.sf-panel-resize-handle--right' : '.sf-panel-resize-handle--left';
      const handle = await page.$(handleClass);
      if (!handle) {
        report(`handle found: ${side}`, false);
        return;
      }
      const box = await handle.boundingBox();
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      const dir = side === 'left' ? 1 : -1;
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(cx + deltaPx * dir, cy, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(100);
    };

    await resizeTo(1300);
    report(
      'both visible at 1300px',
      (await panelDisplayed('left')) === true && (await panelDisplayed('right')) === true,
    );

    await resizeTo(1000);
    report(
      'left hidden at 1000px (left first)',
      (await panelDisplayed('left')) === false && (await panelDisplayed('right')) === true,
    );

    await resizeTo(900);
    report(
      'both hidden at 900px',
      (await panelDisplayed('left')) === false && (await panelDisplayed('right')) === false,
    );

    await resizeTo(1000);
    report(
      'right restored at 1000px (right first)',
      (await panelDisplayed('left')) === false && (await panelDisplayed('right')) === true,
    );

    await resizeTo(1300);
    report(
      'both restored at 1300px',
      (await panelDisplayed('left')) === true && (await panelDisplayed('right')) === true,
    );

    await dragPanel('right', 160);
    report('left auto-hidden after expanding right', (await panelDisplayed('left')) === false);
    report('right still visible', (await panelDisplayed('right')) === true);

    await dragPanel('right', -160);
    report('left reverted after shrinking right back', (await panelDisplayed('left')) === true);
    report('right still visible', (await panelDisplayed('right')) === true);

    await dragPanel('right', 160);
    report('left auto-hidden again (new trigger)', (await panelDisplayed('left')) === false);

    await page.locator('.sf-menu-action-btn').first().click();
    await page.waitForTimeout(100);
    report('left group collapsed by toggle while auto-hidden', (await leftGroupDisplayed()) === false);

    await page.locator('.sf-menu-action-btn').first().click();
    await page.waitForTimeout(100);
    report('left re-opened by user (stays open)', (await panelDisplayed('left')) === true);

    await dragPanel('right', -80);
    report('left still visible after shrinking (user override)', (await panelDisplayed('left')) === true);

    await dragPanel('right', 160);
    report('left auto-hidden after new expansion', (await panelDisplayed('left')) === false);

    await page.locator('.sf-menu-action-btn').first().click();
    await page.waitForTimeout(100);
    await page.locator('.sf-menu-action-btn').first().click();
    await page.waitForTimeout(100);
    await page.locator('.sf-menu-action-btn').first().click();
    await page.waitForTimeout(100);
    report('left user-collapsed', (await panelDisplayed('left')) === false);

    await dragPanel('right', -240);
    report('left still hidden after revert (user-collapsed)', (await panelDisplayed('left')) === false);
    report('right still visible', (await panelDisplayed('right')) === true);

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(300);

    await resizeTo(1300);
    await page.locator('.sf-menu-action-btn').first().click();
    await page.waitForTimeout(100);
    report('left group reopened after reload', (await panelDisplayed('left')) === true);
    await page.locator('.sf-tab-panel-toggle').click();
    await page.waitForTimeout(100);
    report('right collapsed by user', (await panelDisplayed('right')) === false);

    await resizeTo(1000);
    report('left still visible (workspace ok with 1 panel)', (await panelDisplayed('left')) === true);

    await resizeTo(900);
    report(
      'left auto-hidden at 900px (too narrow even with 1 panel)',
      (await panelDisplayed('left')) === false,
    );

    await resizeTo(700);
    report('both auto-hidden at 700px', (await panelDisplayed('left')) === false);
    await page.locator('.sf-docker-app[title="Explorer"]').click();
    await page.waitForTimeout(100);
    report('docker click re-opens left (override)', (await panelDisplayed('left')) === true);
    await page.setViewportSize({ width: 700, height: 1100 });
    await page.waitForTimeout(100);
    report('override survives height-only resize', (await panelDisplayed('left')) === true);
    await page.setViewportSize({ width: 760, height: 1100 });
    await page.waitForTimeout(100);
    report('override survives widening while still narrow', (await panelDisplayed('left')) === true);
    await resizeTo(590);
    report('genuine shrink re-enforces the guard', (await panelDisplayed('left')) === false);
    await resizeTo(1300);
    report('wide restores both', (await panelDisplayed('left')) === true);

    report('no console/page errors', errors.length === 0, errors.join('; '));
  } catch (e) {
    await page.screenshot({ path: 'scripts/artifacts/autohide-fail.png' });
    console.error(e);
  }

  await finish(browser, serverProc, isFailed(), 'AUTO-HIDE CHECKS');
})();
