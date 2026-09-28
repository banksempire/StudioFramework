const { chromium } = require('playwright');
const { ensureServer, makeReporter, finish } = require('./lib/ui-test.cjs');

(async () => {
  const serverProc = await ensureServer();
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1300, height: 900 } });
  await context.addInitScript(() => {
    if (!sessionStorage.getItem('bulk-list-cleared')) {
      sessionStorage.setItem('bulk-list-cleared', '1');
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

  const demo = page.locator('.bulk-list-demo');
  await demo.scrollIntoViewIfNeeded();
  const status = () => demo.locator('.bulk-list-demo-status').textContent();
  const row = (label) => demo.locator('.sf-sm-row', { hasText: label }).first();
  const editBtn = demo.locator('.sf-pl-bulkbar-btn', { hasText: 'Edit' });
  const barBtn = (label) => demo.locator('.sf-pl-bulkbar-btn', { hasText: label });
  const checks = () => demo.locator('.sf-pl-check');
  const checkOn = (label) =>
    demo
      .locator('.sf-sm-row', { hasText: label })
      .first()
      .locator('.sf-pl-check--on')
      .count()
      .then((n) => n === 1);

  report(
    'edit button shows while bulk mode is off',
    (await editBtn.count()) === 1 && (await checks().count()) === 0,
  );

  await editBtn.click();
  await page.waitForTimeout(150);
  report(
    'entering bulk mode swaps Edit for Pin/Delete/Done',
    (await editBtn.count()) === 0 && (await barBtn('Done').count()) === 1,
  );
  report('every row shows a selection circle', (await checks().count()) === 5);

  await row('alpha.log').click();
  await page.waitForTimeout(120);
  report(
    'click selects a row and arms the bulk buttons',
    (await checkOn('alpha.log')) &&
      (await status()).startsWith('toggle 1') &&
      (await barBtn('Pin (1)').count()) === 1,
  );

  await row('charlie.txt').click({ modifiers: ['Shift'] });
  await page.waitForTimeout(120);
  report(
    'shift+click selects the whole range alpha..charlie',
    (await checkOn('alpha.log')) &&
      (await checkOn('bravo.csv')) &&
      (await checkOn('charlie.txt')) &&
      !(await checkOn('delta.json')),
  );

  await row('bravo.csv').click();
  await page.waitForTimeout(120);
  report(
    'plain click inside range unselects just that row',
    !(await checkOn('bravo.csv')) && (await checkOn('alpha.log')) && (await barBtn('Pin (2)').count()) === 1,
  );

  await barBtn('Pin (2)').click();
  await page.waitForTimeout(120);
  report(
    'bulk pin marks the selected rows pinned',
    (await status()).startsWith('pin alpha,charlie') &&
      (await demo.locator('.sf-sm-row', { hasText: 'pinned' }).count()) === 2,
  );

  const grip = demo.locator('.sf-sm-row', { hasText: 'echo.ndjson' }).first().locator('.sf-pl-grip');
  report('bulk rows show a drag grip', (await grip.count()) === 1);

  await grip.dragTo(row('alpha.log'));
  await page.waitForTimeout(200);
  report(
    'dragging the grip reorders the row',
    (await status()).startsWith('reorder echo->alpha') &&
      (await demo.locator('.sf-sm-row').first().textContent()).includes('echo.ndjson'),
  );

  await row('delta.json').click();
  await page.waitForTimeout(120);
  await barBtn('Delete (3)').click();
  await page.waitForTimeout(150);
  report(
    'bulk delete removes the selected rows',
    (await row('charlie.txt').count()) === 0 && (await status()).startsWith('delete alpha,charlie,delta'),
  );

  await barBtn('Done').click();
  await page.waitForTimeout(150);
  report(
    'done exits bulk mode and clears circles',
    (await editBtn.count()) === 1 && (await checks().count()) === 0,
  );

  report('no page errors during the run', errors.length === 0, errors.join(' | '));
  await finish(browser, serverProc, isFailed() || errors.length > 0, 'BULK-LIST CHECKS');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
