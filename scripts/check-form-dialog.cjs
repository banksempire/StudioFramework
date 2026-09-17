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
      sections: [...document.querySelectorAll('.sf-form-section-title')].map((t) => t.textContent?.trim()),
      fields: [...document.querySelectorAll('.sf-form-field')].map((f) => f.dataset.field),
    }));
    report(
      'form dialog renders sections and data-field hooks from the schema',
      chrome.title === 'Edit element (form)' &&
        JSON.stringify(chrome.sections) === JSON.stringify(['Element', 'Delivery']) &&
        JSON.stringify(chrome.fields) ===
          JSON.stringify(['name', 'kind', 'copies', 'tag', 'notes', 'scope', 'secret']),
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

    const halfPair = await page.evaluate(() => {
      const copies = document.querySelector('[data-field="copies"]')?.getBoundingClientRect();
      const tag = document.querySelector('[data-field="tag"]')?.getBoundingClientRect();
      return {
        sameRow: Math.abs(copies.top - tag.top) < 2,
        gridCols: getComputedStyle(document.querySelector('.sf-form-cols')).gridTemplateColumns.split(' ')
          .length,
      };
    });
    report(
      'half fields pair into a two-column row',
      halfPair.sameRow && halfPair.gridCols === 2,
      JSON.stringify(halfPair),
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

    await page.locator('.sf-dialog-foot button', { hasText: 'Save Element' }).click();
    await delay(600);
    const saved = await page.evaluate(() => document.querySelector('.sf-formdemo-status')?.textContent);
    report(
      'submit closes and reports the saved values',
      saved === 'saved panel-1 · fanout · scope workspace',
      String(saved),
    );

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
