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
      return { headH: head.height, closeW: close.width, closeH: close.height, cardW: card.width };
    });
    report(
      'desktop: compact title bar with a small square close button',
      desktopChrome.headH >= 30 &&
        desktopChrome.headH <= 46 &&
        desktopChrome.closeW === 22 &&
        desktopChrome.closeH === 22 &&
        desktopChrome.cardW <= 440,
      JSON.stringify(desktopChrome),
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
      return {
        headH: head.height,
        headW: head.width,
        cardW: card.width,
        closeW: close.width,
        closeH: close.height,
        saveH: save.height,
      };
    });
    report(
      'mobile: title bar widens to a 60px strip with a 60x60 close target',
      mobileChrome.headH >= 60 &&
        mobileChrome.closeW >= 60 &&
        mobileChrome.closeH >= 60 &&
        mobileChrome.headW >= mobileChrome.cardW - 2,
      JSON.stringify(mobileChrome),
    );
    report(
      'mobile: footer action buttons reach a 44px touch height',
      mobileChrome.saveH >= 44,
      JSON.stringify(mobileChrome),
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
