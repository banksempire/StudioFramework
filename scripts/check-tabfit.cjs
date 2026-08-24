const { chromium } = require('playwright');
const { ensureServer, makeReporter, finish } = require('./lib/ui-test.cjs');

(async () => {
  const serverProc = await ensureServer();
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    if (!sessionStorage.getItem('tabfit-check-cleared')) {
      sessionStorage.setItem('tabfit-check-cleared', '1');
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

  const cssVar = (name) =>
    page.evaluate((n) => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(n)), name);
  const minW = await cssVar('--sf-tab-min-width');
  const maxW = await cssVar('--sf-tab-max-width');

  const tabCount = () => page.locator('.sf-tab').count();
  const barInfo = () =>
    page.evaluate(() => {
      const bar = document.querySelector('.sf-tile-tabs-inner');
      if (!bar) return null;
      const widths = Array.from(bar.children)
        .filter((t) => t.classList.contains('sf-tab'))
        .map((t) => t.getBoundingClientRect().width);
      return { cw: bar.clientWidth, sw: bar.scrollWidth, ox: getComputedStyle(bar).overflowX, widths };
    });
  const widthOfLabel = (label) =>
    page.evaluate((l) => {
      const tabs = Array.from(document.querySelectorAll('.sf-tile-tabs-inner .sf-tab'));
      const t = tabs.find((x) => x.querySelector('.sf-tab-label')?.textContent === l);
      return t ? t.getBoundingClientRect().width : 0;
    }, label);
  const inRange = (widths) => widths.length > 0 && widths.every((w) => w >= minW - 0.5 && w <= maxW + 0.5);

  report('css vars: min <= max, min wide enough for icon + close', minW > 0 && maxW > 0 && minW <= maxW);

  const base = await barInfo();
  report(
    'baseline: 4 tabs, natural widths differ, no scroll, all within [min, max]',
    (await tabCount()) === 4 &&
      base !== null &&
      base.sw <= base.cw + 1 &&
      new Set(base.widths.map((w) => Math.round(w))).size > 1 &&
      inRange(base.widths),
  );
  report(
    'baseline: longer title claims more width',
    (await widthOfLabel('framework.ts')) > (await widthOfLabel('utils.ts')),
  );
  report(
    'baseline: active tab close button visible',
    await page.evaluate(() => {
      const el = document.querySelector('.sf-tab.active .sf-tab-close');
      return el ? getComputedStyle(el).visibility === 'visible' : false;
    }),
  );

  const tid = await page.evaluate(() => {
    const api = window.__sfWorkspace;
    const walk = (node) => (node.kind === 'tile' ? node.id : walk(node.children[0]));
    return walk(api.roots[0].node);
  });
  await page.evaluate((id) => {
    const api = window.__sfWorkspace;
    api.ops.openTab(id, { id: 'mix-short', label: 's', icon: '📄' });
    api.ops.openTab(id, {
      id: 'mix-long',
      label: 'a-rather-long-label-that-refuses-to-shrink.ts',
      icon: '📄',
    });
  }, tid);
  await page.waitForTimeout(300);
  const mix = await barInfo();
  report(
    'mix: short tab floors at min, long tab wider, no scroll, all in range',
    mix !== null &&
      mix.sw <= mix.cw + 1 &&
      inRange(mix.widths) &&
      (await widthOfLabel('s')) >= minW - 0.5 &&
      (await widthOfLabel('a-rather-long-label-that-refuses-to-shrink.ts')) >
        (await widthOfLabel('utils.ts')),
  );

  page.evaluate(() => {
    const api = window.__sfWorkspace;
    api.ops.closeTab('mix-short');
    api.ops.closeTab('mix-long');
  });
  await page.waitForTimeout(200);

  await page.evaluate((id) => {
    const api = window.__sfWorkspace;
    const walk = (node) => (node.kind === 'tile' ? node : walk(node.children[0]));
    const tile = walk(api.roots[0].node);
    window.__sqSavedTabs = tile.tabs.map((t) => api.tabDefs[t]);
    window.__sqSavedActive = tile.activeId;
    for (const t of tile.tabs) api.ops.closeTab(t);
    api.ops.openTab(id, {
      id: 'sq-long-1',
      label: 'squeeze-me-a-rather-long-label-number-one.tsx',
      icon: '📄',
    });
    api.ops.openTab(id, {
      id: 'sq-long-2',
      label: 'squeeze-me-a-rather-long-label-number-two.tsx',
      icon: '📄',
    });
    api.ops.openTab(id, {
      id: 'sq-long-3',
      label: 'squeeze-me-a-rather-long-label-number-three.tsx',
      icon: '📄',
    });
    api.ops.openTab(id, { id: 'sq-short', label: 'New Chat', icon: '💬' });
  }, tid);
  await page.waitForTimeout(300);
  const squeezeStates = [];
  for (let vw = 1440; vw >= 820; vw -= 15) {
    await page.setViewportSize({ width: vw, height: 900 });
    await page.waitForTimeout(40);
    squeezeStates.push(
      await page.evaluate(() => {
        const bar = document.querySelector('.sf-tile-tabs-inner');
        const w = {};
        for (const t of bar.querySelectorAll('.sf-tab')) {
          if (t.dataset.tabId.startsWith('sq-')) w[t.dataset.tabId] = t.getBoundingClientRect().width;
        }
        return { cw: bar.clientWidth, sw: bar.scrollWidth, w };
      }),
    );
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(200);
  await page.evaluate((id) => {
    const api = window.__sfWorkspace;
    for (const [i, def] of window.__sqSavedTabs.entries()) api.ops.insertTab(id, i, def);
    api.ops.activateTab(id, window.__sqSavedActive);
    for (const t of ['sq-long-1', 'sq-long-2', 'sq-long-3', 'sq-short']) api.ops.closeTab(t);
  }, tid);
  await page.waitForTimeout(200);
  const sqShort = (s) => s.w['sq-short'];
  const sqLongMax = (s) => Math.max(s.w['sq-long-1'], s.w['sq-long-2'], s.w['sq-long-3']);
  const fitted = squeezeStates.filter((s) => s.sw <= s.cw + 1);
  report(
    'squeeze: short tab never floors while long siblings still sit at max (uniform shrink)',
    fitted.length > 0 && fitted.every((s) => sqShort(s) > minW - 0.5 || sqLongMax(s) < maxW - 0.5),
  );
  report(
    'squeeze: long tabs leave the cap while the short tab is still above the floor',
    fitted.some((s) => sqLongMax(s) < maxW - 0.5 && sqShort(s) > minW + 0.5),
  );

  await page.evaluate((id) => {
    const api = window.__sfWorkspace;
    for (let i = 0; i < 24; i++) {
      api.ops.openTab(id, {
        id: `bulk-${i}`,
        label: `bulk-file-${i}-with-a-rather-long-name-that-refuses-to-shrink.ts`,
        icon: '📄',
      });
    }
  }, tid);
  await page.waitForFunction(
    () => document.querySelectorAll('.sf-tile-tabs-inner .sf-tab').length === 28,
    null,
    {
      timeout: 5000,
    },
  );
  await page.waitForTimeout(100);
  const crowd = await barInfo();
  report(
    '28 tabs: bar overflows into horizontal scroll, every tab floored at min',
    crowd !== null &&
      crowd.sw > crowd.cw + 1 &&
      crowd.ox === 'auto' &&
      crowd.widths.every((w) => w <= minW + 0.5),
  );
  report(
    '28 tabs: bar actually scrolls sideways',
    await page.evaluate(() => {
      const bar = document.querySelector('.sf-tile-tabs-inner');
      if (!bar) return false;
      bar.scrollLeft = 9999;
      const moved = bar.scrollLeft > 0;
      bar.scrollLeft = 0;
      return moved;
    }),
  );
  await page.evaluate((id) => {
    window.__sfWorkspace.ops.activateTab(id, 'bulk-0');
  }, tid);
  await page.waitForTimeout(200);
  await page.evaluate((id) => {
    window.__sfWorkspace.ops.activateTab(id, 'bulk-23');
  }, tid);
  await page.waitForTimeout(200);
  report(
    'activating an off-screen tab scrolls it into view',
    await page.evaluate(() => {
      const bar = document.querySelector('.sf-tile-tabs-inner');
      return bar ? bar.scrollLeft > 0 : false;
    }),
  );
  report(
    '28 tabs: close button still rendered inside the floored tab',
    await page.evaluate(() => {
      const tab = document.querySelector('.sf-tab.active');
      const btn = tab?.querySelector('.sf-tab-close');
      if (!tab || !btn) return false;
      const tr = tab.getBoundingClientRect();
      const br = btn.getBoundingClientRect();
      return (
        getComputedStyle(btn).visibility === 'visible' && br.right <= tr.right + 0.5 && br.left >= tr.left
      );
    }),
  );

  await page.setViewportSize({ width: 3200, height: 900 });
  await page.waitForTimeout(400);
  const wide = await barInfo();
  report(
    'wide window: scroll released, tabs un-floored but still shrunk below max (proportional squeeze)',
    wide !== null &&
      wide.sw <= wide.cw + 1 &&
      inRange(wide.widths) &&
      Math.max(...wide.widths) < maxW - 1 &&
      (await widthOfLabel('bulk-file-0-with-a-rather-long-name-that-refuses-to-shrink.ts')) >
        (await widthOfLabel('utils.ts')) + 1,
  );

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(400);
  const narrow = await barInfo();
  report(
    'narrowing again re-floors all tabs and restores horizontal scroll',
    narrow !== null && narrow.sw > narrow.cw + 1 && narrow.widths.every((w) => w <= minW + 0.5),
  );

  await page.evaluate(() => {
    const api = window.__sfWorkspace;
    for (let i = 0; i < 24; i++) api.ops.closeTab(`bulk-${i}`);
  });
  await page.waitForTimeout(300);
  const done = await barInfo();
  report(
    'back to 4 tabs: widths recover to natural, no scroll, close button visible',
    (await tabCount()) === 4 &&
      done !== null &&
      done.sw <= done.cw + 1 &&
      new Set(done.widths.map((w) => Math.round(w))).size > 1 &&
      (await page.evaluate(() => {
        const el = document.querySelector('.sf-tab.active .sf-tab-close');
        return el ? getComputedStyle(el).visibility === 'visible' : false;
      })),
  );

  report('no page errors during the whole check', errors.length === 0, errors.join('; ').slice(0, 300));

  await finish(browser, serverProc, isFailed(), 'TABFIT CHECKS');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
