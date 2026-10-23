const { chromium } = require('playwright');
const { ensureServer, makeReporter, finish } = require('./lib/ui-test.cjs');

const URL = `http://localhost:${process.env.SF_TEST_PORT || '7493'}/`;

(async () => {
  const serverProc = await ensureServer();
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const { report, isFailed } = makeReporter();

  const plain = await context.newPage();
  await plain.goto(URL, { waitUntil: 'networkidle', timeout: 15000 });
  report(
    'debug button hidden without ?debug',
    (await plain.locator('.sf-status-bar .sf-debug-toggle').count()) === 0,
  );
  await plain.close();

  const page = await context.newPage();
  await page.goto(`${URL}?debug`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForFunction(() => (document.getElementById('framework')?.innerHTML.length ?? 0) > 1000, {
    timeout: 10000,
  });

  const toggle = page.locator('.sf-status-bar .sf-debug-toggle');
  report('debug button shown on the status bar under ?debug', await toggle.isVisible());

  await toggle.click();
  report('log window opens on click', await page.locator('.sf-debug-pop').isVisible());
  report('capture installs with a boot entry', (await page.locator('.sf-debug-row').count()) >= 1);

  await page.evaluate(() => {
    console.debug('dbg-entry', { a: 1 });
    console.log('info-entry');
    console.warn('warn-entry');
    console.error('err-entry');
  });
  await page.waitForFunction(() => document.querySelectorAll('.sf-debug-row').length >= 5, { timeout: 5000 });
  const dbgMsg = await page.locator('.sf-debug-row--debug .sf-debug-row-msg').first().textContent();
  report(
    'console entries captured with args serialized',
    dbgMsg === 'dbg-entry {"a":1}',
    `got ${JSON.stringify(dbgMsg)}`,
  );

  await page.evaluate(() =>
    setTimeout(() => {
      throw new Error('uncaught boom');
    }, 0),
  );
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('.sf-debug-row-msg')].some((n) =>
        n.textContent?.includes('uncaught boom'),
      ),
    { timeout: 5000 },
  );
  report('uncaught errors captured', true);

  await page.evaluate(() => setTimeout(() => Promise.reject(new Error('rejected boom')), 0));
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('.sf-debug-row-msg')].some((n) =>
        n.textContent?.includes('rejected boom'),
      ),
    { timeout: 5000 },
  );
  report('unhandled rejections captured', true);

  await page.locator('.sf-debug-filter').selectOption('error');
  const errRows = await page.locator('.sf-debug-row').count();
  report('filter screens by level (error only)', errRows === 3, `${errRows} rows, want 3`);
  const copyText = await page.locator('.sf-debug-btn', { hasText: 'Copy' }).textContent();
  report('copy button label ready', copyText === 'Copy', `got ${JSON.stringify(copyText)}`);

  await page.locator('.sf-debug-btn', { hasText: 'Copy' }).click();
  await page.waitForFunction(() => document.querySelector('.sf-debug-btn')?.textContent?.includes('Copied'), {
    timeout: 5000,
  });
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  report(
    'copy puts filtered logs on the clipboard',
    clip.includes('[ERROR] err-entry') && clip.includes('uncaught boom') && !clip.includes('info-entry'),
    JSON.stringify(clip.slice(0, 100)),
  );

  await page.locator('.sf-debug-filter').selectOption('all');
  const allRows = await page.locator('.sf-debug-row').count();
  report('filter back to all restores entries', allRows >= 6, `${allRows} rows`);

  await page.locator('.sf-debug-btn', { hasText: 'Clear' }).click();
  report('clear empties the log', (await page.locator('.sf-debug-row').count()) === 0);

  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.sf-debug-pop'), { timeout: 5000 });
  report('escape closes the window', true);

  await page.evaluate(() => console.error('post-close-entry'));
  await page.waitForFunction(() => document.querySelector('.sf-debug-toggle-badge')?.textContent === '1', {
    timeout: 5000,
  });
  report('closed window keeps collecting, badge counts errors', true);

  await finish(browser, serverProc, isFailed(), 'DEBUG');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
