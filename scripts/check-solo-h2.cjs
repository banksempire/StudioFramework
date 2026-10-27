const { ensureServer, openApp, makeReporter, finish } = require('./lib/ui-test.cjs');

(async () => {
  const serverProc = await ensureServer();
  const { browser, page, errors } = await openApp({ viewport: { width: 1440, height: 1100 } });
  const { report, isFailed } = makeReporter();

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  const headerInfo = (scope, label) =>
    page.evaluate(
      ([sel, text]) => {
        const header = [...document.querySelectorAll(sel)].find((h) => h.textContent?.includes(text));
        if (!header) return null;
        return {
          static: header.classList.contains('sf-subsection-header--static'),
          arrows: header.querySelectorAll('.sf-subsection-arrow').length,
          collapsed:
            header.closest('.sf-subsection')?.classList.contains('sf-subsection--collapsed') ?? false,
        };
      },
      [scope, label],
    );

  const bodyVisible = (id) =>
    page.evaluate((sid) => {
      const el = document.querySelector(`[data-sub-body="${sid}"]`);
      return !!el && el.getBoundingClientRect().height > 0;
    }, id);

  const clickHeader = async (scope, label) => {
    await page.locator(`${scope}:has-text("${label}")`).first().click();
    await delay(300);
  };

  try {
    await page.locator('.sf-panel--right').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('.sf-tab:has-text("layout.json")').first().click();
    await delay(400);

    let info = await headerInfo('.sf-panel--right .sf-subsection-header', 'About');
    report('solo panel h2: header is static', !!info && info.static, JSON.stringify(info));
    report('solo panel h2: no expand arrow', !!info && info.arrows === 0);
    report('solo panel h2: body renders', await bodyVisible('welcome-about'));
    await clickHeader('.sf-panel--right .sf-subsection-header', 'About');
    info = await headerInfo('.sf-panel--right .sf-subsection-header', 'About');
    report(
      'solo panel h2: click does not collapse',
      !!info && !info.collapsed && (await bodyVisible('welcome-about')),
    );

    const demo = page.locator('.sf-dialog-demo');
    await demo.scrollIntoViewIfNeeded();
    await page.locator('.sf-dialog-demo-open-panel').click();
    await page.locator('.sf-dialog').waitFor({ state: 'visible', timeout: 5000 });
    await delay(200);

    const dlgBars = await page.evaluate(() => {
      const dlg = document.querySelector('.sf-dialog');
      return [...dlg.querySelectorAll('.sf-subsection-header')].map((h) => ({
        label: h.querySelector('.sf-subsection-label')?.textContent?.trim(),
        arrows: h.querySelectorAll('.sf-subsection-arrow').length,
      }));
    });
    report(
      'multi-h2 dialog: both section bars keep their expand arrows',
      dlgBars.length === 2 && dlgBars.every((b) => b.arrows === 1),
      JSON.stringify(dlgBars),
    );
    await page.locator('.sf-dialog .sf-subsection-header').first().click();
    await delay(300);
    const dlgCollapsed = await page.evaluate(() => {
      const dlg = document.querySelector('.sf-dialog');
      return {
        collapsed: !!dlg.querySelector('.sf-subsection--collapsed'),
        body: !!dlg.querySelector('[data-sub-body="general::Identity"]'),
      };
    });
    report(
      'multi-h2 dialog: sections still collapse and expand',
      dlgCollapsed.collapsed && !dlgCollapsed.body,
      JSON.stringify(dlgCollapsed),
    );
    await page.locator('.sf-dialog .sf-subsection-header').first().click();
    await delay(300);
    await page.locator('.sf-dialog .sf-dialog-btn', { hasText: 'Cancel' }).click();
    await delay(300);

    await page.locator('.sf-dialog-demo-open').click();
    await page.locator('.sf-dialog').waitFor({ state: 'visible', timeout: 5000 });
    await delay(200);
    await page.locator('[data-field="accent"] .sf-form-select').click();
    await delay(200);
    await page.locator('.sf-root > .sf-select-pop .sf-select-row', { hasText: 'Custom…' }).click();
    await delay(300);
    const wheelDlg = page.locator('.sf-dialog', { hasText: 'Pick a color' }).last();
    report('single-h2 dialog opens (color wheel)', (await wheelDlg.count()) === 1);

    const wheelBar = await page.evaluate(() => {
      const dlgs = [...document.querySelectorAll('.sf-dialog')];
      const dlg = dlgs[dlgs.length - 1];
      const header = dlg.querySelector('.sf-subsection-header');
      return {
        static: header?.classList.contains('sf-subsection-header--static') ?? false,
        arrows: header?.querySelectorAll('.sf-subsection-arrow').length ?? -1,
        wheel: !!dlg.querySelector('.sf-color-wheel-disc'),
      };
    });
    report('single-h2 dialog: header is static', wheelBar.static && wheelBar.wheel, JSON.stringify(wheelBar));
    report('single-h2 dialog: no expand arrow', wheelBar.arrows === 0);

    const wheelBodyBefore = await page.evaluate(() => {
      const dlgs = [...document.querySelectorAll('.sf-dialog')];
      const dlg = dlgs[dlgs.length - 1];
      return dlg.querySelector('[data-sub-body]')?.getBoundingClientRect().height ?? -1;
    });
    await wheelDlg.locator('.sf-subsection-header').click();
    await delay(300);
    const wheelBodyAfter = await page.evaluate(() => {
      const dlgs = [...document.querySelectorAll('.sf-dialog')];
      const dlg = dlgs[dlgs.length - 1];
      return {
        height: dlg.querySelector('[data-sub-body]')?.getBoundingClientRect().height ?? -1,
        collapsed: !!dlg.querySelector('.sf-subsection--collapsed'),
      };
    });
    report(
      'single-h2 dialog: click does not collapse',
      Math.abs(wheelBodyAfter.height - wheelBodyBefore) <= 1 && !wheelBodyAfter.collapsed,
      JSON.stringify({ wheelBodyBefore, wheelBodyAfter }),
    );
    await wheelDlg.locator('.sf-dialog-btn', { hasText: 'Cancel' }).last().click();
    await delay(250);
    await page.locator('.sf-dialog .sf-dialog-btn', { hasText: 'Cancel' }).last().click();
    await delay(300);

    await page.locator('.sf-panel--left').waitFor({ state: 'visible', timeout: 10000 });
    info = await headerInfo('.sf-panel--left .sf-subsection-header', 'Project');
    report('multi-h2 panel: header keeps its expand arrow', !!info && !info.static && info.arrows === 1);
    await page
      .locator('.sf-panel--left .sf-subsection-header:has-text("Project") .sf-subsection-arrow')
      .click();
    await delay(300);
    report('multi-h2 panel: collapse still works', !(await bodyVisible('project')));

    const soloTitles = [
      'Open Editors',
      'Recent',
      'Bulk',
      'Field manager',
      'Selectors',
      'Element Popup',
      'Outline',
      'Timeline',
    ];
    await page.locator('.sf-panel--left .sf-panel-header-btn').click();
    await delay(200);
    for (const title of soloTitles) {
      await page.locator('.sf-menu-pop .sf-menu-row', { hasText: title }).first().click();
      await delay(80);
    }
    await page.keyboard.press('Escape');
    await delay(300);

    info = await headerInfo('.sf-panel--left .sf-subsection-header', 'Project');
    report(
      'hidden-to-solo: last visible h2 is forced expanded and static',
      !!info && info.static && info.arrows === 0 && !info.collapsed && (await bodyVisible('project')),
      JSON.stringify(info),
    );
    await clickHeader('.sf-panel--left .sf-subsection-header', 'Project');
    report('hidden-to-solo: click does not collapse the last h2', await bodyVisible('project'));

    await page.locator('.sf-panel--left .sf-panel-header-btn').click();
    await delay(200);
    for (const title of soloTitles) {
      await page.locator('.sf-menu-pop .sf-menu-row', { hasText: title }).first().click();
      await delay(80);
    }
    await page.keyboard.press('Escape');
    await delay(300);

    info = await headerInfo('.sf-panel--left .sf-subsection-header', 'Project');
    report(
      'restore: h2 is collapsible again once siblings return',
      !!info && !info.static && info.arrows === 1 && (await bodyVisible('open-editors')),
      JSON.stringify(info),
    );

    report('no console/page errors', errors.length === 0, errors.join(' | '));
  } finally {
    await finish(browser, serverProc, isFailed(), 'SOLO H2 CHECKS');
  }
})();
