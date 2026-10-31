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
      if (m.text().includes('drop-dbg')) console.log('CONSOLE:', m.text());
    });
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
    await page.evaluate((id) => {
      const tab = document.querySelector(`.sf-tab[data-tab-id="${id}"]`);
      tab.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: new DataTransfer() }));
      tab.dispatchEvent(new DragEvent('dragend', { bubbles: true, screenX: 900, screenY: 400 }));
    }, TAB_A);
    const aux = await popupPromise;
    await aux.waitForSelector('[data-test="aux-content"] .sf-workspace', { timeout: 5000 });
    report('dragging a tab out to blank space opens a popup with a real workspace', true);
    report(
      'popup hosts the dragged tab with its accumulated state (res-b)',
      (await aux.locator(`.sf-tab[data-tab-id="${TAB_A}"]`).count()) === 1 &&
        (await aux.textContent('[data-test="resource-code"]')) === 'res-b',
    );
    report(
      'same instance moved (no resource churn)',
      (await events()).filter((e) => e.startsWith('open')).length === 1 &&
        !(await events()).some((e) => e.startsWith('close')),
    );
    report(
      'popup shell: menu bar, docker, panels, no status bar',
      (await aux.locator('.sf-menu-bar').count()) === 1 &&
        (await aux.locator('.sf-docker').count()) === 1 &&
        (await aux.locator('.sf-panel').count()) >= 1 &&
        (await aux.locator('.sf-status-bar').count()) === 0,
    );
    await aux.setViewportSize({ width: 375, height: 700 });
    await aux.waitForFunction(
      () =>
        document.querySelectorAll('.sf-root--mobile').length >= 1 &&
        !!document.querySelector('.sf-mobile-tab-label'),
      { timeout: 5000 },
    );
    report('narrow popup switches to the mobile layout', true);
    await aux.setViewportSize({ width: 960, height: 720 });
    await aux.waitForFunction(() => document.querySelectorAll('.sf-root--mobile').length === 0, {
      timeout: 5000,
    });
    report('wide popup switches back to the desktop layout', true);

    await aux.click('[data-test="show-dialog"]');
    await aux.waitForSelector('[data-test="demo-dialog-body"]', { timeout: 5000 });
    report(
      'dialog opened from the popup renders inside the popup document',
      (await aux.locator('.sf-dialog-backdrop').count()) === 1 &&
        (await page.locator('.sf-dialog-backdrop').count()) === 0,
    );
    await aux.click('.sf-dialog-close');
    await aux.waitForSelector('.sf-dialog-backdrop', { state: 'detached', timeout: 5000 });
    report('dialog closes inside the popup', true);

    await openResourceTab(TAB_B, 'res-a');
    await page.evaluate((id) => {
      const tab = document.querySelector(`.sf-tab[data-tab-id="${id}"]`);
      tab.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: new DataTransfer() }));
    }, TAB_B);
    await wait(300);
    const tileBox = await aux.locator('.sf-tile').first().boundingBox();
    await aux.evaluate(
      ({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        const dt = new DataTransfer();
        el.dispatchEvent(
          new DragEvent('dragover', { bubbles: true, clientX: x, clientY: y, dataTransfer: dt }),
        );
        el.dispatchEvent(new DragEvent('drop', { bubbles: true, clientX: x, clientY: y, dataTransfer: dt }));
      },
      { x: Math.round(tileBox.x + tileBox.width / 2), y: Math.round(tileBox.y + tileBox.height / 2) },
    );
    await aux.waitForSelector(`.sf-tab[data-tab-id="${TAB_B}"]`, { timeout: 5000 });
    const popupTabsAfterDrop = await aux.locator('.sf-tab').count();
    report('popup hosts both tabs after the drop', popupTabsAfterDrop === 2);
    report(
      'TAB_B now belongs to the popup window',
      await page.evaluate((id) => window.__sfWorkspace.tabWindow(id) === 1, TAB_B),
    );
    report(
      'TAB_A still belongs to the popup window',
      await page.evaluate((id) => window.__sfWorkspace.tabWindow(id) === 1, TAB_A),
    );
    report(
      'both instances stay alive across the window move',
      !(await events()).some((e) => e.startsWith('close')) &&
        (await events()).filter((e) => e.startsWith('open')).length === 2,
    );

    await aux.click(`.sf-tab[data-tab-id="${TAB_B}"]`);
    await aux.waitForFunction(
      () => document.querySelector('[data-test="resource-code"]')?.textContent === 'res-a',
    );
    report('switching popup tabs swaps the hosted content', true);

    await aux.evaluate(() => {
      window.__auxClipboardCalls = [];
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: (t) => {
            window.__auxClipboardCalls.push(t);
            return Promise.resolve();
          },
        },
        configurable: true,
      });
    });
    await page.evaluate(() => {
      window.__mainClipboardCalls = [];
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: (t) => {
            window.__mainClipboardCalls.push(t);
            return Promise.resolve();
          },
        },
        configurable: true,
      });
    });
    await aux.click('[data-test="copy-code"]');
    await aux.waitForFunction(() => (window.__auxClipboardCalls ?? []).length === 1);
    report(
      'clipboard write from popup content uses the popup navigator',
      (await aux.evaluate(() => window.__auxClipboardCalls[0])) === 'res res-a' &&
        (await page.evaluate(() => (window.__mainClipboardCalls ?? []).length)) === 0,
    );

    await aux.evaluate((id) => {
      const tab = document.querySelector(`.sf-tab[data-tab-id="${id}"]`);
      tab.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: new DataTransfer() }));
    }, TAB_B);
    const splitBox = await aux.locator('.sf-tile').first().boundingBox();
    await aux.evaluate(
      ({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        const dt = new DataTransfer();
        el.dispatchEvent(
          new DragEvent('dragover', { bubbles: true, clientX: x, clientY: y, dataTransfer: dt }),
        );
        el.dispatchEvent(new DragEvent('drop', { bubbles: true, clientX: x, clientY: y, dataTransfer: dt }));
      },
      { x: Math.round(splitBox.x + splitBox.width - 8), y: Math.round(splitBox.y + splitBox.height / 2) },
    );
    await aux.waitForFunction(() => document.querySelectorAll('.sf-tile').length === 2);
    report(
      'dragging a popup tab to a tile edge splits the popup like the main window',
      (await aux.locator('.sf-tab').count()) === 2,
    );

    const popupPromise2 = page.context().waitForEvent('page');
    await aux.evaluate((id) => {
      const secondTile = document.querySelectorAll('.sf-tile')[1];
      const tab = secondTile.querySelector(`.sf-tab[data-tab-id="${id}"]`);
      tab.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: new DataTransfer() }));
      tab.dispatchEvent(new DragEvent('dragend', { bubbles: true, screenX: 1100, screenY: 500 }));
    }, TAB_B);
    const aux2 = await popupPromise2;
    await aux2.waitForSelector('[data-test="aux-content"] .sf-workspace', { timeout: 5000 });
    report(
      'dragging a popup tab to blank space opens a second popup with that tab',
      (await aux2.locator(`.sf-tab[data-tab-id="${TAB_B}"]`).count()) === 1 &&
        (await aux.locator('.sf-tab').count()) === 1,
    );

    await aux2.evaluate((id) => {
      const tab = document.querySelector(`.sf-tab[data-tab-id="${id}"]`);
      tab.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: new DataTransfer() }));
    }, TAB_B);
    const p1Box = await aux.locator('.sf-tile').first().boundingBox();
    await aux.evaluate(
      ({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        const dt = new DataTransfer();
        el.dispatchEvent(
          new DragEvent('dragover', { bubbles: true, clientX: x, clientY: y, dataTransfer: dt }),
        );
        el.dispatchEvent(new DragEvent('drop', { bubbles: true, clientX: x, clientY: y, dataTransfer: dt }));
      },
      { x: Math.round(p1Box.x + p1Box.width / 2), y: Math.round(p1Box.y + p1Box.height / 2) },
    );
    await aux.waitForFunction(() => document.querySelectorAll('.sf-tab').length === 2, { timeout: 5000 });
    for (let i = 0; i < 20 && !aux2.isClosed(); i++) {
      await wait(250);
    }
    report(
      'dropping a tab from one popup onto another popup moves it directly (source closes)',
      (await aux.locator(`.sf-tab[data-tab-id="${TAB_B}"]`).count()) === 1 && aux2.isClosed(),
    );

    await aux.evaluate((id) => {
      const tab = document.querySelector(`.sf-tab[data-tab-id="${id}"]`);
      tab.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: new DataTransfer() }));
    }, TAB_B);
    const mainBox = await page.locator('.sf-tile').first().boundingBox();
    await page.evaluate(
      ({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        const dt = new DataTransfer();
        el.dispatchEvent(
          new DragEvent('dragover', { bubbles: true, clientX: x, clientY: y, dataTransfer: dt }),
        );
        el.dispatchEvent(new DragEvent('drop', { bubbles: true, clientX: x, clientY: y, dataTransfer: dt }));
      },
      { x: Math.round(mainBox.x + mainBox.width / 2), y: Math.round(mainBox.y + mainBox.height / 2) },
    );
    await page.waitForSelector(`.sf-tab[data-tab-id="${TAB_B}"]`, { timeout: 5000 });
    report(
      'dropping a popup tab onto the main workspace reattaches it',
      await page.evaluate((id) => window.__sfWorkspace.tabWindow(id) === 0, TAB_B),
    );
    const remainingIds = await aux.evaluate(() =>
      [...document.querySelectorAll('.sf-tab')].map((t) => t.dataset.tabId),
    );
    report('popup keeps the remaining tab', remainingIds.length === 1, `ids=${JSON.stringify(remainingIds)}`);

    const snap = await page.evaluate(() => window.__sfWorkspace.capture());
    report(
      'capture() includes detached tabs in snap.aux',
      Array.isArray(snap.aux) && snap.aux.includes(TAB_A),
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

    await page.evaluate(() => {
      window.__sfWorkspace.apply(JSON.parse(localStorage.getItem('sf.workspace.layout')));
    });
    await page.waitForSelector(`.sf-tab[data-tab-id="${TAB_A}"]`, { timeout: 5000 });
    report(
      'applying a snapshot folds detached tabs back into the workspace',
      await page.evaluate((id) => window.__sfWorkspace.tabWindow(id) === 0, TAB_A),
    );
    report('aux window closed after folding', aux.isClosed());
    report('fold round trip kept both instances alive', !(await events()).some((e) => e.startsWith('close')));

    const clip = await page.evaluate(async (id) => {
      const tile = window.__sfWorkspace.findTabGlobal(id);
      if (!tile) return { fail: 'no tile' };
      window.__sfWorkspace.ops.activateTab(tile.id, id);
      await new Promise((r) => setTimeout(r, 400));
      const tab = document.querySelector(`[data-tab-slot="${id}"] [data-test="copy-code"]`);
      if (!tab) return { fail: 'no copy button in slot' };
      tab.click();
      await new Promise((r) => setTimeout(r, 300));
      return { calls: (window.__mainClipboardCalls ?? []).length };
    }, TAB_B);
    report(
      'clipboard write from main-window content uses the main navigator',
      clip.calls === 1,
      JSON.stringify(clip),
    );

    const popupPromise3 = page.context().waitForEvent('page');
    await page.evaluate((id) => {
      const tab = document.querySelector(`.sf-tab[data-tab-id="${id}"]`);
      tab.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: new DataTransfer() }));
      tab.dispatchEvent(new DragEvent('dragend', { bubbles: true, screenX: 900, screenY: 400 }));
    }, TAB_A);
    const aux3 = await popupPromise3;
    await aux3.waitForSelector('[data-test="aux-content"] .sf-workspace', { timeout: 5000 });
    await aux3.evaluate(() => window.close());
    await page.waitForFunction((id) => window.__sfWorkspace.tabWindow(id) === 0, TAB_A, {
      timeout: 5000,
    });
    report('closing the popup window reattaches the tab', true);

    await page.click(`.sf-tab[data-tab-id="${TAB_A}"] .sf-tab-close`);
    await page.click(`.sf-tab[data-tab-id="${TAB_B}"] .sf-tab-close`);
    await page.waitForFunction(
      () => (window.__sfTabResources ?? []).filter((e) => e.kind === 'close').length === 2,
      { timeout: 5000 },
    );
    const finalEvents = await events();
    report(
      'explicit closes release resources exactly once each',
      finalEvents.filter((e) => e.startsWith('close')).length === 2,
    );

    const mobileContext = await browser.newContext({ viewport: { width: 375, height: 700 } });
    const mobile = await mobileContext.newPage();
    watchPage(mobile);
    await mobile.goto('http://localhost:7493/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await mobile.waitForFunction(() => (document.getElementById('framework')?.innerHTML.length ?? 0) > 1000, {
      timeout: 10000,
    });
    const mobileResult = await mobile.evaluate(() => {
      const ws = window.__sfWorkspace;
      ws.ops.openTab(ws.focusedTileId, {
        id: 'aux-mobile',
        label: 'Mobile',
        content: 'resource-demo',
        props: { code: 'res-a' },
      });
      const desktopTabsGone = document.querySelector('.sf-tab') === null;
      const refused = ws.ops.detachTab('aux-mobile') === false;
      return { desktopTabsGone, refused };
    });
    report(
      'mobile mode: no desktop tab drag surface and detachment refused',
      mobileResult.desktopTabsGone && mobileResult.refused,
    );
    await mobile.close();
    await mobileContext.close();

    report('no page errors on any window', errors.length === 0, errors.join(' | ').slice(0, 300));
  } catch (e) {
    report('suite completed', false, String(e));
  } finally {
    await finish(browser, serverProc, isFailed(), 'AUX WINDOW');
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
