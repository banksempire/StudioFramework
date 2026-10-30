const { ensureServer, openApp, makeReporter, finish } = require('./lib/ui-test.cjs');

(async () => {
  const serverProc = await ensureServer();
  const { browser, page, errors } = await openApp();
  const { report, isFailed } = makeReporter();
  const TAB_A = 'aux-e2e-a';
  const TAB_B = 'aux-e2e-b';

  function watchPage(p) {
    p.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    p.on('console', (m) => {
      if (m.type() === 'error') errors.push(`console: ${m.text()}`);
    });
    p.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()}`));
  }
  watchPage(page);
  page.context().on('page', watchPage);

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  try {
    const events = async () =>
      page.evaluate(() => (window.__sfTabResources ?? []).map((e) => `${e.kind}:${e.detail}`));
    const openResourceTab = async (id, code) => {
      await page.evaluate(
        ([tabId, tabCode]) => {
          const ws = window.__sfWorkspace;
          ws.ops.openTab(ws.focusedTileId, {
            id: tabId,
            label: tabId === 'aux-e2e-a' ? 'Aux A' : 'Aux B',
            icon: '🧩',
            content: 'resource-demo',
            props: { code: tabCode },
          });
        },
        [id, code],
      );
      await page.waitForSelector(`[data-tab-slot="${id}"] .sf-resource-demo`);
    };

    await openResourceTab(TAB_A, 'res-a');
    report(
      'tab opens and resources are requested exactly once',
      (await events()).filter((e) => e.startsWith('open')).length === 1,
    );
    await page.click(`[data-tab-slot="${TAB_A}"] [data-test="switch-code"]`);
    await page.waitForFunction(
      (id) =>
        document.querySelector(`[data-tab-slot="${id}"] [data-test="resource-code"]`)?.textContent ===
        'res-b',
      TAB_A,
    );

    const popupPromise = page.context().waitForEvent('page');
    await page.click('[data-test="tab-window"]');
    const aux = await popupPromise;
    await aux.waitForSelector('[data-test="aux-content"] .sf-resource-demo', { timeout: 5000 });
    report('tail button detaches into a popup with a tab strip', true);
    report(
      'popup strip shows one chip and the accumulated state (res-b)',
      (await aux.locator('[data-test="aux-tab"]').count()) === 1 &&
        (await aux.textContent('[data-test="resource-code"]')) === 'res-b',
    );

    await aux.click('[data-test="show-dialog"]');
    await aux.waitForSelector('[data-test="demo-dialog-body"]', { timeout: 5000 });
    report(
      'dialog opened from the popup renders inside the popup document',
      (await aux.locator('.sf-dialog-backdrop').count()) === 1 &&
        (await page.locator('.sf-dialog-backdrop').count()) === 0,
    );
    report(
      'dialog body reflects shared-store state (res-b)',
      (await aux.textContent('[data-test="demo-dialog-body"]')).includes('res-b'),
    );
    await aux.click('.sf-dialog-close');
    await aux.waitForSelector('.sf-dialog-backdrop', { state: 'detached', timeout: 5000 });
    report('dialog closes inside the popup', true);

    await openResourceTab(TAB_B, 'res-a');
    await aux.click('[data-test="aux-pull"]');
    await aux.waitForFunction(() => document.querySelectorAll('[data-test="aux-tab"]').length === 2, {
      timeout: 5000,
    });
    report(
      'pull button moves the main active tab into the same popup',
      (await page.evaluate((id) => window.__sfWorkspace.findTabGlobal(id) === null, TAB_B)) &&
        (await page.evaluate((id) => window.__sfWorkspace.findTabGlobal(id) === null, TAB_A)),
    );
    report(
      'both instances stay alive (no resource churn)',
      !(await events()).some((e) => e.startsWith('close')) &&
        (await events()).filter((e) => e.startsWith('open')).length === 2,
    );

    await aux.locator(`[data-test="aux-tab"][data-tab-id="${TAB_B}"]`).click();
    await aux.waitForFunction(
      () => document.querySelector('[data-test="resource-code"]')?.textContent === 'res-a',
    );
    report('switching chips swaps the hosted content inside the popup', true);
    report(
      'returned chip count stays consistent after switch',
      (await aux.locator('[data-test="aux-tab"]').count()) === 2,
    );

    await aux.click('[data-test="aux-return"]');
    await page.waitForSelector(`.sf-tab[data-tab-id="${TAB_B}"]`, { timeout: 5000 });
    report(
      'return moves the active popup tab back into the main workspace',
      await page.evaluate((id) => window.__sfWorkspace.findTabGlobal(id) !== null, TAB_B),
    );
    report(
      'popup keeps hosting the remaining tab',
      (await aux.locator('[data-test="aux-tab"]').count()) === 1,
    );

    const snap = await page.evaluate(() => window.__sfWorkspace.capture());
    report(
      'capture() includes detached tabs in snap.aux',
      Array.isArray(snap.aux) &&
        snap.aux.includes(TAB_A) &&
        !snap.roots.some((r) => JSON.stringify(r).includes(TAB_A)),
    );
    await wait(700);
    const savedAux = await page.evaluate(() => {
      const raw = localStorage.getItem('sf.workspace.layout');
      return raw ? JSON.parse(raw).aux : null;
    });
    report(
      'auto-saved layout snapshot includes the detached tab',
      Array.isArray(savedAux) && savedAux.includes(TAB_A),
    );

    await page.evaluate((id) => {
      const ws = window.__sfWorkspace;
      ws.apply(JSON.parse(localStorage.getItem('sf.workspace.layout')));
      void id;
    }, TAB_A);
    await page.waitForSelector(`.sf-tab[data-tab-id="${TAB_A}"]`, { timeout: 5000 });
    report(
      'applying a snapshot folds detached tabs back into the workspace',
      await page.evaluate((id) => window.__sfWorkspace.findTabGlobal(id) !== null, TAB_A),
    );
    report('aux window closed after folding', aux.isClosed());
    report('fold round trip kept both instances alive', !(await events()).some((e) => e.startsWith('close')));

    const popupPromise2 = page.context().waitForEvent('page');
    await page.evaluate((id) => window.__sfWorkspace.ops.detachTab(id), TAB_A);
    const aux2 = await popupPromise2;
    await aux2.waitForSelector('[data-test="aux-content"] .sf-resource-demo', { timeout: 5000 });
    await aux2.evaluate(() => window.close());
    await page.waitForFunction((id) => window.__sfWorkspace.findTabGlobal(id) !== null, TAB_A, {
      timeout: 5000,
    });
    report('closing the popup window reattaches the tab', true);

    await page.click(`.sf-tab[data-tab-id="${TAB_A}"] .sf-tab-close`);
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
