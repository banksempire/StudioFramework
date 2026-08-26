const { chromium } = require('playwright');
const { ensureServer, makeReporter, finish } = require('./lib/ui-test.cjs');

(async () => {
  const serverProc = await ensureServer();
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    if (!sessionStorage.getItem('seam-check-cleared')) {
      sessionStorage.setItem('seam-check-cleared', '1');
      localStorage.clear();
    }
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  await page.goto(`http://localhost:${process.env.SF_TEST_PORT || '7493'}/`, {
    waitUntil: 'networkidle',
    timeout: 15000,
  });
  await page.waitForFunction(() => (document.getElementById('framework')?.innerHTML.length ?? 0) > 1000, {
    timeout: 10000,
  });
  const { report, isFailed } = makeReporter();

  const seam = await page.evaluate(() => {
    const px = (el, pseudo, prop) => parseFloat(getComputedStyle(el, pseudo)[prop]) || 0;
    const measure = (panelSel, handleSel, wsEdge, wsBorderProp, panelBorderProp) => {
      const panel = document.querySelector(panelSel);
      const handle = document.querySelector(handleSel);
      const ws = document.querySelector('.sf-workspace');
      if (!panel || !handle || !ws) return null;
      const pr = panel.getBoundingClientRect();
      const wr = ws.getBoundingClientRect();
      const hr = handle.getBoundingClientRect();
      const border = px(panel, null, panelBorderProp);
      const seamStart = wsEdge === 'right' ? wr.right - px(ws, null, wsBorderProp) : pr.right - border;
      const seamEnd = wsEdge === 'right' ? pr.left + border : wr.left + px(ws, null, wsBorderProp);
      const insetL = px(handle, '::after', 'left');
      const insetR = px(handle, '::after', 'right');
      const lineStart = hr.left + insetL;
      const lineEnd = hr.right - insetR;
      return {
        seamCenter: (seamStart + seamEnd) / 2,
        lineCenter: (lineStart + lineEnd) / 2,
        lineWidth: lineEnd - lineStart,
        seamWidth: seamEnd - seamStart,
      };
    };
    return {
      left: measure(
        '.sf-panel--left',
        '.sf-panel-resize-handle--right',
        'left',
        'borderLeftWidth',
        'borderRightWidth',
      ),
      right: measure(
        '.sf-panel--right',
        '.sf-panel-resize-handle--left',
        'right',
        'borderRightWidth',
        'borderLeftWidth',
      ),
    };
  });

  if (!seam?.left || !seam?.right) {
    report('seam elements present', false);
  } else {
    report(
      'left seam: hover line centered on the panel/workspace divider',
      Math.abs(seam.left.lineCenter - seam.left.seamCenter) <= 0.25,
      `line center ${seam.left.lineCenter.toFixed(2)} vs seam center ${seam.left.seamCenter.toFixed(2)}`,
    );
    report(
      'left seam: hover line width unchanged',
      Math.abs(seam.left.lineWidth - 6) <= 0.5,
      `${seam.left.lineWidth.toFixed(2)}px`,
    );
    report(
      'right seam: hover line centered on the panel border',
      Math.abs(seam.right.lineCenter - seam.right.seamCenter) <= 0.25,
      `line center ${seam.right.lineCenter.toFixed(2)} vs seam center ${seam.right.seamCenter.toFixed(2)}`,
    );
    report(
      'right seam: hover line width unchanged',
      Math.abs(seam.right.lineWidth - 5) <= 0.5,
      `${seam.right.lineWidth.toFixed(2)}px`,
    );
  }

  report('no console/page errors', errors.length === 0, errors.join('; '));

  await finish(browser, serverProc, isFailed(), 'SEAM CHECKS');
})();
