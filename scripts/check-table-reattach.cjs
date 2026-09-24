const { chromium } = require('playwright');
const { ensureServer, makeReporter, finish } = require('./lib/ui-test.cjs');

(async () => {
  const serverProc = await ensureServer();
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    if (!sessionStorage.getItem('tbl-reattach-check-cleared')) {
      sessionStorage.setItem('tbl-reattach-check-cleared', '1');
      localStorage.clear();
    }
  });
  await context.addInitScript(() => {
    const origOffset = Object.getOwnPropertyDescriptor(Element.prototype, 'offsetWidth');
    const origClient = Object.getOwnPropertyDescriptor(Element.prototype, 'clientWidth');
    window.__layoutReads = 0;
    Object.defineProperty(Element.prototype, 'offsetWidth', {
      get() {
        if (window.__watchTbl && this === window.__watchTbl) window.__layoutReads += 1;
        return origOffset.get.call(this);
      },
    });
    Object.defineProperty(Element.prototype, 'clientWidth', {
      get() {
        const watch = window.__watchTbl;
        if (watch?.parentElement && this === watch.parentElement) window.__layoutReads += 1;
        return origClient.get.call(this);
      },
    });
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
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    const table = document.querySelector('.sf-tile-custom .sf-tbl');
    const wrap = document.querySelector('.sf-tile-custom .sf-tbl-wrap');
    window.__tblNode = table;
    window.__watchTbl = table;
    window.__styleWrites = 0;
    window.__maxContentWrites = 0;
    const matcher = (el) =>
      el === wrap || el === table || (el instanceof Element && el.closest('.sf-tbl-wrap') === wrap);
    window.__tblMo = new MutationObserver((records) => {
      for (const r of records) {
        if (r.attributeName !== 'style' || !matcher(r.target)) continue;
        window.__styleWrites += 1;
        if ((r.target.getAttribute('style') ?? '').includes('max-content')) window.__maxContentWrites += 1;
      }
    });
    window.__tblMo.observe(wrap, { subtree: true, attributes: true, attributeOldValue: true });
  });

  await tabByLabel('framework.ts').click();
  await page.waitForTimeout(300);
  await tabByLabel('Table').click();
  await page.waitForTimeout(500);

  const afterSwitch = await page.evaluate(() => ({
    sameNode: document.querySelector('.sf-tile-custom .sf-tbl') === window.__tblNode,
    connected: window.__tblNode.isConnected,
    styleWrites: window.__styleWrites,
    maxContentWrites: window.__maxContentWrites,
    layoutReads: window.__layoutReads,
  }));
  report(
    `tab re-attach keeps the same live table node — same:${afterSwitch.sameNode} connected:${afterSwitch.connected}`,
    afterSwitch.sameNode && afterSwitch.connected,
  );
  report(
    `re-attach at unchanged width performs no column-width work — styleWrites:${afterSwitch.styleWrites} maxContent:${afterSwitch.maxContentWrites} layoutReads:${afterSwitch.layoutReads}`,
    afterSwitch.styleWrites === 0 && afterSwitch.maxContentWrites === 0 && afterSwitch.layoutReads === 0,
  );

  await page.evaluate(() => {
    window.__styleWrites = 0;
    window.__maxContentWrites = 0;
    window.__layoutReads = 0;
  });
  await page.evaluate(() => {
    document.querySelector('.sf-tile-custom').style.width = '420px';
  });
  await page.waitForTimeout(600);
  const afterResize = await page.evaluate(() => ({
    styleWrites: window.__styleWrites,
    layoutReads: window.__layoutReads,
    width: window.__tblNode.getBoundingClientRect().width,
  }));
  report(
    `a real width change still re-runs column-width work — styleWrites:${afterResize.styleWrites} layoutReads:${afterResize.layoutReads}`,
    afterResize.styleWrites > 0 && afterResize.layoutReads > 0,
  );
  report(`no page errors — ${errors.join(' | ') || 'clean'}`, errors.length === 0);

  await finish(browser, serverProc, isFailed(), 'TABLE-REATTACH');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
