const { ensureServer, makeReporter, finish, URL: APP_URL } = require('./lib/ui-test.cjs');
const { chromium } = require('playwright');

const TRANSFER_PREFIX = 'sf.aux.transfer.';

async function waitForReady(page) {
  await page.waitForFunction(
    () => {
      const fw = document.getElementById('framework');
      if (fw?.querySelector('.sf-root--aux')) return true;
      return (fw?.innerHTML.length ?? 0) > 1000;
    },
    undefined,
    { timeout: 20000 },
  );
}

async function newApp(context, query = '') {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  await page.goto(APP_URL + query, { waitUntil: 'networkidle', timeout: 20000 });
  await waitForReady(page);
  return { page, errors };
}

async function tabLabel(page, tabId) {
  return page.$eval(`[data-tab-id="${tabId}"] .sf-tab-label`, (el) => el.textContent.trim());
}

async function hasTab(page, tabId) {
  return (await page.$(`[data-tab-id="${tabId}"]`)) !== null;
}

async function tabCountByLabel(page, label) {
  return page.$$eval(
    '.sf-tab-label',
    (els, want) => els.filter((el) => el.textContent.trim() === want).length,
    label,
  );
}

async function transferKeys(page) {
  return page.evaluate(
    (prefix) => Object.keys(localStorage).filter((k) => k.startsWith(prefix)),
    TRANSFER_PREFIX,
  );
}

async function dispatchTabDrag(
  page,
  tabId,
  { dragend = false, start = true, screenX = 0, screenY = 0 } = {},
) {
  await page.$eval(
    `[data-tab-id="${tabId}"]`,
    (el, opts) => {
      const dt = new DataTransfer();
      if (opts.start) {
        el.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
      }
      if (opts.dragend) {
        el.dispatchEvent(
          new DragEvent('dragend', {
            bubbles: true,
            dataTransfer: dt,
            screenX: opts.screenX,
            screenY: opts.screenY,
          }),
        );
      }
    },
    { dragend, start, screenX, screenY },
  );
}

async function dispatchTabDragByLabel(page, label, { dragend = false, screenX = 0, screenY = 0 } = {}) {
  await page.evaluate(
    ({ label, opts }) => {
      const tabs = [...document.querySelectorAll('.sf-tab')];
      const el = tabs.find((t) => t.querySelector('.sf-tab-label')?.textContent.trim() === label);
      if (!el) throw new Error(`tab not found by label: ${label}`);
      const dt = new DataTransfer();
      el.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
      if (opts.dragend) {
        el.dispatchEvent(
          new DragEvent('dragend', {
            bubbles: true,
            dataTransfer: dt,
            screenX: opts.screenX,
            screenY: opts.screenY,
          }),
        );
      }
    },
    { label, opts: { dragend, screenX, screenY } },
  );
}

async function waitForLabelCount(page, label, expected) {
  await page.waitForFunction(
    ({ label, expected }) =>
      [...document.querySelectorAll('.sf-tab-label')].filter((el) => el.textContent.trim() === label)
        .length === expected,
    { label, expected },
    { timeout: 8000 },
  );
}

async function dispatchDragOver(page) {
  const box = await (await page.$('.sf-tile')).boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + Math.min(120, box.height / 4);
  await page.evaluate(
    ({ cx, cy }) => {
      const el = document.elementFromPoint(cx, cy);
      const dt = new DataTransfer();
      el.dispatchEvent(
        new DragEvent('dragover', {
          bubbles: true,
          cancelable: true,
          dataTransfer: dt,
          clientX: cx,
          clientY: cy,
        }),
      );
    },
    { cx, cy },
  );
}

async function dropTransferOnWorkspace(page, token) {
  const box = await (await page.$('.sf-tile')).boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + Math.min(120, box.height / 4);
  await page.evaluate(
    ({ token, cx, cy }) => {
      const el = document.elementFromPoint(cx, cy);
      const dt = new DataTransfer();
      dt.setData('application/x-sf-tab-transfer', token);
      el.dispatchEvent(
        new DragEvent('dragover', {
          bubbles: true,
          cancelable: true,
          dataTransfer: dt,
          clientX: cx,
          clientY: cy,
        }),
      );
      el.dispatchEvent(
        new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          dataTransfer: dt,
          clientX: cx,
          clientY: cy,
        }),
      );
    },
    { token, cx, cy },
  );
}

