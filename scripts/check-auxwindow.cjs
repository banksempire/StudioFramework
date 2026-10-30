const { ensureServer, openApp, makeReporter, finish } = require('./lib/ui-test.cjs');

(async () => {
  const serverProc = await ensureServer();
  const { browser, page, errors } = await openApp();
  const { report, isFailed } = makeReporter();
  const TAB_ID = 'aux-e2e-tab';

  function watchPage(p) {
    p.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    p.on('console', (m) => {
      if (m.type() === 'error') errors.push(`console: ${m.text()}`);
    });
    p.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()}`));
  }
  watchPage(page);
  page.context().on('page', watchPage);

  try {
    const events = async () =>
      page.evaluate(() => (window.__sfTabResources ?? []).map((e) => `${e.kind}:${e.detail}`));

    await page.evaluate((id) => {
      const ws = window.__sfWorkspace;
      ws.ops.openTab(ws.focusedTileId, {
        id,
        label: 'Aux E2E',
        icon: '🧩',
        content: 'resource-demo',
        props: { code: 'res-a' },
      });
    }, TAB_ID);
    await page.waitForSelector(`[data-tab-slot="${TAB_ID}"] .sf-resource-demo`);
    report(
      'tab opens and resources are requested exactly once',
      (await events()).filter((e) => e.startsWith('open')).length === 1,
    );

    await page.click(`[data-tab-slot="${TAB_ID}"] [data-test="switch-code"]`);
    await page.waitForFunction(
      (id) =>
        document.querySelector(`[data-tab-slot="${id}"] [data-test="resource-code"]`)?.textContent ===
        'res-b',
      TAB_ID,
    );
    report('accumulated state set to res-b', true);

    const popupPromise = page.context().waitForEvent('page');
    await page.click('[data-test="tab-window"]');
    const aux = await popupPromise;
    report('tab-strip tail button detaches the active tab', true);
    await aux.waitForSelector('[data-test="aux-content"] .sf-resource-demo', { timeout: 5000 });
    report(
      'popup hosts the tab content',
      (await aux.locator('[data-test="aux-content"] .sf-resource-demo').count()) === 1,
    );
    report(
      'popup shows the accumulated state (res-b)',
      (await aux.textContent('[data-test="resource-code"]')) === 'res-b',
    );
    report(
      'tab removed from the main workspace tree',
      await page.evaluate((id) => window.__sfWorkspace.findTabGlobal(id) === null, TAB_ID),
    );
    report(
      'same component instance moved (not re-created)',
      (await events()).filter((e) => e.startsWith('open')).length === 1 &&
        !(await events()).some((e) => e.startsWith('close')),
    );

    await aux.click('[data-test="switch-code"]');
    await aux.waitForFunction(
      () => document.querySelector('[data-test="resource-code"]')?.textContent === 'res-a',
    );
    report('cross-window mutation updates the popup (res-a)', true);
    report(
      'cross-window mutation is visible in the shared store',
      await page.evaluate((id) => window.__sfWorkspace.tabDefs[id]?.props?.code === 'res-a', TAB_ID),
    );

    await aux.click('[data-test="aux-reattach"]');
    await page.waitForSelector(`.sf-tab[data-tab-id="${TAB_ID}"]`, { timeout: 5000 });
    await page.waitForSelector(`[data-tab-slot="${TAB_ID}"] [data-test="resource-code"]`, {
      timeout: 5000,
    });
    report(
      'reattach puts the tab back into the main workspace',
      await page.evaluate((id) => window.__sfWorkspace.findTabGlobal(id) !== null, TAB_ID),
    );
    report(
      'reattached content kept its live state (res-a)',
      (await page.textContent(`[data-tab-slot="${TAB_ID}"] [data-test="resource-code"]`)) === 'res-a',
    );
    report(
      'no resource close/request happened across the round trip',
      (await events()).filter((e) => e.startsWith('open')).length === 1 &&
        !(await events()).some((e) => e.startsWith('close')),
    );
    for (let i = 0; i < 20 && !aux.isClosed(); i++) {
      await new Promise((r) => setTimeout(r, 250));
    }
    report('aux window closed after reattach', aux.isClosed());

    const popupPromise2 = page.context().waitForEvent('page');
    await page.evaluate((id) => window.__sfWorkspace.ops.detachTab(id), TAB_ID);
    const aux2 = await popupPromise2;
    await aux2.waitForSelector('[data-test="aux-content"] .sf-resource-demo', { timeout: 5000 });
    await aux2.evaluate(() => window.close());
    await page.waitForFunction((id) => window.__sfWorkspace.findTabGlobal(id) !== null, TAB_ID, {
      timeout: 5000,
    });
    report('closing the popup window reattaches the tab', true);
    report(
      'still no resource release after popup close',
      !(await events()).some((e) => e.startsWith('close')),
    );

    await page.click(`.sf-tab[data-tab-id="${TAB_ID}"] .sf-tab-close`);
    await page.waitForFunction(() => (window.__sfTabResources ?? []).some((e) => e.kind === 'close'), {
      timeout: 5000,
    });
    const finalEvents = await events();
    report(
      'explicit close releases resources exactly once',
      finalEvents.filter((e) => e.startsWith('close')).length === 1,
    );

    report('no page errors on any window', errors.length === 0);
  } catch (e) {
    report('suite completed', false, String(e));
  } finally {
    await finish(browser, serverProc, isFailed(), 'AUX WINDOW');
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
