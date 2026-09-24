const { chromium } = require('playwright');
const { ensureServer, makeReporter, finish } = require('./lib/ui-test.cjs');

(async () => {
  const serverProc = await ensureServer();
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    if (!sessionStorage.getItem('keepalive-check-cleared')) {
      sessionStorage.setItem('keepalive-check-cleared', '1');
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

  const tabByLabel = (label) => page.locator('.sf-tab', { hasText: label }).first();

  await tabByLabel('Table').click();
  await page.waitForSelector('.sf-tile-custom .sf-tbl-row', { timeout: 5000 });

  await page.locator('.sf-tile-custom .sf-tbl-hbtn', { hasText: 'Size KB' }).first().click();
  await page.waitForSelector('.sf-tile-custom .sf-tbl-sortind', { timeout: 5000 });

  await page.locator('.sf-tile-custom .sf-tbl-hbtn', { hasText: 'Name' }).first().click();
  await page.waitForSelector('.sf-tile-custom .sf-tbl-pop-input', { timeout: 5000 });
  await page.locator('.sf-tile-custom .sf-tbl-pop-input').first().fill('ar');
  await page.waitForTimeout(300);
  const stateBefore = await page.evaluate(() => {
    const table = document.querySelector('.sf-tile-custom .sf-tbl');
    window.__kaNode = table;
    const rows = table.querySelectorAll('.sf-tbl-row');
    return {
      node: table,
      rows: rows.length,
      first: rows[0]?.textContent ?? '',
      sorted: table.querySelector('.sf-tbl-sortind') !== null,
    };
  });

  await tabByLabel('framework.ts').click();
  await page.waitForTimeout(300);
  await tabByLabel('Table').click();
  await page.waitForTimeout(300);

  const after = await page.evaluate(() => {
    const cur = document.querySelector('.sf-tile-custom .sf-tbl');
    const rows = cur ? cur.querySelectorAll('.sf-tbl-row') : [];
    return {
      connected: window.__kaNode instanceof Element && window.__kaNode.isConnected,
      sameNode: cur !== null && cur === window.__kaNode,
      rows: rows.length,
      first: rows[0]?.textContent ?? '',
      sorted: cur ? cur.querySelector('.sf-tbl-sortind') !== null : false,
    };
  });

  report(
    'tab content survives switching without remount',
    after.connected === true && after.sameNode === true,
    `connected:${after.connected} sameNode:${after.sameNode}`,
  );
  report(
    `filtered rows are preserved (${after.rows} rows)`,
    stateBefore.rows > 0 && after.rows === stateBefore.rows,
    `expected ${stateBefore.rows}, saw ${after.rows}`,
  );
  report(
    'filter query is preserved',
    after.first === stateBefore.first,
    `expected first row "${stateBefore.first}", saw "${after.first}"`,
  );
  report('sort state is preserved', after.sorted === true);
  report(
    'sorted order did not change across switches',
    after.first === stateBefore.first && stateBefore.first.length > 0,
  );

  report('no page errors during the whole check', errors.length === 0, errors.join('; ').slice(0, 300));

  await finish(browser, serverProc, isFailed(), 'KEEPALIVE CHECKS');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
