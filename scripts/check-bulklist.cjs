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

  const demo = page.locator('.sf-subsection', { has: page.locator('[data-sub-body="bulk"]') }).first();
  await demo.scrollIntoViewIfNeeded();
  const row = (label) => demo.locator('.sf-sm-row', { hasText: label }).first();
  const editBtn = demo.locator('.sf-subsection-header .sf-subsection-util[title="Edit"]');
  const doneBtn = demo.locator('.sf-subsection-header .sf-subsection-util[title="Done"]');
  const barBtn = (label) => demo.locator(`.sf-subsection-header .sf-subsection-util[title="${label}"]`);
  const bulkBar = demo.locator('.sf-pl-bulkbar');
  const checks = () => demo.locator('.sf-pl-check');
  const searchInput = demo.locator('.sf-pl-search-input');
  await searchInput.fill('xray');
  await page.waitForTimeout(200);
  report(
    'list search matches hidden search text',
    (await demo.locator('.sf-sm-row').count()) === 1 &&
      (await demo.locator('.sf-sm-row').first().textContent()).includes('charlie.txt'),
  );
  await searchInput.fill('bravo');
  await page.waitForTimeout(200);
  report(
    'list search matches visible labels',
    (await demo.locator('.sf-sm-row').count()) === 1 &&
      (await demo.locator('.sf-sm-row').first().textContent()).includes('bravo.csv'),
  );
  await searchInput.fill('zzz');
  await page.waitForTimeout(200);
  report(
    'list search shows No match when nothing matches',
    (await demo.locator('.sf-empty').count()) === 1 && (await demo.locator('.sf-sm-row').count()) === 0,
  );
  await searchInput.fill('');
  await page.waitForTimeout(200);
  report('clearing list search restores all rows', (await demo.locator('.sf-sm-row').count()) === 5);
  const checkOn = (label) =>
    demo
      .locator('.sf-sm-row', { hasText: label })
      .first()
      .locator('.sf-pl-check--on')
      .count()
      .then((n) => n === 1);

  report(
    'edit button sits in the title bar while bulk mode is off',
    (await editBtn.count()) === 1 &&
      (await editBtn.evaluate((el) => el.closest('.sf-subsection-header') !== null)) &&
      (await checks().count()) === 0,
  );

  await editBtn.click();
  await page.waitForTimeout(150);
  report(
    'entering bulk mode swaps Edit for a header tick with Pin/Delete beside it',
    (await editBtn.count()) === 0 &&
      (await doneBtn.count()) === 1 &&
      (await barBtn('Pin').count()) === 1 &&
      (await barBtn('Delete').count()) === 1 &&
      (await barBtn('Pin').isDisabled()) &&
      (await barBtn('Delete').isDisabled()) &&
      (await bulkBar.count()) === 0,
  );
  report('every row shows a selection circle', (await checks().count()) === 5);

  await row('alpha.log').click();
  await page.waitForTimeout(120);
  report(
    'click selects a row and arms the bulk buttons',
    (await checkOn('alpha.log')) &&
      (await barBtn('Pin').count()) === 1 &&
      !(await barBtn('Pin').isDisabled()),
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
    !(await checkOn('bravo.csv')) && (await checkOn('alpha.log')),
  );

  await barBtn('Pin').click();
  await page.waitForTimeout(120);
  report(
    'bulk pin marks the selected rows pinned',
    (await demo.locator('.sf-sm-row', { hasText: 'pinned' }).count()) === 2,
  );

  const grip = demo.locator('.sf-sm-row', { hasText: 'echo.ndjson' }).first().locator('.sf-pl-grip');
  report('bulk rows show a drag grip', (await grip.count()) === 1);

  const centered = await demo.evaluate((el) => {
    const r = [...el.querySelectorAll('.sf-pl-item--bulk')].find((x) => x.textContent.includes('pinned'));
    if (!r) return null;
    const row = r.getBoundingClientRect();
    const mid = (n) => (n.getBoundingClientRect().top + n.getBoundingClientRect().bottom) / 2 - row.top;
    return {
      rowH: row.height,
      check: mid(r.querySelector('.sf-pl-check')),
      grip: mid(r.querySelector('.sf-pl-grip')),
    };
  });
  report(
    'bulk circle and grip sit at the vertical middle of the row',
    centered !== null &&
      Math.abs(centered.check - centered.rowH / 2) < 2 &&
      Math.abs(centered.grip - centered.rowH / 2) < 2,
  );

  await grip.dragTo(row('alpha.log'));
  await page.waitForTimeout(200);
  report(
    'dragging the grip reorders the row',
    (await demo.locator('.sf-sm-row').first().textContent()).includes('echo.ndjson'),
  );

  await row('delta.json').click();
  await page.waitForTimeout(120);
  await barBtn('Delete').click();
  await page.waitForTimeout(150);
  report('bulk delete removes the selected rows', (await row('charlie.txt').count()) === 0);

  await doneBtn.click();
  await page.waitForTimeout(150);
  report(
    'done exits bulk mode and clears circles',
    (await editBtn.count()) === 1 && (await checks().count()) === 0,
  );

  const fields = page.locator('.sf-subsection', { has: page.locator('[data-sub-body="fields"]') }).first();
  await fields.scrollIntoViewIfNeeded();
  const fieldRow = (label) => fields.locator('.sf-pl-item', { hasText: label }).first();
  const rowByLabel = (label) => fields.locator('.sf-sm-row', { hasText: label }).first();
  report(
    'desktop hides mobile-only buttons and keeps delete',
    (await fields.locator('.sf-pl-btn', { hasText: 'Options' }).count()) === 0 &&
      (await fields.locator('.sf-pl-btn', { hasText: 'Delete' }).count()) === 2,
  );
  report(
    'row buttons pack into one group per row',
    (await fields.locator('.sf-pl-btn-group').count()) === 2 &&
      (await fields.locator('.sf-pl-btn-group').first().locator('.sf-pl-btn').count()) === 1,
  );
  report(
    'content area hosts extra lines with meta',
    (await fields.locator('.sf-pl-line').count()) === 2 &&
      (await fields.locator('.sf-pl-line', { hasText: 'visible on the table' }).count()) === 2 &&
      (await fields.locator('.sf-pl-line-meta', { hasText: 'tick' }).count()) === 1,
  );
  await rowByLabel('Tick').click({ button: 'right' });
  await page.waitForTimeout(200);
  const hideOpt = page.locator('.sf-sm-menu .sf-sm-menu-row', { hasText: 'Hide' }).first();
  report('right-click opens the row menu on desktop', await hideOpt.isVisible());
  await hideOpt.click();
  await page.waitForTimeout(200);
  report(
    'hide option mutes the row and its line',
    (await fieldRow('Tick').getAttribute('class'))?.includes('sf-pl-item--muted') === true &&
      (await fields.locator('.sf-pl-line', { hasText: 'hidden on the table' }).count()) === 1,
  );
  await rowByLabel('Tick').click({ button: 'right' });
  await page.waitForTimeout(200);
  await page.locator('.sf-sm-menu .sf-sm-menu-row', { hasText: 'Show' }).first().click();
  await page.waitForTimeout(200);
  report(
    'show option restores the row',
    (await fieldRow('Tick').getAttribute('class'))?.includes('sf-pl-item--muted') === false,
  );
  await fieldRow('Tick').locator('.sf-pl-btn', { hasText: 'Delete' }).click();
  await page.waitForTimeout(200);
  report('delete button removes the row', (await rowByLabel('Tick').count()) === 0);
  await fields.locator('.sf-pl-footer-btn', { hasText: 'Add' }).click();
  await page.waitForTimeout(200);
  report('footer add appends a new row', (await fields.locator('.sf-pl-item').count()) === 2);
  await fieldRow('Book').locator('.sf-pl-btn', { hasText: 'Delete' }).click();
  await page.waitForTimeout(150);
  await fields
    .locator('.sf-pl-item', { hasText: 'Field 1' })
    .locator('.sf-pl-btn', { hasText: 'Delete' })
    .click();
  await page.waitForTimeout(200);
  report('empty list shows the footer hint', (await fields.locator('.sf-empty').count()) === 1);
  report(
    'grips stay hidden unless the list opts in to dragging',
    (await fields.locator('.sf-pl-grip').count()) === 0,
  );

  const mobileCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const mpage = await mobileCtx.newPage();
  await mpage.goto(`http://localhost:${process.env.SF_TEST_PORT || '7493'}/`, {
    waitUntil: 'networkidle',
    timeout: 15000,
  });
  await mpage.waitForFunction(() => (document.getElementById('framework')?.innerHTML.length ?? 0) > 1000, {
    timeout: 10000,
  });
  await mpage.locator('.sf-docker-app[title="Fields"]').tap();
  await mpage.locator('.sf-mobile-panel').waitFor({ state: 'visible', timeout: 5000 });
  const mfields = mpage.locator('.sf-mobile-panel .sf-pl-item');
  await mfields.first().waitFor({ state: 'visible', timeout: 5000 });
  report(
    'mobile shows mobile-only option buttons',
    (await mfields.locator('.sf-pl-btn', { hasText: 'Options' }).count()) === 2 &&
      (await mfields.locator('.sf-pl-btn', { hasText: 'Delete' }).count()) === 2,
  );
  await mfields.locator('.sf-pl-btn', { hasText: 'Options' }).first().tap();
  await page.waitForTimeout(200);
  const mobileMenu = mpage.locator('.sf-sm-menu .sf-sm-menu-row', { hasText: 'Hide' }).first();
  report('mobile options button opens the row menu', await mobileMenu.isVisible());
  await mobileMenu.click();
  await page.waitForTimeout(200);
  report(
    'mobile hide option mutes the row',
    (await mfields.first().getAttribute('class'))?.includes('sf-pl-item--muted') === true,
  );
  await mobileCtx.close();

  report('no page errors during the run', errors.length === 0, errors.join(' | '));
  await finish(browser, serverProc, isFailed() || errors.length > 0, 'BULK-LIST CHECKS');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
