const { ensureServer, openApp, makeReporter, finish } = require('./lib/ui-test.cjs');

const panelWidth = (page, side) => page.$eval(`.sf-panel--${side}`, (el) => el.getBoundingClientRect().width);

const subBodyHeight = (page, id) =>
  page.$eval(`[data-sub-body="${id}"]`, (el) => el.getBoundingClientRect().height).catch(() => null);

async function dragPanel(page, side, deltaPx) {
  const handleClass = side === 'left' ? '.sf-panel-resize-handle--right' : '.sf-panel-resize-handle--left';
  const handle = await page.$(handleClass);
  if (!handle) throw new Error(`panel resize handle not found: ${side}`);
  const box = await handle.boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const dir = side === 'left' ? 1 : -1;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + deltaPx * dir, cy, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(150);
}

async function dragSubsectionHandle(page, index, deltaPx) {
  const handles = await page.$$('.sf-subsection-drag-handle');
  const handle = handles[index];
  if (!handle) throw new Error(`subsection drag handle #${index} not found`);
  const box = await handle.boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx, cy + deltaPx, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(150);
}

async function openWsPanel(page) {
  const panelVisible = async () => {
    const el = await page.$('.sf-ws-panel');
    return el !== null && (await el.isVisible());
  };
  for (let i = 0; i < 2 && !(await panelVisible()); i++) {
    await page.click('.sf-docker-app[title="Workspace"]');
    await page.waitForTimeout(300);
  }
}

const near = (a, b, tol = 2) => a !== null && b !== null && Math.abs(a - b) <= tol;

