const { ensureServer, openApp, makeReporter } = require('./lib/ui-test.cjs');

let serverProc = null;
let browser = null;

(async () => {
  serverProc = await ensureServer();
  const opened = await openApp();
  browser = opened.browser;
  const { page, errors } = opened;
  const { report, isFailed } = makeReporter();
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

  const rows = page.locator('.kv-row');
  const rowCount = await rows.count();
  report('keyValueList rows render in the demo app', rowCount >= 2, `${rowCount} rows`);

  const rowText = (i) =>
    rows.nth(i).evaluate((el) => `${el.dataset.key}: ${el.querySelector('.kv-value')?.textContent ?? ''}`);

  await page.evaluate(() => {
    window.__clipWrites = [];
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: (t) => {
          window.__clipWrites.push(t);
          return Promise.resolve();
        },
      },
      configurable: true,
    });
  });
  const first = await rowText(0);
  await rows.nth(0).click();
  await page.waitForFunction(() => (window.__clipWrites ?? []).length === 1);
  report(
    'click-to-copy uses the async clipboard in secure contexts',
    (await page.evaluate(() => window.__clipWrites[0])) === first,
    JSON.stringify(await page.evaluate(() => window.__clipWrites[0])),
  );
  report(
    'copied row flashes the copied state',
    await page.evaluate(() => !!document.querySelector('.kv-row--copied')),
  );

  await page
    .waitForFunction(() => !document.querySelector('.kv-row--copied'), null, { timeout: 5000 })
    .catch(() => {});
  report('copied state clears again', await page.evaluate(() => !document.querySelector('.kv-row--copied')));

  await page.evaluate(() => {
    window.__execCopies = [];
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    document.execCommand = (cmd) => {
      window.__execCopies.push([cmd, document.getSelection()?.toString() ?? '']);
      return true;
    };
  });
  const second = await rowText(1);
  await rows.nth(1).click();
  await page.waitForFunction(() => (window.__execCopies ?? []).length === 1);
  report(
    'without navigator.clipboard the execCommand fallback runs',
    (await page.evaluate(() => window.__execCopies[0]))?.[0] === 'copy',
    JSON.stringify(await page.evaluate(() => window.__execCopies[0])),
  );
  report(
    'fallback copy carries the row text',
    (await page.evaluate(() => window.__execCopies[0]))?.[1] === second,
    JSON.stringify(await page.evaluate(() => window.__execCopies[0])),
  );
  report(
    'fallback copy flashes the copied state',
    await page.evaluate(() => !!document.querySelector('.kv-row--copied')),
  );
  report('fallback copy produced no page errors', errors.length === 0, errors.join(' | '));

  process.exitCode = isFailed() ? 1 : 0;
  console.log(process.exitCode ? '\nCHECKS FAILED' : '\nALL CHECKS PASSED');
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) {
      try {
        await browser.close();
      } catch {}
    }
    if (serverProc?.pid) {
      try {
        process.kill(-serverProc.pid, 'SIGTERM');
      } catch {}
    }
    process.exit(process.exitCode ?? 0);
  });
