const { chromium } = require('playwright');
const { ensureServer, makeReporter, finish } = require('./lib/ui-test.cjs');

(async () => {
  const serverProc = await ensureServer();
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    if (!sessionStorage.getItem('corner-check-cleared')) {
      sessionStorage.setItem('corner-check-cleared', '1');
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

  for (const side of ['left', 'right']) {
    const panel = page.locator(`.sf-panel--${side}`);
    report(`${side} panel visible`, await panel.isVisible());
    const expect = await panel.evaluate((el) => {
      const cs = getComputedStyle(el);
      const inner = (corner, v, h) => {
        const r = parseFloat(cs[`border${corner}Radius`]) || 0;
        const bw = Math.max(parseFloat(cs[`border${v}Width`]) || 0, parseFloat(cs[`border${h}Width`]) || 0);
        return Math.max(0, r - bw);
      };
      return { tr: inner('TopRight', 'Top', 'Right'), br: inner('BottomRight', 'Bottom', 'Right') };
    });
    const headerRadius = await panel
      .locator('.sf-panel-header')
      .evaluate((el) => getComputedStyle(el).borderRadius);
    report(
      `${side} panel header hugs the frame at the top-right corner`,
      headerRadius === `0px ${expect.tr}px 0px 0px`,
      `${headerRadius} vs inner ${expect.tr}px`,
    );
    const bottomFill = panel.locator('.sf-subsection-body-container');
    const useEmpty = (await bottomFill.count()) === 0;
    const fillEl = useEmpty ? panel.locator('.sf-panel-empty') : bottomFill;
    const brRadius = await fillEl.first().evaluate((el) => getComputedStyle(el).borderRadius);
    report(
      `${side} panel ${useEmpty ? 'empty fill' : 'body'} hugs the frame at the bottom-right corner`,
      brRadius === `0px 0px ${expect.br}px` || brRadius === `0px 0px ${expect.br}px 0px`,
      `${brRadius} vs inner ${expect.br}px`,
    );
  }

  const mbOverflow = await page.evaluate(() => {
    const el = document.querySelector('.sf-menu-bar');
    const cs = getComputedStyle(el);
    return `${cs.overflowX}/${cs.overflowY}`;
  });
  report('menu bar clips children to its rounded frame', mbOverflow === 'hidden/hidden', mbOverflow);

  report('no page errors during the whole check', errors.length === 0, errors.join('; ').slice(0, 300));

  await finish(browser, serverProc, isFailed(), 'CORNER CHECKS');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
