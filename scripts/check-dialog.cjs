const { ensureServer, openApp, makeReporter, finish } = require('./lib/ui-test.cjs');

(async () => {
  const serverProc = await ensureServer();
  const { browser, page, errors } = await openApp();
  const { report, isFailed } = makeReporter();

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  async function openDemoPanel(page) {
    const panelHidden = await page.evaluate(() =>
      document.querySelector('.sf-panel--left')?.classList.contains('sf-panel--hidden'),
    );
    if (panelHidden) await page.locator('.sf-docker-app[title="Explorer"]').click();
    const demo = page.locator('.sf-dialog-demo');
    await demo.scrollIntoViewIfNeeded();
    await demo.waitFor({ state: 'visible', timeout: 10000 });
    await delay(200);
    return demo;
  }

  try {
    await openDemoPanel(page);
    report('demo panel hosts the popup trigger', (await page.locator('.sf-dialog-demo-open').count()) === 1);

    await page.locator('.sf-dialog-demo-open').click();
    await delay(150);
    const dialog = page.locator('.sf-dialog');
    await dialog.waitFor({ state: 'visible', timeout: 5000 });

    const placement = await page.evaluate(() => ({
      inRoot: !!document.querySelector('.sf-root .sf-dialog'),
      role: document.querySelector('.sf-dialog')?.getAttribute('role'),
      modal: document.querySelector('.sf-dialog')?.getAttribute('aria-modal'),
      title: document.querySelector('.sf-dialog-title')?.textContent,
      backdropFixed: getComputedStyle(document.querySelector('.sf-dialog-backdrop')).position,
    }));
    report(
      'dialog teleports into the framework root as a modal with its title',
      placement.inRoot &&
        placement.role === 'dialog' &&
        placement.modal === 'true' &&
        placement.title === 'Edit element' &&
        placement.backdropFixed === 'fixed',
      JSON.stringify(placement),
    );

    const desktopChrome = await page.evaluate(() => {
      const head = document.querySelector('.sf-dialog-head').getBoundingClientRect();
      const close = document.querySelector('.sf-dialog-close').getBoundingClientRect();
      const card = document.querySelector('.sf-dialog').getBoundingClientRect();
      const input = document.querySelector('.sf-dialog-input').getBoundingClientRect();
      return {
        headH: head.height,
        closeW: close.width,
        closeH: close.height,
        cardW: card.width,
        inputH: Math.round(input.height * 10) / 10,
      };
    });
    report(
      'desktop: compact title bar with a small square close button',
      desktopChrome.headH >= 30 &&
        desktopChrome.headH <= 46 &&
        desktopChrome.closeW === 22 &&
        desktopChrome.closeH === 22 &&
        desktopChrome.cardW <= 440 &&
        desktopChrome.inputH === 36,
      JSON.stringify(desktopChrome),
    );

    const footSizes = await page.evaluate(() =>
      [...document.querySelectorAll('.sf-dialog-foot .sf-dialog-btn')].map((b) => {
        const r = b.getBoundingClientRect();
        return `${Math.round(r.width)}x${Math.round(r.height)}`;
      }),
    );
    report(
      'desktop: footer action buttons share one size',
      footSizes.length === 2 && footSizes[0] === footSizes[1],
      JSON.stringify(footSizes),
    );

    await page.locator('#sf-dialog-demo-name').fill('hero-banner');
    await page.locator('.sf-dialog-foot .sf-dialog-btn--accent').click();
    await delay(150);
    const saved = await page.evaluate(() => ({
      closed: document.querySelector('.sf-dialog') === null,
      status: document.querySelector('.sf-dialog-demo-status')?.textContent,
    }));
    report(
      'saving from the footer closes the popup and reports the payload',
      saved.closed && saved.status.includes('saved hero-banner · workspace'),
      JSON.stringify(saved),
    );

    await page.locator('.sf-dialog-demo-open').click();
    await delay(150);
    await page.keyboard.press('Escape');
    await delay(150);
    report('escape closes the popup', (await page.locator('.sf-dialog').count()) === 0);

    await page.locator('.sf-dialog-demo-open').click();
    await delay(150);
    await page.mouse.click(8, 8);
    await delay(150);
    report('clicking the backdrop closes the popup', (await page.locator('.sf-dialog').count()) === 0);

    await page.locator('.sf-dialog-demo-open').click();
    await delay(150);
    await page.locator('.sf-dialog-close').click();
    await delay(150);
    report('the title bar close button closes the popup', (await page.locator('.sf-dialog').count()) === 0);

    report('desktop: no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

    const mobileCtx = await browser.newContext({ viewport: { width: 390, height: 700 } });
    const mpage = await mobileCtx.newPage();
    const mobileErrors = [];
    mpage.on('pageerror', (e) => mobileErrors.push(`pageerror: ${e.message}`));
    mpage.on('console', (m) => {
      if (m.type() === 'error') mobileErrors.push(`console: ${m.text()}`);
    });
    await mpage.goto(`http://localhost:${process.env.SF_TEST_PORT || '7493'}/`, {
      waitUntil: 'networkidle',
      timeout: 15000,
    });
    await mpage.waitForFunction(() => (document.getElementById('framework')?.innerHTML.length ?? 0) > 1000, {
      timeout: 10000,
    });

    await mpage.locator('.sf-docker-app[title="Explorer"]').click();
    await delay(300);
    const mdemo = mpage.locator('.sf-dialog-demo');
    await mdemo.scrollIntoViewIfNeeded();
    await mdemo.waitFor({ state: 'visible', timeout: 10000 });
    await mdemo.locator('.sf-dialog-demo-open').click();
    await delay(200);
    await mpage.locator('.sf-dialog').waitFor({ state: 'visible', timeout: 5000 });

    const mobileRoot = await mpage.evaluate(() =>
      document.querySelector('.sf-root')?.classList.contains('sf-root--mobile'),
    );
    report('mobile viewport switches the framework root', mobileRoot === true);

    const mobileChrome = await mpage.evaluate(() => {
      const head = document.querySelector('.sf-dialog-head').getBoundingClientRect();
      const close = document.querySelector('.sf-dialog-close').getBoundingClientRect();
      const card = document.querySelector('.sf-dialog').getBoundingClientRect();
      const save = document.querySelector('.sf-dialog-foot .sf-dialog-btn--accent').getBoundingClientRect();
      const input = document.querySelector('.sf-dialog-input').getBoundingClientRect();
      return {
        headH: head.height,
        headW: head.width,
        cardW: card.width,
        closeW: close.width,
        closeH: close.height,
        saveH: save.height,
        inputH: Math.round(input.height * 10) / 10,
      };
    });
    report(
      'mobile: title bar widens to a 60px strip with a 60x60 close target',
      mobileChrome.headH >= 60 &&
        mobileChrome.closeW >= 60 &&
        mobileChrome.closeH >= 60 &&
        mobileChrome.headW >= mobileChrome.cardW - 2 &&
        mobileChrome.inputH === 36,
      JSON.stringify(mobileChrome),
    );
    report(
      'mobile: footer action buttons reach a 44px touch height',
      mobileChrome.saveH >= 44,
      JSON.stringify(mobileChrome),
    );

    const fitArea = await mpage.evaluate(() => {
      const body = document.querySelector('.sf-dialog-body');
      const tall = document.createElement('div');
      tall.style.height = '3000px';
      body.appendChild(tall);
      const card = document.querySelector('.sf-dialog').getBoundingClientRect();
      const bcs = getComputedStyle(document.querySelector('.sf-dialog-backdrop'));
      const out = {
        top: Math.round(card.top * 10) / 10,
        bottom: Math.round(card.bottom * 10) / 10,
        padTop: bcs.paddingTop,
        padBottom: bcs.paddingBottom,
        vh: window.innerHeight,
      };
      tall.remove();
      return out;
    });
    report(
      'mobile: the backdrop reserves the top bar and docker so the popup cannot leave the main area',
      fitArea.padTop === '70px' &&
        fitArea.padBottom === '108px' &&
        fitArea.top >= 59.5 &&
        fitArea.bottom <= fitArea.vh - 60 - 38 + 0.5,
      JSON.stringify(fitArea),
    );

    const mobileFootSizes = await mpage.evaluate(() =>
      [...document.querySelectorAll('.sf-dialog-foot .sf-dialog-btn')].map((b) => {
        const r = b.getBoundingClientRect();
        return `${Math.round(r.width)}x${Math.round(r.height)}`;
      }),
    );
    report(
      'mobile: footer action buttons share one size',
      mobileFootSizes.length === 2 && mobileFootSizes[0] === mobileFootSizes[1],
      JSON.stringify(mobileFootSizes),
    );

    const corner = await mpage.evaluate(() => {
      const close = getComputedStyle(document.querySelector('.sf-dialog-close'));
      const card = getComputedStyle(document.querySelector('.sf-dialog'));
      return {
        closeTR: close.borderTopRightRadius,
        cardTR: card.borderTopRightRadius,
      };
    });

    const noPan = await mpage.evaluate(() => {
      const body = document.querySelector('.sf-dialog-body');
      const wide = document.createElement('div');
      wide.style.width = '9999px';
      wide.style.height = '2px';
      body.appendChild(wide);
      const r = body.getBoundingClientRect();
      const input = document.querySelector('.sf-dialog-body input');
      return {
        ox: getComputedStyle(body).overflowX,
        overflowReal: body.scrollWidth > body.clientWidth + 1,
        wheelX: Math.round(r.left + Math.min(120, r.width / 2)),
        wheelY: Math.round(r.top + r.height / 2),
        inputFont: input ? getComputedStyle(input).fontSize : null,
      };
    });
    await mpage.mouse.move(noPan.wheelX, noPan.wheelY);
    await mpage.mouse.wheel(180, 0);
    await delay(200);
    const noPanAfter = await mpage.evaluate(() => {
      const body = document.querySelector('.sf-dialog-body');
      const v = body.scrollLeft;
      body.querySelector('div[style*="9999px"]')?.remove();
      return v;
    });
    report(
      'mobile: the dialog body never pans horizontally, even with overflowing content',
      noPan.ox === 'hidden' && noPan.overflowReal && noPanAfter === 0,
      JSON.stringify({ ...noPan, noPanAfter }),
    );
    report(
      'mobile: dialog form inputs render at 16px so iOS never zooms the viewport on focus',
      noPan.inputFont === '16px',
      JSON.stringify(noPan),
    );

    report(
      'mobile: the close button follows the card rounded top-right corner',
      parseFloat(corner.closeTR) > 0 && parseFloat(corner.closeTR) >= parseFloat(corner.cardTR) - 1.5,
      JSON.stringify(corner),
    );

    await mpage.locator('.sf-dialog-close').click();
    await delay(150);
    report(
      'mobile: tapping the widened close target closes the popup',
      (await mpage.locator('.sf-dialog').count()) === 0,
    );

    report('mobile: no page errors', mobileErrors.length === 0, mobileErrors.slice(0, 3).join(' | '));
    await mobileCtx.close();
  } catch (e) {
    console.error('crashed:', e);
    process.exitCode = 1;
  } finally {
    await finish(browser, serverProc, isFailed() || process.exitCode === 1, 'DIALOG CHECKS');
  }
})();
