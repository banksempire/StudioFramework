const { ensureServer, openApp, makeReporter, finish } = require('./lib/ui-test.cjs');

const near = (a, b, tol = 2) => a !== null && b !== null && Math.abs(a - b) <= tol;

(async () => {
  const serverProc = await ensureServer();
  const { browser, page, errors } = await openApp({ viewport: { width: 1440, height: 1100 } });
  const { report, isFailed } = makeReporter();

  const bodyCount = async (id) => page.locator(`[data-sub-body="${id}"]`).count();
  const h3LabelCount = (text) => page.locator('.sf-subsection-label--h3', { hasText: text }).count();

  const sectionTop = async (id) => {
    const box = await page
      .locator(`.sf-subsection:has([data-sub-body="${id}"]) > .sf-subsection-header`)
      .boundingBox();
    return box?.y ?? null;
  };

  const bodyBottom = async (id) => {
    const box = await page.locator(`[data-sub-body="${id}"]`).boundingBox();
    return box ? box.y + box.height : null;
  };

  const collapsedHeaderBottom = async (label) => {
    const box = await page
      .locator('.sf-subsection--collapsed .sf-subsection-header', { hasText: label })
      .boundingBox();
    return box ? box.y + box.height : null;
  };

  try {
    await page.click('.sf-docker-app[title="Library"]');
    await page.waitForTimeout(400);

    report('nested h2 renders its body', (await bodyCount('lib-nested')) === 1);
    report('h3 trailer renders under the expanded h2', (await bodyCount('lib-nested-details')) === 1);
    report('h3 trailer label rendered', (await h3LabelCount('Details')) === 1);
    report(
      'expanded: h3 body sits flush above the next section',
      near(await bodyBottom('lib-nested-details'), await sectionTop('lib-list')),
    );

    await page.click('.sf-subsection-header:has-text("Nested")');
    await page.waitForTimeout(300);

    report('collapsed h2 hides its body', (await bodyCount('lib-nested')) === 0);
    report('collapsed h2 hides the h3 trailer body', (await bodyCount('lib-nested-details')) === 0);
    report('collapsed h2 hides the h3 trailer label', (await h3LabelCount('Details')) === 0);
    report(
      'collapsed h2 leaves no gap before the next section',
      near(await collapsedHeaderBottom('Nested'), await sectionTop('lib-list')),
    );

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    await page.click('.sf-docker-app[title="Library"]');
    await page.waitForTimeout(400);
    report('collapse state persists across reload', (await bodyCount('lib-nested')) === 0);
    report(
      'h3 trailer stays hidden after reload',
      (await bodyCount('lib-nested-details')) === 0 && (await h3LabelCount('Details')) === 0,
    );

    await page.click('.sf-subsection-header:has-text("Nested")');
    await page.waitForTimeout(300);
    report('re-expanding restores the h2 body', (await bodyCount('lib-nested')) === 1);
    report('re-expanding restores the h3 trailer', (await bodyCount('lib-nested-details')) === 1);
    report(
      're-expanded: h3 body sits flush above the next section',
      near(await bodyBottom('lib-nested-details'), await sectionTop('lib-list')),
    );

    report('no console/page errors', errors.length === 0, errors.join(' | '));
  } finally {
    await finish(browser, serverProc, isFailed(), 'NESTED SECTION CHECKS');
  }
})();
