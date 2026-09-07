const { ensureServer, openApp, makeReporter, finish } = require('./lib/ui-test.cjs');

(async () => {
  const serverProc = await ensureServer();
  const { browser, page, errors } = await openApp();
  const { report, isFailed } = makeReporter();

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  try {
    const panelHidden = await page.evaluate(() =>
      document.querySelector('.sf-panel--left')?.classList.contains('sf-panel--hidden'),
    );
    if (panelHidden) await page.locator('.sf-docker-app[title="Explorer"]').click();
    const demo = page.locator('.sf-selector-demo');
    await demo.scrollIntoViewIfNeeded();
    await demo.waitFor({ state: 'visible', timeout: 10000 });
    await delay(200);

    const pillCount = await page.locator('.sf-selector-demo .sf-pill-item').count();
    report('pill selector renders its options', pillCount === 3, `count=${pillCount}`);

    const pillShape = await page.evaluate(() => {
      const track = document.querySelector('.sf-selector-demo .sf-pill-track');
      const cs = getComputedStyle(track);
      return { radius: cs.borderRadius, border: cs.borderTopWidth };
    });
    report(
      'pill track is a bordered pill-shaped group',
      pillShape.radius === '999px' && pillShape.border === '1px',
      JSON.stringify(pillShape),
    );

    const fontInherit = await page.evaluate(() => {
      const item = document.querySelector('.sf-selector-demo .sf-pill-item');
      return getComputedStyle(item).fontSize;
    });
    report('pill items inherit the host font size', fontInherit === '13px', fontInherit);

    await page.locator('.sf-selector-demo .sf-pill-item', { hasText: 'File' }).click();
    const pillSelect = await page.evaluate(() => {
      const items = [...document.querySelectorAll('.sf-selector-demo .sf-pill-item')];
      const pick = (t) => items.find((b) => b.textContent === t);
      return {
        fileOn: pick('File').classList.contains('sf-pill-item--on'),
        wsOn: pick('Workspace').classList.contains('sf-pill-item--on'),
        aria: pick('File').getAttribute('aria-pressed'),
        caption: document.querySelector('.sf-selector-demo-state').textContent,
      };
    });
    report(
      'clicking a pill moves the single selection and updates the model',
      pillSelect.fileOn &&
        !pillSelect.wsOn &&
        pillSelect.aria === 'true' &&
        pillSelect.caption.includes('scope=file'),
      JSON.stringify(pillSelect),
    );

    const pillWrap = await page.evaluate(() => {
      const el = document.querySelector('.sf-selector-demo .sf-pill-item--on');
      if (!el) return null;
      const before = getComputedStyle(el, '::before');
      return {
        border: `${before.borderTopWidth} ${before.borderTopStyle}`,
        borderColor: before.borderTopColor,
        bg: before.backgroundColor,
        itemBg: getComputedStyle(el).backgroundColor,
      };
    });
    report(
      'the selected pill is wrapped by the thin accent line like MultiSelectGroup',
      !!pillWrap &&
        pillWrap.border === '1px solid' &&
        pillWrap.bg !== 'rgba(0, 0, 0, 0)' &&
        pillWrap.itemBg === 'rgba(0, 0, 0, 0)',
      JSON.stringify(pillWrap),
    );

    await page.evaluate(() => {
      const s = document.createElement('style');
      s.id = 'force-pill-narrow';
      s.textContent = '.sf-selector-demo .sf-pill{max-width:300px!important}';
      document.head.appendChild(s);
    });
    await delay(150);
    const pillOneLine = await page.evaluate(() => {
      const track = document.querySelector('.sf-selector-demo .sf-pill-track');
      const items = [...track.querySelectorAll('.sf-pill-item')];
      const rows = new Set(items.map((b) => Math.round(b.getBoundingClientRect().top))).size;
      return { wrap: getComputedStyle(track).flexWrap, rows };
    });
    await page.evaluate(() => document.getElementById('force-pill-narrow')?.remove());
    report(
      'narrow containers wrap pills so none ever pan horizontally',
      pillOneLine.wrap === 'wrap' && pillOneLine.rows >= 1,
      JSON.stringify(pillOneLine),
    );

    const msInitial = await page.evaluate(() => {
      const items = [...document.querySelectorAll('.sf-selector-demo .sf-ms-item')];
      const pick = (t) => items.find((b) => b.textContent === t);
      const cs = (el) => getComputedStyle(el, '::before');
      const mon = cs(pick('Mon'));
      const tue = cs(pick('Tue'));
      const wed = cs(pick('Wed'));
      return {
        monStart: pick('Mon').classList.contains('sf-ms-item--start'),
        tueCont: pick('Tue').classList.contains('sf-ms-item--cont'),
        wedEnd: pick('Wed').classList.contains('sf-ms-item--end'),
        tueNoLeft: tue.borderLeftWidth === '0px' && tue.borderTopLeftRadius === '0px',
        monExtends: parseFloat(mon.right) < 0,
        wedCloses: wed.borderRightWidth === '1px' && parseFloat(wed.borderTopRightRadius) > 0,
      };
    });
    report(
      'consecutive multi-select items merge into one rounded box',
      Object.values(msInitial).every(Boolean),
      JSON.stringify(msInitial),
    );

    await page.locator('.sf-selector-demo .sf-ms-item', { hasText: 'Wed' }).click();
    await delay(150);
    const msSplit = await page.evaluate(() => {
      const items = [...document.querySelectorAll('.sf-selector-demo .sf-ms-item')];
      const pick = (t) => items.find((b) => b.textContent === t);
      return {
        tueEnd: pick('Tue').classList.contains('sf-ms-item--end'),
        wedOff: !pick('Wed').classList.contains('sf-ms-item--on'),
        caption: document.querySelector('.sf-selector-demo-state').textContent,
      };
    });
    report(
      'deselecting a middle item splits the run into two boxes',
      msSplit.tueEnd && msSplit.wedOff && msSplit.caption.includes('days=[1,2]'),
      JSON.stringify(msSplit),
    );

    await page.evaluate(() => {
      const s = document.createElement('style');
      s.id = 'force-ms-wrap';
      s.textContent = '.sf-selector-demo .sf-ms-track{flex-wrap:wrap!important;max-width:150px!important}';
      document.head.appendChild(s);
    });
    await page.locator('.sf-selector-demo .sf-ms-item', { hasText: 'Sun' }).click();
    await page.locator('.sf-selector-demo .sf-ms-item', { hasText: 'Wed' }).click();
    await page.locator('.sf-selector-demo .sf-ms-item', { hasText: 'Thu' }).click();
    await page.locator('.sf-selector-demo .sf-ms-item', { hasText: 'Fri' }).click();
    await page.locator('.sf-selector-demo .sf-ms-item', { hasText: 'Sat' }).click();
    await delay(250);
    const wrapped = await page.evaluate(() => {
      const track = document.querySelector('.sf-selector-demo .sf-ms-track');
      const items = [...track.querySelectorAll('.sf-ms-item')];
      const rows = new Set(items.map((b) => Math.round(b.getBoundingClientRect().top))).size;
      let boundary = -1;
      for (let i = 1; i < items.length; i++) {
        if (Math.abs(items[i].getBoundingClientRect().top - items[i - 1].getBoundingClientRect().top) > 1) {
          boundary = i;
          break;
        }
      }
      if (boundary === -1) return { rows, boundary };
      const trackStyle = getComputedStyle(track);
      const trackRadius = Number.parseFloat(trackStyle.borderTopLeftRadius);
      const inset = Number.parseFloat(trackStyle.paddingTop) + Number.parseFloat(trackStyle.borderTopWidth);
      const last = getComputedStyle(items[boundary - 1], '::before');
      const lead = getComputedStyle(items[boundary], '::before');
      return {
        rows,
        boundary: `${items[boundary - 1].textContent}|${items[boundary].textContent}`,
        lastRight: last.right,
        lastBorderRight: last.borderRightWidth,
        lastRadius: last.borderTopRightRadius,
        leadBorderLeft: lead.borderLeftWidth,
        leadRadius: lead.borderTopLeftRadius,
        expectedRadius: trackRadius - inset,
      };
    });
    await page.evaluate(() => document.getElementById('force-ms-wrap')?.remove());
    report(
      'a run crossing a wrapped row closes on the row end and reopens on the next',
      wrapped.rows >= 2 &&
        wrapped.lastRight === '0px' &&
        wrapped.lastBorderRight === '1px' &&
        parseFloat(wrapped.lastRadius) === wrapped.expectedRadius &&
        wrapped.leadBorderLeft === '1px' &&
        parseFloat(wrapped.leadRadius) === wrapped.expectedRadius,
      JSON.stringify(wrapped),
    );

    report('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  } catch (e) {
    console.error('crashed:', e);
    process.exitCode = 1;
  } finally {
    await finish(browser, serverProc, isFailed() || process.exitCode === 1, 'SELECTOR CHECKS');
  }
})();