(async () => {
  const serverProc = await ensureServer();
  const { browser, page, errors } = await openApp({ viewport: { width: 1440, height: 1100 } });
  const { report, isFailed } = makeReporter();

  try {
    const wLeft0 = await panelWidth(page, 'left');
    const wRight0 = await panelWidth(page, 'right');

    await dragPanel(page, 'left', 100);
    await dragPanel(page, 'right', 80);
    const wLeft1 = await panelWidth(page, 'left');
    const wRight1 = await panelWidth(page, 'right');
    report('panel widths changed by drag', near(wLeft1, wLeft0 + 100) && near(wRight1, wRight0 + 80));

    const hProj0 = await subBodyHeight(page, 'project');
    await dragSubsectionHandle(page, 0, -60);
    const hProj1 = await subBodyHeight(page, 'project');
    report(
      'subsection drag shrinks project body',
      hProj0 !== null && hProj1 !== null && hProj1 < hProj0 - 30,
    );

    await page.click('.sf-subsection-header:has-text("Outline")');
    await page.waitForTimeout(200);
    report('outline subsection collapsed', !(await page.isVisible('[data-sub-body="outline"]')));

    await page.click('.sf-panel-header-btn');
    await page.waitForTimeout(200);
    await page.click('.sf-menu-pop .sf-menu-row:has-text("Timeline")');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    report(
      'timeline subsection hidden via panel menu',
      (await page.locator('.sf-subsection:has-text("Timeline")').count()) === 0,
    );
    await page.waitForTimeout(200);
    const hProjFinal = await subBodyHeight(page, 'project');

    await page.click('.sf-docker-app[title="Search"]');
    await page.waitForTimeout(300);
    report('docker app switched to Search', (await page.textContent('.sf-panel-title')) === 'Search');

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    report('docker app persists across reload', (await page.textContent('.sf-panel-title')) === 'Search');
    report('left panel width persists', near(await panelWidth(page, 'left'), wLeft1));
    report('right panel width persists', near(await panelWidth(page, 'right'), wRight1));

    await page.click('.sf-docker-app[title="Explorer"]');
    await page.waitForTimeout(300);
    await page.click('.sf-panel-tab:has-text("NPM")');
    await page.waitForTimeout(300);
    report(
      'section tab switched to NPM',
      (await page.textContent('.sf-panel-tab--active'))?.includes('NPM') === true,
    );

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    report(
      'active section tab persists across reload',
      (await page.textContent('.sf-panel-tab--active'))?.includes('NPM') === true,
    );

    await page.click('.sf-panel-tab:has-text("Files")');
    await page.waitForTimeout(400);
    report(
      'project height persists across reload',
      near(await subBodyHeight(page, 'project'), hProjFinal, 4),
    );
    report('outline stays collapsed after reload', !(await page.isVisible('[data-sub-body="outline"]')));
    report(
      'timeline stays hidden after reload',
      (await page.locator('.sf-subsection:has-text("Timeline")').count()) === 0,
    );

    const savedUi = await page.evaluate(() => {
      try {
        return JSON.parse(localStorage.getItem('sf.ui.state') || 'null');
      } catch {
        return null;
      }
    });
    report(
      'ui state stored under versioned key',
      savedUi !== null &&
        savedUi.version === 1 &&
        typeof savedUi.values === 'object' &&
        typeof savedUi.values['panel.width.left'] === 'number',
    );

    const wsName = `Persist ${Date.now()}`;
    await openWsPanel(page);
    await page.fill('.sf-ws-save .sf-ws-input', wsName);
    await page.click('.sf-ws-save .sf-ws-btn--primary');
    await page.waitForTimeout(300);

    const snapshotInventory = await page.evaluate((name) => {
      const list = JSON.parse(localStorage.getItem('sf.workspaces') || '[]');
      const item = list.find((w) => w.name === name);
      const live = JSON.parse(localStorage.getItem('sf.ui.state') || 'null');
      return {
        found: !!item,
        hasUi: !!item?.snapshot?.ui && typeof item.snapshot.ui === 'object',
        liveKeys: Object.keys(live?.values ?? {}).sort(),
        snapKeys: Object.keys(item?.snapshot?.ui ?? {}).sort(),
        uiValues: item?.snapshot?.ui ?? null,
      };
    }, wsName);
    report('saved workspace exists', snapshotInventory.found);
    report(
      'saved workspace carries the ui state block',
      snapshotInventory.hasUi &&
        typeof snapshotInventory.uiValues['panel.width.left'] === 'number' &&
        typeof snapshotInventory.uiValues['panel.activeApp'] === 'string',
    );
    report(
      'mandatory rule: every persisted ui key rides in the snapshot (no exception)',
      JSON.stringify(snapshotInventory.liveKeys) === JSON.stringify(snapshotInventory.snapKeys),
      `live=[${snapshotInventory.liveKeys}] snap=[${snapshotInventory.snapKeys}]`,
    );

    await page.click('.sf-docker-app[title="Explorer"]');
    await page.waitForTimeout(300);
    await dragPanel(page, 'left', -90);
    await dragPanel(page, 'right', -90);
    await page.click('.sf-subsection-header:has-text("Outline")');
    await page.waitForTimeout(200);
    await page.click('.sf-panel-tab:has-text("TODO")');
    await page.waitForTimeout(200);
    await page.click('.sf-docker-app[title="Search"]');
    await page.waitForTimeout(300);
    const mutatedLeft = await panelWidth(page, 'left');
    const mutatedRight = await panelWidth(page, 'right');
    report(
      'state mutated away from the saved workspace',
      Math.abs(mutatedLeft - wLeft1) > 50 && Math.abs(mutatedRight - wRight1) > 50,
    );

    await openWsPanel(page);
    await page
      .locator('.sf-ws-item', { hasText: wsName })
      .locator('.sf-ws-btn[title="Load this workspace"]')
      .click();
    await page.waitForTimeout(500);
    report('load restores the left panel width', near(await panelWidth(page, 'left'), wLeft1));
    report('load restores the right panel width', near(await panelWidth(page, 'right'), wRight1));
    report(
      'load restores the active docker app',
      (await page.textContent('.sf-panel-title')) === 'Workspaces',
    );

    await page.click('.sf-docker-app[title="Explorer"]');
    await page.waitForTimeout(400);
    report(
      'load restores the active section tab',
      (await page.textContent('.sf-panel-tab--active'))?.includes('Files') === true,
    );
    report('load restores collapsed sub-section', !(await page.isVisible('[data-sub-body="outline"]')));
    report(
      'load restores hidden sub-section',
      (await page.locator('.sf-subsection:has-text("Timeline")').count()) === 0,
    );
    report('load restores sub-section height', near(await subBodyHeight(page, 'project'), hProjFinal, 4));

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    report(
      'loaded workspace state survives refresh',
      near(await panelWidth(page, 'left'), wLeft1) && near(await panelWidth(page, 'right'), wRight1),
    );

    report('no console/page errors', errors.length === 0, errors.join(' | '));
  } finally {
    await finish(browser, serverProc, isFailed(), 'PERSIST CHECKS');
  }
})();
