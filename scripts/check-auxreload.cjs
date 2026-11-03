const {
  ensureServer,
  makeReporter,
  finish,
  detachToPopup,
  openResourceTab,
  URL,
} = require('./lib/ui-test.cjs');

const TAB_RES = 'aux-re-a';
const TAB_RES2 = 'aux-re-b';
const TAB_JOIN = 'aux-re-c';
const TAB_CLOSE = 'aux-re-d';
const TAB_CRASH = 'aux-crash-x';

async function openReady(context) {
  const page = await context.newPage();
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForFunction(() => (document.getElementById('framework')?.innerHTML.length ?? 0) > 1000, {
    timeout: 10000,
  });
  await page.waitForFunction(() => !!window.__sfWorkspace, { timeout: 10000 });
  return page;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const serverProc = await ensureServer();
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const { report, isFailed } = makeReporter();
  const errors = [];
  const watchPage = (p) => {
    p.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    p.on('console', (m) => {
      if (m.type() === 'error') errors.push(`console: ${m.text()}`);
    });
  };

  try {
    {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      context.on('page', watchPage);
      const page = await openReady(context);
      await openResourceTab(page, TAB_RES, 'Reload A');
      const aux = await detachToPopup(context, page, TAB_RES);
      const sizeBefore = await aux.viewportSize();
      await wait(700);
      const saved = await page.evaluate((tabId) => {
        const snap = JSON.parse(localStorage.getItem('sf.workspace.layout') ?? '{}');
        const w = (snap.auxWindows ?? [])[0];
        return {
          id: w?.id,
          hasTab: JSON.stringify(w?.roots ?? []).includes(tabId),
          geometry: !!w?.geometry,
          auxIds: snap.aux,
        };
      }, TAB_RES);
      report(
        'auto-saved snapshot records the aux window, its tree and geometry',
        saved.id === 1 && saved.hasTab && saved.geometry && saved.auxIds.includes(TAB_RES),
        JSON.stringify(saved),
      );

      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForFunction(() => !!window.__sfWorkspace, { timeout: 15000 });
      await aux.waitForSelector(`[data-test="aux-content"] .sf-tab[data-tab-id="${TAB_RES}"]`, {
        timeout: 10000,
      });
      report(
        'popup survives the refresh without being recreated',
        !aux.isClosed() && (await aux.viewportSize()).width === sizeBefore.width,
        `before=${JSON.stringify(sizeBefore)} after=${JSON.stringify(await aux.viewportSize())}`,
      );
      report(
        'detached tab stays in the popup after refresh',
        await page.evaluate((id) => window.__sfWorkspace.tabWindow(id) === 1, TAB_RES),
      );
      report(
        'main window does not merge the detached tab back',
        (await page.locator(`.sf-tab[data-tab-id="${TAB_RES}"]`).count()) === 0 &&
          (await aux.locator(`.sf-tab[data-tab-id="${TAB_RES}"]`).count()) === 1,
      );
      report(
        'tab content is hosted inside the popup document',
        (await aux.locator(`[data-tab-slot="${TAB_RES}"] .sf-resource-demo`).count()) === 1 &&
          (await page.locator(`[data-tab-slot="${TAB_RES}"]`).count()) === 0,
      );

      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForFunction(() => !!window.__sfWorkspace, { timeout: 15000 });
      await aux.waitForSelector(`[data-tab-slot="${TAB_RES}"] .sf-resource-demo`, { timeout: 10000 });
      report(
        'a second refresh re-adopts the same popup window',
        !aux.isClosed() &&
          (await page.evaluate((id) => window.__sfWorkspace.tabWindow(id) === 1, TAB_RES)) &&
          (await aux.locator(`.sf-tab[data-tab-id="${TAB_RES}"]`).count()) === 1,
      );
      await context.close();
    }

    {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      context.on('page', watchPage);
      const page = await openReady(context);
      await openResourceTab(page, TAB_RES, 'Reload A');
      await openResourceTab(page, TAB_RES2, 'Reload B');
      await openResourceTab(page, TAB_JOIN, 'Reload C');
      const aux1 = await detachToPopup(context, page, TAB_RES);
      const aux2 = await detachToPopup(context, page, TAB_RES2);
      await page.evaluate(
        (ids) => {
          const api = window.__sfWorkspace;
          api.ops.detachTab(ids[1], { windowId: 1 });
          const tile = api.auxApi(1).findTabGlobal(ids[0]);
          api.auxApi(1).ops.splitTile(tile.id, 'row', 'end', ids[1]);
        },
        [TAB_RES, TAB_JOIN],
      );
      await aux1.waitForSelector(`.sf-tab[data-tab-id="${TAB_JOIN}"]`, { timeout: 5000 });
      report(
        'two popups: split tree in window 1, own tab in window 2',
        await page.evaluate(
          (ids) =>
            window.__sfWorkspace.auxWindowIds.join(',') === '1,2' &&
            window.__sfWorkspace.tabWindow(ids[0]) === 1 &&
            window.__sfWorkspace.tabWindow(ids[2]) === 1 &&
            window.__sfWorkspace.tabWindow(ids[1]) === 2 &&
            window.__sfWorkspace.auxApi(1).findTabGlobal(ids[0]).id !==
              window.__sfWorkspace.auxApi(1).findTabGlobal(ids[2]).id,
          [TAB_RES, TAB_RES2, TAB_JOIN],
        ),
      );

      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForFunction(() => !!window.__sfWorkspace, { timeout: 15000 });
      await aux1.waitForSelector(`[data-tab-slot="${TAB_JOIN}"] .sf-resource-demo`, { timeout: 10000 });
      await aux2.waitForSelector(`[data-tab-slot="${TAB_RES2}"] .sf-resource-demo`, { timeout: 10000 });
      report(
        'refresh restores both popups with their own tabs and tree shape',
        await page.evaluate(
          (ids) =>
            window.__sfWorkspace.tabWindow(ids[0]) === 1 &&
            window.__sfWorkspace.tabWindow(ids[2]) === 1 &&
            window.__sfWorkspace.tabWindow(ids[1]) === 2 &&
            window.__sfWorkspace.auxApi(1).findTabGlobal(ids[0]).id !==
              window.__sfWorkspace.auxApi(1).findTabGlobal(ids[2]).id,
          [TAB_RES, TAB_RES2, TAB_JOIN],
        ),
      );
      report(
        'each popup document hosts exactly its own tabs',
        (await aux1.locator('.sf-tab').count()) === 2 &&
          (await aux2.locator('.sf-tab').count()) === 1 &&
          (await page.locator('.sf-tab[data-tab-id^="aux-re-"]').count()) === 0,
      );
      await context.close();
    }

    {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      context.on('page', watchPage);
      const page = await openReady(context);
      await openResourceTab(page, TAB_CLOSE, 'Reload D');
      const aux = await detachToPopup(context, page, TAB_CLOSE);
      await aux.close();
      await page.waitForFunction((id) => window.__sfWorkspace.tabWindow(id) === 0, TAB_CLOSE, {
        timeout: 5000,
      });
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForFunction(() => !!window.__sfWorkspace, { timeout: 15000 });
      await wait(800);
      report(
        'closing the popup before refresh keeps the tab in the main window',
        (await page.evaluate((id) => window.__sfWorkspace.tabWindow(id) === 0, TAB_CLOSE)) &&
          (await page.locator(`.sf-tab[data-tab-id="${TAB_CLOSE}"]`).count()) === 1 &&
          (await page.evaluate(() => window.__sfWorkspace.auxWindowIds.length === 0)) &&
          context.pages().length === 1,
      );
      await context.close();
    }

    {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      context.on('page', watchPage);
      await context.addInitScript((id) => {
        if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
        localStorage.setItem(
          'sf.workspace.layout',
          JSON.stringify({
            version: 1,
            rootDir: null,
            roots: [{ ratio: 1, node: { kind: 'tile', tabs: [], activeId: '' } }],
            aux: [id],
            defs: {
              [id]: { id, label: 'Crash', icon: '🧩', content: 'resource-demo', props: { code: 'res-a' } },
            },
            auxWindows: [
              {
                id: 7,
                rootDir: null,
                roots: [{ ratio: 1, node: { kind: 'tile', tabs: [id], activeId: id } }],
                geometry: { left: 40, top: 60, width: 520, height: 420 },
              },
            ],
          }),
        );
      }, TAB_CRASH);
      const page = await openReady(context);
      const aux = context.pages().find((p) => p !== page);
      report(
        'crash-style snapshot recreates the popup from recorded geometry',
        !!aux &&
          (await page.evaluate((id) => window.__sfWorkspace.tabWindow(id) === 7, TAB_CRASH)) &&
          (await page.evaluate((id) => !!window.__sfWorkspace.auxApi(7)?.findTabGlobal(id), TAB_CRASH)),
      );
      if (aux) {
        await aux.waitForSelector(`[data-tab-slot="${TAB_CRASH}"] .sf-resource-demo`, { timeout: 10000 });
        const size = await aux.viewportSize();
        report(
          'recreated popup uses the recorded width and height',
          Math.abs(size.width - 520) <= 2 && Math.abs(size.height - 420) <= 2,
          JSON.stringify(size),
        );
      }
      await context.close();
    }

    {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      context.on('page', watchPage);
      await context.addInitScript(() => {
        const orig = window.open.bind(window);
        window.open = (url, name, features) =>
          typeof name === 'string' && name.startsWith('sf-aux-') ? null : orig(url, name, features);
      });
      await context.addInitScript((id) => {
        if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
        localStorage.setItem(
          'sf.workspace.layout',
          JSON.stringify({
            version: 1,
            rootDir: null,
            roots: [{ ratio: 1, node: { kind: 'tile', tabs: [], activeId: '' } }],
            aux: [id],
            defs: {
              [id]: { id, label: 'Blocked', icon: '🧩', content: 'resource-demo', props: { code: 'res-a' } },
            },
            auxWindows: [
              {
                id: 4,
                rootDir: null,
                roots: [{ ratio: 1, node: { kind: 'tile', tabs: [id], activeId: id } }],
              },
            ],
          }),
        );
      }, TAB_CRASH);
      const page = await openReady(context);
      await page.waitForSelector(`.sf-tab[data-tab-id="${TAB_CRASH}"]`, { timeout: 10000 });
      report(
        'unopenable aux window folds its tabs back into the main window',
        (await page.evaluate((id) => window.__sfWorkspace.tabWindow(id) === 0, TAB_CRASH)) &&
          (await page.evaluate(() => window.__sfWorkspace.auxWindowIds.length === 0)) &&
          context.pages().length === 1,
      );
      await context.close();
    }

    {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      context.on('page', watchPage);
      const page = await openReady(context);
      await openResourceTab(page, TAB_RES, 'Reload A');
      const aux = await detachToPopup(context, page, TAB_RES);
      report(
        'orphan watchdog is installed in the popup realm',
        await aux.evaluate(() => typeof window.__sfAuxWatchdog === 'number'),
      );
      await page.close();
      const start = Date.now();
      while (!aux.isClosed() && Date.now() - start < 8000) await wait(200);
      report('closing the main window makes the popup close itself', aux.isClosed());
      await context.close();
    }

    report('no page errors on any window', errors.length === 0, errors.join(' | ').slice(0, 300));
  } catch (e) {
    report('suite completed', false, String(e));
  } finally {
    await finish(browser, serverProc, isFailed(), 'AUX RELOAD');
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
