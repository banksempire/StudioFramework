const { chromium } = require('playwright');
const { ensureServer, makeReporter, finish } = require('./lib/ui-test.cjs');

(async () => {
  const serverProc = await ensureServer();
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    if (!sessionStorage.getItem('tabfit-check-cleared')) {
      sessionStorage.setItem('tabfit-check-cleared', '1');
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

  const tabCount = () => page.locator('.sf-tab').count();
  const basisVar = () =>
    page.evaluate(() => {
      const el = document.querySelector('.sf-tile-tabs-inner');
      return el ? el.style.getPropertyValue('--sf-tab-basis') : '';
    });
  const tabOverflowsBar = () =>
    page.evaluate(() => {
      const bar = document.querySelector('.sf-tile-tabs-inner');
      if (!bar) return true;
      const br = bar.getBoundingClientRect();
      return Array.from(document.querySelectorAll('.sf-tab')).some((t) => {
        const r = t.getBoundingClientRect();
        return r.right > br.right + 1 || r.left < br.left - 1;
      });
    });
  const closeHidden = () =>
    page.evaluate(() => {
      const el = document.querySelector('.sf-tab-close');
      return el ? getComputedStyle(el).display === 'none' : false;
    });
  const labelHidden = () =>
    page.evaluate(() => {
      const el = document.querySelector('.sf-tab-label');
      return el ? getComputedStyle(el).display === 'none' : false;
    });
  const tileId = () =>
    page.evaluate(() => {
      const api = window.__sfWorkspace;
      const walk = (node) => (node.kind === 'tile' ? node.id : walk(node.children[0]));
      return walk(api.roots[0].node);
    });

  report('baseline: 4 tabs, no squeeze', (await tabCount()) === 4 && (await basisVar()) === '');
  report(
    'baseline: active tab close button visible',
    await page.evaluate(() => {
      const el = document.querySelector('.sf-tab.active .sf-tab-close');
      return el ? getComputedStyle(el).visibility === 'visible' : false;
    }),
  );

  const tid = await tileId();
  await page.evaluate((id) => {
    const api = window.__sfWorkspace;
    for (let i = 0; i < 24; i++) {
      api.ops.openTab(id, {
        id: `bulk-${i}`,
        label: `bulk-file-${i}-with-a-rather-long-name-that-refuses-to-shrink.ts`,
        icon: '📄',
      });
    }
  }, tid);
  await page.waitForFunction(
    () => {
      const el = document.querySelector('.sf-tile-tabs-inner');
      return el && el.style.getPropertyValue('--sf-tab-basis') !== '';
    },
    null,
    { timeout: 5000 },
  );
  await page.waitForTimeout(100);

  report(
    '28 tabs all kept inside the selection bar',
    (await tabCount()) === 28 && !(await tabOverflowsBar()),
  );
  report(
    'tabs shrink below the max width',
    await page.evaluate(() => {
      const widths = Array.from(document.querySelectorAll('.sf-tab')).map(
        (t) => t.getBoundingClientRect().width,
      );
      return widths.length > 0 && Math.max(...widths) < 200;
    }),
  );
  report(
    'overcrowded tabs get even widths',
    await page.evaluate(() => {
      const widths = Array.from(document.querySelectorAll('.sf-tab')).map((t) =>
        Math.round(t.getBoundingClientRect().width),
      );
      return widths.length > 0 && Math.max(...widths) - Math.min(...widths) <= 1;
    }),
  );
  report(
    'icon mode when very crowded',
    (await page.locator(".sf-tile-tabs-inner[data-tabfit='icon']").count()) === 1 &&
      (await closeHidden()) &&
      (await labelHidden()) &&
      parseFloat(await basisVar()) < 64,
  );

  await page.setViewportSize({ width: 3200, height: 900 });
  await page.waitForTimeout(400);
  report(
    'widening the window eases the squeeze, still no overflow',
    !(await tabOverflowsBar()) &&
      (await basisVar()) !== '' &&
      (await page.locator(".sf-tile-tabs-inner[data-tabfit='compact']").count()) === 1 &&
      (await labelHidden()) === false,
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(400);
  report(
    'narrowing again re-tightens to icon mode',
    !(await tabOverflowsBar()) &&
      (await page.locator(".sf-tile-tabs-inner[data-tabfit='icon']").count()) === 1 &&
      parseFloat(await basisVar()) < 64,
  );

  await page.evaluate(() => {
    const api = window.__sfWorkspace;
    for (let i = 0; i < 16; i++) api.ops.closeTab(`bulk-${i}`);
  });
  await page.waitForTimeout(300);
  report(
    'compact mode at 12 tabs: labels kept, close hidden',
    (await tabCount()) === 12 &&
      (await page.locator(".sf-tile-tabs-inner[data-tabfit='compact']").count()) === 1 &&
      (await page.locator(".sf-tile-tabs-inner[data-tabfit='icon']").count()) === 0 &&
      (await labelHidden()) === false &&
      (await closeHidden()) &&
      !(await tabOverflowsBar()),
  );

  await page.evaluate(() => {
    const api = window.__sfWorkspace;
    for (let i = 16; i < 24; i++) api.ops.closeTab(`bulk-${i}`);
  });
  await page.waitForTimeout(300);
  report(
    'back to 4 tabs: squeeze released, close button returns',
    (await tabCount()) === 4 &&
      (await basisVar()) === '' &&
      (await page
        .locator(".sf-tile-tabs-inner[data-tabfit='compact'], .sf-tile-tabs-inner[data-tabfit='icon']")
        .count()) === 0 &&
      (await page.evaluate(() => {
        const el = document.querySelector('.sf-tab.active .sf-tab-close');
        return el ? getComputedStyle(el).visibility === 'visible' : false;
      })),
  );

  report('no page errors during the whole check', errors.length === 0, errors.join('; ').slice(0, 300));

  await finish(browser, serverProc, isFailed(), 'TABFIT CHECKS');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
