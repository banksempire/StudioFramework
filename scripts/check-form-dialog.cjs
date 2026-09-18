const { ensureServer, openApp, makeReporter, finish } = require('./lib/ui-test.cjs');

(async () => {
  const serverProc = await ensureServer();
  const { browser, page, errors } = await openApp();
  const { report, isFailed } = makeReporter();
  await page.setViewportSize({ width: 1440, height: 560 });

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  async function openDemoPanel(page) {
    const panelHidden = await page.evaluate(() =>
      document.querySelector('.sf-panel--left')?.classList.contains('sf-panel--hidden'),
    );
    if (panelHidden) await page.locator('.sf-docker-app[title="Explorer"]').click();
    const demo = page.locator('.sf-formdemo');
    await demo.scrollIntoViewIfNeeded();
    await demo.waitFor({ state: 'visible', timeout: 10000 });
    await delay(200);
    return demo;
  }

  try {
    await openDemoPanel(page);
    report('demo panel hosts the form trigger', (await page.locator('.sf-formdemo-open').count()) === 1);

    await page.locator('.sf-formdemo-open').click();
    await delay(200);
    const dialog = page.locator('.sf-dialog');
    await dialog.waitFor({ state: 'visible', timeout: 5000 });

    const chrome = await page.evaluate(() => ({
      title: document.querySelector('.sf-dialog-title')?.textContent,
      groups: [...document.querySelectorAll('.sf-form-group-title')].map((t) => t.textContent?.trim()),
      sections: [...document.querySelectorAll('.sf-form-section-title')].map((t) => t.textContent?.trim()),
      fields: [...document.querySelectorAll('.sf-form-field')].map((f) => f.dataset.field),
      grids: [...document.querySelectorAll('.sf-form-grid')].map((g) => g.dataset.cols),
      nav: [...document.querySelectorAll('.sf-form-nav-item')].map((b) => b.textContent?.trim()),
    }));
    report(
      'popup dialog renders groups, sections and data-field hooks from the document',
      chrome.title === 'Edit element' &&
        JSON.stringify(chrome.groups) === JSON.stringify(['Connection', 'Delivery']) &&
        JSON.stringify(chrome.sections) === JSON.stringify(['Element', 'Delivery']) &&
        JSON.stringify(chrome.fields) ===
          JSON.stringify(['name', 'kind', 'copies', 'tag', 'notes', 'scope', 'region', 'secret']) &&
        JSON.stringify(chrome.grids) === JSON.stringify(['2', '3']) &&
        JSON.stringify(chrome.nav) === JSON.stringify(['Connection', 'Delivery']),
      JSON.stringify(chrome),
    );

    const blankSelect = await page.evaluate(() => {
      const sel = document.querySelector('[data-field="kind"] select');
      return { value: sel?.value, blankOption: sel?.querySelector('option[value=""]')?.textContent };
    });
    report(
      'select with blankLabel starts empty and shows the placeholder option',
      blankSelect.value === '' && blankSelect.blankOption === 'select a kind…',
      JSON.stringify(blankSelect),
    );

    const gridFlow = await page.evaluate(() => {
      const rect = (sel) => document.querySelector(sel)?.getBoundingClientRect();
      const kind = rect('[data-field="kind"]');
      const copies = rect('[data-field="copies"]');
      const name = rect('[data-field="name"]');
      const grid2 = document.querySelector('.sf-form-grid[data-cols="2"]');
      const grid3 = document.querySelector('.sf-form-grid[data-cols="3"]');
      const region = rect('[data-field="region"]');
      const secret = rect('[data-field="secret"]');
      return {
        pairRow: Math.abs(kind.top - copies.top) < 2,
        cols2: getComputedStyle(grid2).gridTemplateColumns.split(' ').length,
        cols3: getComputedStyle(grid3).gridTemplateColumns.split(' ').length,
        nameFull: Math.abs(name.right - grid2.getBoundingClientRect().right) < 2,
        threeRow: Math.abs(region.top - secret.top) < 2,
      };
    });
    report(
      'fields flow in the section grid: pairs share a row, spans go full width',
      gridFlow.pairRow &&
        gridFlow.cols2 === 2 &&
        gridFlow.cols3 === 3 &&
        gridFlow.nameFull &&
        gridFlow.threeRow,
      JSON.stringify(gridFlow),
    );

    const inputTheme = await page.evaluate(() => {
      const input = document.querySelector('[data-field="name"] input');
      const s = getComputedStyle(input);
      return { h: input.getBoundingClientRect().height, bg: s.backgroundColor, radius: s.borderRadius };
    });
    report(
      'inputs carry the unified 36px filled theme',
      Math.round(inputTheme.h) === 36 &&
        inputTheme.bg.startsWith('rgba(0, 0, 0') &&
        inputTheme.radius !== '0px',
      JSON.stringify(inputTheme),
    );

    await page.locator('.sf-dialog-foot button', { hasText: 'Save Element' }).click();
    await delay(150);
    const requiredError = await page.evaluate(
      () => document.querySelector('.sf-dialog .sf-form-error')?.textContent,
    );
    report(
      'required validation blocks submit with a message',
      requiredError === 'Kind is required',
      String(requiredError),
    );

    await page.selectOption('[data-field="kind"] select', 'fanout');
    await page.locator('[data-field="notes"] textarea').fill('hello form');
    await delay(150);
    const bound = await page.evaluate(() => ({
      kind: document.querySelector('[data-field="kind"] select')?.value,
      notes: document.querySelector('[data-field="notes"] textarea')?.value,
    }));
    report(
      'v-model writes flow into the controls',
      bound.kind === 'fanout' && bound.notes === 'hello form',
      JSON.stringify(bound),
    );

    await page.fill('[data-field="copies"] input', '9');
    await delay(150);
    const warn = await page.evaluate(
      () => document.querySelector('[data-field="notes"] .sf-form-hint--warn')?.textContent,
    );
    report(
      'dynamic hint turns warn above the threshold',
      warn === 'large copy counts take a while',
      String(warn),
    );

    const slotField = await page.evaluate(() => {
      const input = document.querySelector('[data-field="secret"] input');
      return { type: input?.type, themed: input?.classList.contains('sf-form-input') };
    });
    report(
      'slot fields host custom controls under the theme',
      slotField.type === 'password' && slotField.themed,
      JSON.stringify(slotField),
    );

    const navJump = await page.evaluate(async () => {
      const rail = [...document.querySelectorAll('.sf-form-nav-item')];
      const body = document.querySelector('.sf-dialog-body');
      const before = body.scrollTop;
      rail[1].click();
      await new Promise((r) => setTimeout(r, 600));
      return {
        before,
        after: body.scrollTop,
        active: document.querySelector('.sf-form-nav-item--on')?.textContent,
      };
    });
    report(
      'the H1 nav rail jumps to the group and marks it active',
      navJump.after > navJump.before && navJump.active === 'Delivery',
      JSON.stringify(navJump),
    );

    await page.locator('.sf-dialog-foot button', { hasText: 'Save Element' }).click();
    await delay(600);
    const saved = await page.evaluate(() => document.querySelector('.sf-formdemo-status')?.textContent);
    report(
      'submit closes and reports the saved values',
      saved === 'saved panel-1 · fanout · scope workspace',
      String(saved),
    );

    await page.locator('.sf-formdemo-confirm').click();
    await delay(200);
    const confirmState = await page.evaluate(() => ({
      title: document.querySelector('.sf-dialog-title')?.textContent,
      info: document.querySelector('.sf-form-info')?.textContent,
      btns: [...document.querySelectorAll('.sf-dialog-foot .sf-dialog-btn')].map((b) => ({
        label: b.textContent?.trim(),
        danger: b.classList.contains('sf-dialog-btn--danger'),
      })),
      nav: document.querySelectorAll('.sf-form-nav-item').length,
    }));
    report(
      'a no-group document renders a plain confirm with a danger action and no rail',
      confirmState.title === 'Confirm delete?' &&
        confirmState.info === 'This removes the element and its history.' &&
        confirmState.nav === 0 &&
        confirmState.btns.length === 2 &&
        confirmState.btns[1].label === 'Delete' &&
        confirmState.btns[1].danger,
      JSON.stringify(confirmState),
    );
    await page.locator('.sf-dialog-foot button', { hasText: 'Delete' }).click();
    await delay(200);
    const deleted = await page.evaluate(() => document.querySelector('.sf-formdemo-status')?.textContent);
    report('the danger action emits and closes', deleted === 'deleted', String(deleted));

    await page.locator('.sf-formdemo-open').click();
    await delay(200);
    await page.locator('.sf-dialog-foot button', { hasText: 'Cancel' }).click();
    await delay(200);
    const cancelled = await page.evaluate(() => document.querySelector('.sf-formdemo-status')?.textContent);
    report('cancel closes and reports cancellation', cancelled === 'cancelled', String(cancelled));

    report('no console/page errors', errors.length === 0, errors.join(' | '));
  } catch (err) {
    report('suite crashed', false, String(err?.stack ?? err));
  } finally {
    await finish(browser, serverProc, isFailed());
  }
})();
