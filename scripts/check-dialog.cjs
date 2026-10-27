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

    await page.locator('.sf-dialog-demo-open-panel').click();
    await delay(300);
    const panelDlg = page.locator('.sf-dialog');
    await panelDlg.waitFor({ state: 'visible', timeout: 5000 });

    const panelState = await page.evaluate(() => {
      const dlg = document.querySelector('.sf-dialog');
      const nav = dlg?.querySelectorAll('.sf-form-nav-item');
      const bars = dlg?.querySelectorAll('.sf-subsection-header');
      const labels = dlg
        ? [...dlg.querySelectorAll('.sf-subsection-label')].map((el) => el.textContent?.trim())
        : [];
      const slot = dlg?.querySelector('.sf-form-field[data-field="pslot"] input');
      return {
        navItems: nav?.length ?? 0,
        navTitles: nav ? [...nav].map((n) => n.textContent?.trim()) : [],
        bars: bars?.length ?? 0,
        labels,
        hasSlot: !!slot,
      };
    });
    report(
      'panel popup: H1 TOC on the left, panel-style section bars, form controls',
      panelState.navItems === 2 &&
        JSON.stringify(panelState.navTitles) === JSON.stringify(['General', 'Advanced']) &&
        panelState.bars === 2 &&
        JSON.stringify(panelState.labels) === JSON.stringify(['Identity', 'Options']) &&
        panelState.hasSlot,
      JSON.stringify(panelState),
    );

    const subId = 'general::Identity';
    const collapsed = await page.evaluate((sid) => {
      const dlg = document.querySelector('.sf-dialog');
      const bar = dlg?.querySelector('.sf-subsection-header');
      const body = dlg?.querySelector(`[data-sub-body="${sid}"]`);
      if (!bar || !body) return null;
      const before = Math.round(body.getBoundingClientRect().height);
      bar.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return new Promise((resolve) =>
        setTimeout(() => {
          const after = document.querySelector(`.sf-dialog [data-sub-body="${sid}"]`);
          resolve({
            before,
            after: after ? Math.round(after.getBoundingClientRect().height) : -1,
          });
        }, 250),
      );
    }, subId);
    report(
      'panel popup: section bars collapse like panels',
      collapsed?.before > 0 && collapsed.after <= 0,
      JSON.stringify(collapsed),
    );
    const dlgCollapsed = await panelDlg.evaluate(() => {
      const d = document.querySelector('.sf-dialog');
      for (const bar of d.querySelectorAll('.sf-subsection-header')) {
        if (bar.closest('.sf-subsection').querySelector('[data-sub-body]'))
          bar.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
      return Math.round(d.getBoundingClientRect().height);
    });
    await delay(250);
    const dlgExpanded = await panelDlg.evaluate(() => {
      const d = document.querySelector('.sf-dialog');
      for (const bar of d.querySelectorAll('.sf-subsection-header')) {
        if (!bar.closest('.sf-subsection').querySelector('[data-sub-body]'))
          bar.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
      return Math.round(d.getBoundingClientRect().height);
    });
    await delay(250);
    report(
      'panel popup: dialog keeps its height when all sections collapse',
      dlgCollapsed > 100 && Math.abs(dlgCollapsed - dlgExpanded) <= 1,
      JSON.stringify({ collapsed: dlgCollapsed, expanded: dlgExpanded }),
    );
    await panelDlg.evaluate(() => {
      const d = document.querySelector('.sf-dialog');
      for (const bar of d.querySelectorAll('.sf-subsection-header')) {
        if (bar.closest('.sf-subsection').querySelector('[data-sub-body]'))
          bar.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    });
    await delay(250);
    const footPinned = await page.evaluate(() => {
      const dlg = document.querySelector('.sf-dialog');
      const foot = dlg?.querySelector('.sf-dialog-foot');
      if (!dlg || !foot) return null;
      return {
        footBottom: Math.round(foot.getBoundingClientRect().bottom),
        dlgBottom: Math.round(dlg.getBoundingClientRect().bottom),
      };
    });
    report(
      'popup: action footer stays at the dialog bottom when sections collapse',
      footPinned !== null && Math.abs(footPinned.footBottom - footPinned.dlgBottom) <= 1,
      JSON.stringify(footPinned),
    );
    await panelDlg.evaluate(() => {
      const d = document.querySelector('.sf-dialog');
      for (const bar of d.querySelectorAll('.sf-subsection-header')) {
        if (!bar.closest('.sf-subsection').querySelector('[data-sub-body]'))
          bar.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    });
    await delay(250);

    const vp = page.viewportSize();
    await page.setViewportSize({ width: vp.width, height: 500 });
    await delay(250);
    const capped = await panelDlg.evaluate(() => {
      const d = document.querySelector('.sf-dialog');
      return { h: Math.round(d.getBoundingClientRect().height), vh: window.innerHeight };
    });
    report(
      'panel popup: dialog height caps at four fifths of the viewport',
      capped.h > 0 && capped.h <= Math.round(capped.vh * 0.8) + 1,
      JSON.stringify(capped),
    );
    const barStick = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const dlg = document.querySelector('.sf-dialog');
          const bar = dlg?.querySelector('.sf-subsection-header');
          const dialogBody = dlg?.querySelector('.sf-dialog-body');
          if (!bar || !dialogBody) return resolve(null);
          const bodyTop = Math.round(dialogBody.getBoundingClientRect().top);
          const before = Math.round(bar.getBoundingClientRect().top);
          const beforeScroll = dialogBody.scrollTop;
          dialogBody.scrollTop = beforeScroll + 120;
          setTimeout(() => {
            const after = Math.round(bar.getBoundingClientRect().top);
            resolve({
              before,
              after,
              bodyTop,
              scrolled: dialogBody.scrollTop - beforeScroll,
            });
          }, 200);
        }),
    );
    report(
      'popup: section bar pins while the dialog scrolls',
      barStick !== null && barStick.scrolled >= 100 && Math.abs(barStick.after - barStick.bodyTop) <= 1,
      JSON.stringify(barStick),
    );
    await page.evaluate(() => {
      const dialogBody = document.querySelector('.sf-dialog .sf-dialog-body');
      if (dialogBody) dialogBody.scrollTop = 0;
    });
    await delay(150);
    await page.setViewportSize(vp);
    await delay(250);
    const restored = await panelDlg.evaluate(() => {
      const d = document.querySelector('.sf-dialog');
      return d ? Math.round(d.getBoundingClientRect().height) : -1;
    });
    report(
      'panel popup: dialog returns to its locked height after the viewport grows back',
      Math.abs(restored - dlgExpanded) <= 1,
      JSON.stringify({ restored, locked: dlgExpanded }),
    );
    const barBg = await page.evaluate(() => {
      const dlg = document.querySelector('.sf-dialog');
      const bar = dlg?.querySelector('.sf-subsection-header');
      if (!dlg || !bar) return null;
      return {
        bar: getComputedStyle(bar).backgroundColor,
        surface: getComputedStyle(dlg).backgroundColor,
      };
    });
    report(
      'popup: section bar matches the dialog surface',
      barBg !== null && barBg.bar === barBg.surface,
      JSON.stringify(barBg),
    );

    await panelDlg.locator('[data-field="pname"] input').fill('Pluto');
    await panelDlg.locator('.sf-form-field[data-field="pslot"] input').fill('from slot');
    await delay(150);
    await panelDlg.locator('.sf-dialog-btn--accent').last().click();
    await delay(200);
    const savedStatus = await page.evaluate(
      () => document.querySelector('.sf-dialog-demo-status')?.textContent,
    );
    report(
      'panel popup: field and slotted values reach save',
      savedStatus?.includes('panel saved Pluto/from slot/a') === true,
      JSON.stringify(savedStatus),
    );
    await delay(200);

    await page.locator('.sf-dialog-demo-open').click();
    await delay(150);
    const dialog = page.locator('.sf-dialog');
    await dialog.waitFor({ state: 'visible', timeout: 5000 });

    const grid = await page.evaluate(() => {
      const g = document.querySelector('.sf-dialog .sf-form-grid');
      if (!g) return null;
      const gr = g.getBoundingClientRect();
      const box = (sel) => {
        const el = g.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) };
      };
      return {
        rows: g.querySelectorAll('.sf-form-row').length,
        gridW: Math.round(gr.width),
        info: box('.sf-form-info'),
        btn: box('button.sf-dialog-btn'),
        accent: box('[data-field="accent"]'),
        tier: box('[data-field="tier"]'),
        alias: box('[data-field="alias"]'),
        tag: box('[data-field="tag"]'),
        tint: box('[data-field="tint"]'),
      };
    });
    const gridOk =
      grid &&
      grid.rows >= 4 &&
      grid.info &&
      grid.btn &&
      grid.accent &&
      grid.tier &&
      grid.alias &&
      grid.tag &&
      grid.info.w > grid.gridW * 0.9 &&
      grid.btn.w > grid.gridW * 0.9 &&
      Math.abs(grid.accent.y - grid.tier.y) <= 2 &&
      Math.abs(grid.accent.w - grid.tier.w) < 6 &&
      grid.accent.w < grid.gridW * 0.6 &&
      Math.abs(grid.alias.y - grid.tag.y) <= 2 &&
      Math.abs(grid.alias.w - grid.gridW / 4) < grid.gridW * 0.1 &&
      Math.abs(grid.tag.w - (grid.gridW * 3) / 4) < grid.gridW * 0.1;
    report(
      'form span weights: full rows, halves and a 1+3 quarter pair',
      Boolean(gridOk),
      JSON.stringify(grid),
    );

    await page.locator('.sf-dialog [data-field="accent"] .sf-form-select').click();
    await delay(300);
    const colorPick = await page.evaluate(() => {
      const trigger = document.querySelector('.sf-dialog [data-field="accent"] .sf-form-select');
      const pop = document.querySelector('.sf-select-pop');
      return {
        triggerFont: trigger ? getComputedStyle(trigger).fontSize : null,
        popW: pop ? Math.round(pop.getBoundingClientRect().width) : null,
        triggerW: trigger ? Math.round(trigger.getBoundingClientRect().width) : null,
      };
    });
    report(
      'color picker: trigger text is 16px and the pop avoids dead space',
      colorPick.triggerFont === '16px' && colorPick.popW !== null && colorPick.popW <= 260,
      JSON.stringify(colorPick),
    );
    await page.keyboard.press('Escape');
    await delay(200);

    const tintState = await page.evaluate(() => {
      const el = document.querySelector('[data-field="tint"] .sf-form-select');
      if (!el) return null;
      return {
        label: el.textContent?.trim(),
        fill: getComputedStyle(el).getPropertyValue('--sf-select-fill').trim().toLowerCase(),
      };
    });
    report(
      'an unset color field shows its effective default instead of a blank trigger',
      tintState?.label === 'Default (#544FED)' && tintState.fill === '#544fed',
      JSON.stringify(tintState),
    );

    const btnHeight = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.sf-form-row > .sf-dialog-btn')].at(-1);
      const input = document.querySelector('.sf-dialog .sf-form-input');
      if (!btn || !input) return null;
      return {
        btn: Math.round(btn.getBoundingClientRect().height),
        input: Math.round(input.getBoundingClientRect().height),
      };
    });
    report(
      'a button in a form row matches the control height variable',
      btnHeight?.btn === btnHeight?.input && btnHeight.btn > 0,
      JSON.stringify(btnHeight),
    );

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

    const panelBarBg = await page.evaluate(() => {
      const panel = document.querySelector('.sf-panel');
      const bar = panel?.querySelector('.sf-subsection-header');
      if (!panel || !bar) return null;
      return {
        bar: getComputedStyle(bar).backgroundColor,
        surface: getComputedStyle(panel).backgroundColor,
      };
    });
    report(
      'panel: section bar matches the panel surface',
      panelBarBg !== null && panelBarBg.bar === panelBarBg.surface,
      JSON.stringify(panelBarBg),
    );

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
