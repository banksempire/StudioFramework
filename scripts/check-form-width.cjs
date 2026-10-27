const { ensureServer, openApp, makeReporter, finish } = require('./lib/ui-test.cjs');

(async () => {
  const serverProc = await ensureServer();
  const { browser, page, errors } = await openApp();
  const { report, isFailed } = makeReporter();

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  async function scanFormGrids(scopeSel) {
    return page.evaluate((scope) => {
      const problems = [];
      let rows = 0;
      const grids = [...document.querySelectorAll(`${scope} .sf-form-grid`)];
      if (grids.length === 0) return null;
      for (const grid of grids) {
        for (const row of grid.querySelectorAll('.sf-form-row')) {
          if (row.getBoundingClientRect().width <= 40) continue;
          rows += 1;
          const slots = [...row.children].filter(
            (el) =>
              el.classList.contains('sf-form-field') ||
              el.classList.contains('sf-dialog-btn') ||
              el.classList.contains('sf-form-info'),
          );
          const rowR = row.getBoundingClientRect();
          const grows = slots.map((el) => {
            const m = /flex:\s*([0-9.]+)/.exec(el.getAttribute('style') ?? '');
            return m ? Number(m[1]) : 1;
          });
          const total = grows.reduce((a, b) => a + b, 0);
          const free = rowR.width - (slots.length - 1) * 10;
          for (let i = 0; i < slots.length; i++) {
            const r = slots[i].getBoundingClientRect();
            const expected = (free * grows[i]) / total;
            if (Math.abs(r.width - expected) > 2) {
              problems.push(
                `slot[data-field=${slots[i].getAttribute('data-field')}] width ${r.width.toFixed(1)} != weighted ${expected.toFixed(1)}`,
              );
            }
            if (i > 0) {
              const prev = slots[i - 1].getBoundingClientRect();
              if (r.left - prev.right < -0.5) problems.push(`slot ${i} overlaps slot ${i - 1}`);
            }
            for (const ctl of slots[i].querySelectorAll(
              'input, select, button, .sf-pill, .sf-stepper-input, .sf-form-input, .sf-form-select',
            )) {
              const cr = ctl.getBoundingClientRect();
              if (cr.width === 0 && cr.height === 0) continue;
              if (cr.right > r.right + 0.75 || cr.left < r.left - 0.75) {
                problems.push(
                  `control ${ctl.className.split(' ')[0]} overflows its slot (${(cr.right - r.right).toFixed(1)}px)`,
                );
              }
            }
          }
        }
      }
      return { rows, problems };
    }, scopeSel);
  }

  async function clickDocker(title) {
    for (let i = 0; i < 3; i++) {
      await page.click(`.sf-docker-app[title="${title}"]`);
      await delay(300);
      const shown = await page.evaluate(() =>
        [...document.querySelectorAll('.sf-panel--left, .sf-panel--right')].some(
          (p) => !p.classList.contains('sf-panel--hidden'),
        ),
      );
      if (shown) return;
    }
  }

  try {
    await page.click('.sf-docker-app[title="Library"]');
    await delay(400);
    const formSection = page.locator('.sf-panel--left .sf-subsection', { hasText: 'Form' }).first();
    await formSection.scrollIntoViewIfNeeded();
    await delay(200);

    const scan = await scanFormGrids('.sf-panel--left');
    report('panel form renders the weighted demo rows', (scan?.rows ?? 0) >= 3, JSON.stringify(scan));
    report(
      'panel rows honor span weights without overlap at default width',
      (scan?.problems.length ?? 1) === 0,
      JSON.stringify(scan?.problems ?? []),
    );

    await page.setViewportSize({ width: 820, height: 800 });
    await delay(300);
    await clickDocker('Library');
    await formSection.scrollIntoViewIfNeeded();
    await delay(200);
    const narrow = await scanFormGrids('.sf-panel--left');
    report(
      'panel rows honor span weights without overlap at narrow width',
      (narrow?.rows ?? 0) >= 1 && (narrow?.problems.length ?? 1) === 0,
      JSON.stringify(narrow),
    );

    await page.setViewportSize({ width: 1280, height: 800 });
    await delay(300);

    await clickDocker('Explorer');
    await page.locator('.sf-dialog-demo-open').scrollIntoViewIfNeeded();
    await page.locator('.sf-dialog-demo-open').click();
    await delay(400);
    await page.locator('.sf-dialog').waitFor({ state: 'visible', timeout: 5000 });
    report(
      'element popup hosts pill and stepper controls',
      (await page.locator('.sf-dialog .sf-form-field[data-field="mode"]').count()) === 1 &&
        (await page.locator('.sf-dialog .sf-stepper-input').count()) > 0,
      '',
    );
    const elementScan = await scanFormGrids('.sf-dialog');
    report(
      'element popup form rows never overlap or overflow',
      (elementScan?.rows ?? 0) >= 3 && (elementScan?.problems.length ?? 1) === 0,
      JSON.stringify(elementScan),
    );
    await page.locator('.sf-dialog .sf-dialog-btn').last().click();
    await page.locator('.sf-dialog').waitFor({ state: 'detached', timeout: 5000 });
    await delay(200);

    await page.locator('.sf-dialog-demo-open-panel').click();
    await delay(400);
    await page.locator('.sf-dialog').waitFor({ state: 'visible', timeout: 5000 });
    report(
      'panel popup hosts pill and stepper controls',
      (await page.locator('.sf-dialog .sf-pill').count()) > 0 &&
        (await page.locator('.sf-dialog .sf-stepper-input').count()) > 0,
      '',
    );
    const pfScan = await scanFormGrids('.sf-dialog');
    report(
      'panel popup form rows never overlap or overflow',
      (pfScan?.rows ?? 0) >= 3 && (pfScan?.problems.length ?? 1) === 0,
      JSON.stringify(pfScan),
    );

    report('no console/page errors', errors.length === 0, JSON.stringify(errors));
  } catch (e) {
    report('suite crashed', false, String(e));
  }

  await finish(browser, serverProc, isFailed(), 'FORM-WIDTH');
})().catch(async (e) => {
  console.error('check aborted:', e.message);
  process.exit(2);
});