(async () => {
  const serverProc = await ensureServer();
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const { report, isFailed } = makeReporter();
  for (const p of []) void p;
  const primary = await newApp(context);
  const winB = await newApp(context);
  const allErrors = () => [...primary.errors, ...winB.errors];
  let popups = 0;
  context.on('page', () => {
    popups += 1;
  });

  try {
    report('primary boots with status bar', (await primary.page.$('.sf-status-bar')) !== null);
    report('primary boots with menu bar', (await primary.page.$('.sf-menu-bar')) !== null);
    report('transfer store empty at boot', (await transferKeys(primary.page)).length === 0);

    const moveLabel = await tabLabel(primary.page, 'table-demo');
    await dispatchTabDrag(primary.page, 'table-demo');
    const keys = await transferKeys(primary.page);
    report('dragstart parks one transfer payload', keys.length === 1);
    await dropTransferOnWorkspace(winB.page, keys[0].slice(TRANSFER_PREFIX.length));
    await winB.page.waitForFunction(
      (label) =>
        [...document.querySelectorAll('.sf-tab-label')].some((el) => el.textContent.trim() === label),
      moveLabel,
      { timeout: 8000 },
    );
    await primary.page.waitForFunction(
      () => !document.querySelector('[data-tab-id="table-demo"]'),
      undefined,
      { timeout: 8000 },
    );
    report('tab moved A→B via cross-window drop', true);
    report('payload removed after cross-window claim', (await transferKeys(primary.page)).length === 0);

    await dispatchTabDragByLabel(winB.page, moveLabel);
    const keysBack = await transferKeys(winB.page);
    await dropTransferOnWorkspace(primary.page, keysBack[0].slice(TRANSFER_PREFIX.length));
    await waitForLabelCount(winB.page, moveLabel, 1);
    report('tab moved B→A the same way', true);

    const popupsBefore = popups;
    await dispatchTabDrag(primary.page, 'layout-json', { dragend: true, screenX: 10, screenY: 10 });
    await primary.page.waitForTimeout(600);
    report(
      'release inside the window never spawns a window',
      popups === popupsBefore &&
        (await hasTab(primary.page, 'layout-json')) &&
        (await transferKeys(primary.page)).length === 0,
    );

    await dispatchTabDrag(primary.page, 'layout-json');
    await dispatchDragOver(winB.page);
    await primary.page.waitForTimeout(200);
    await dispatchTabDrag(primary.page, 'layout-json', {
      dragend: true,
      start: false,
      screenX: -9999,
      screenY: -9999,
    });
    await primary.page.waitForTimeout(600);
    report(
      'release over another app window does not tear out',
      popups === popupsBefore &&
        (await hasTab(primary.page, 'layout-json')) &&
        (await transferKeys(primary.page)).length === 0,
    );

    const tearLabel = await tabLabel(primary.page, 'layout-json');
    const popupPromise = context.waitForEvent('page', { timeout: 15000 });
    await dispatchTabDrag(primary.page, 'layout-json', { dragend: true, screenX: -9999, screenY: -9999 });
    const popup = await popupPromise;
    const popupUrl = new URL(popup.url());
    await popup.waitForLoadState('networkidle', { timeout: 20000 });
    await waitForReady(popup);
    report('tear-out opens popup at release point', popupUrl.searchParams.get('aux') === '1');
    report('popup claims the parked transfer token', popupUrl.searchParams.has('transfer'));
    report('aux window has no status bar', (await popup.$('.sf-status-bar')) === null);
    report('aux window keeps the menu bar', (await popup.$('.sf-menu-bar')) !== null);
    report('aux window keeps the docker', (await popup.$('.sf-docker-app')) !== null);
    report('torn-out tab hosted in aux window', (await tabCountByLabel(popup, tearLabel)) === 1);
    await primary.page.waitForFunction(
      () => !document.querySelector('[data-tab-id="layout-json"]'),
      undefined,
      { timeout: 8000 },
    );
    report('source window drops tab after aux claim', true);
    const auxActive = await popup.$eval('.sf-tab.active .sf-tab-label', (el) => el.textContent.trim());
    report('aux document title carries tab label', (await popup.title()).includes(auxActive));
    report('payloads all consumed', (await transferKeys(primary.page)).length === 0);

    const closedPromise = new Promise((resolve) => popup.on('close', () => resolve(true)));
    await popup.$eval('.sf-tab.active .sf-tab-close', (el) =>
      el.dispatchEvent(new MouseEvent('click', { bubbles: true })),
    );
    report(
      'empty aux window auto-closes',
      await Promise.race([closedPromise, new Promise((resolve) => setTimeout(() => resolve(false), 5000))]),
    );

    await primary.page.evaluate(() => {
      window.__nativeOpen = window.open;
      window.open = () => null;
    });
    await dispatchTabDragByLabel(primary.page, moveLabel, { dragend: true, screenX: -9999, screenY: -9999 });
    await primary.page.waitForTimeout(500);
    report(
      'blocked popup shows retry banner and keeps tab',
      (await primary.page.$('.sf-aux-blocked')) !== null &&
        (await tabCountByLabel(primary.page, moveLabel)) === 1 &&
        (await transferKeys(primary.page)).length === 1,
    );
    await primary.page.evaluate(() => {
      window.open = window.__nativeOpen;
    });
    const retryPopup = context.waitForEvent('page', { timeout: 15000 });
    await primary.page.click('.sf-aux-blocked button:has-text("Open in new window")');
    const rp = await retryPopup;
    await rp.waitForLoadState('networkidle', { timeout: 20000 });
    await waitForReady(rp);
    report('banner retry opens the window', (await tabCountByLabel(rp, moveLabel)) === 1);
    await waitForLabelCount(primary.page, moveLabel, 0);
    report(
      'banner retry claim closes source tab and banner',
      (await primary.page.$('.sf-aux-blocked')) === null,
    );
    report('payloads consumed after retry', (await transferKeys(primary.page)).length === 0);

    const emptyAux = await newApp(context, '?aux=1');
    await emptyAux.page.waitForTimeout(1000);
    report('bare aux window stays open', !emptyAux.page.isClosed());
    report('bare aux shows empty placeholder', (await emptyAux.page.$('.sf-tile-empty')) !== null);
    report('bare aux has no status bar', (await emptyAux.page.$('.sf-status-bar')) === null);

    report('no page errors', allErrors().length === 0, allErrors().join(' | ').slice(0, 400));
  } catch (e) {
    report('suite completed', false, String(e));
  } finally {
    await finish(browser, serverProc, isFailed(), 'AUX WINDOW CHECKS');
  }
})();
