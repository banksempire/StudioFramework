const { ensureServer, openApp, makeReporter, finish } = require('./lib/ui-test.cjs');

(async () => {
  const serverProc = await ensureServer();
  const { browser, page } = await openApp();
  const { report, isFailed } = makeReporter();

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  async function openDemoDialog() {
    const demoVisible = await page
      .locator('.sf-dialog-demo')
      .isVisible()
      .catch(() => false);
    if (!demoVisible) {
      await page.locator('.sf-docker-app[title="Explorer"]').click();
      await delay(300);
    }
    const demo = page.locator('.sf-dialog-demo');
    await demo.scrollIntoViewIfNeeded();
    await demo.waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('.sf-dialog-demo-open').click();
    await page.locator('.sf-dialog').waitFor({ state: 'visible', timeout: 5000 });
    await delay(150);
  }

  const barBg = () =>
    page.evaluate(() => {
      const el = document.querySelector('[data-field="accent"] .sf-form-select');
      if (!el) return '';
      return getComputedStyle(el, '::before').backgroundColor;
    });

  const triggerText = () =>
    page.evaluate(() => {
      const el = document.querySelector('[data-field="accent"] .sf-form-select');
      return el ? el.textContent?.trim() : '';
    });

  try {
    await openDemoDialog();

    const field = page.locator('[data-field="accent"]');
    report('color field renders as a unified select trigger', (await field.count()) === 1);
    report(
      'the trigger shows the custom label with the color filling the bar',
      (await triggerText()) === 'Custom (#544FED)' && (await barBg()) === 'rgb(84, 79, 237)',
    );

    await field.locator('.sf-form-select').click();
    await delay(200);
    const pop = page.locator('.sf-root > .sf-select-pop');
    report(
      'the dropdown teleports outside the dialog and lists presets plus Custom',
      (await pop.count()) === 1 &&
        (await pop.locator('.sf-select-row').count()) === 9 &&
        (await pop.locator('.sf-select-row', { hasText: 'Black (#000000)' }).count()) === 1 &&
        (await pop.locator('.sf-select-row', { hasText: 'Custom…' }).count()) === 1,
    );

    await pop.locator('.sf-select-row', { hasText: 'Red (#EF5350)' }).click();
    await delay(200);
    report(
      'picking a preset applies it and closes the list',
      (await triggerText()) === 'Red (#EF5350)' && (await barBg()) === 'rgb(239, 83, 80)',
    );

    await field.locator('.sf-form-select').click();
    await delay(200);
    await page.locator('.sf-root > .sf-select-pop .sf-select-row', { hasText: 'Custom…' }).click();
    await delay(300);
    const wheelDlg = page.locator('.sf-dialog', { hasText: 'Pick a color' }).last();
    report('Custom opens the color wheel in a popup dialog', (await wheelDlg.count()) === 1);
    report(
      'the wheel renders inside the dialog',
      (await wheelDlg.locator('.sf-color-wheel-disc').count()) === 1 &&
        (await wheelDlg.locator('.sf-color-wheel-bar').count()) === 2 &&
        (await wheelDlg.locator('.sf-color-wheel-input').count()) === 5,
    );

    const hexInput = wheelDlg.locator('.sf-color-wheel-input--hex');
    const alphaIn = wheelDlg.locator('.sf-color-wheel-input').nth(4);
    await hexInput.fill('#ff0000');
    await hexInput.press('Enter');
    await delay(150);
    report('typing a hex updates the wheel', (await hexInput.inputValue()).toUpperCase() === '#FF0000');

    await alphaIn.fill('50');
    await delay(150);
    report('alpha appends the hex pair', (await hexInput.inputValue()).toUpperCase() === '#FF000080');

    await wheelDlg.locator('.sf-dialog-btn--accent').last().click();
    await delay(250);
    const appliedBg = await barBg();
    report(
      'Apply commits the wheel value to the field',
      (await triggerText()) === 'Custom (#FF000080)' &&
        (/^rgba\(255, 0, 0, 0\.5/.test(appliedBg) || appliedBg.includes('/ 0.5')),
    );

    await field.locator('.sf-form-select').click();
    await delay(200);
    await page.locator('.sf-root > .sf-select-pop .sf-select-row', { hasText: 'Green (#26A69A)' }).click();
    await delay(200);
    report('presets still apply after a custom color', (await triggerText()) === 'Green (#26A69A)');

    await field.locator('.sf-form-select').click();
    await delay(200);
    await page.locator('.sf-root > .sf-select-pop .sf-select-row', { hasText: 'Custom…' }).click();
    await delay(300);
    const dlg2 = page.locator('.sf-dialog', { hasText: 'Pick a color' }).last();
    report(
      'the wheel dialog restores the current color',
      (await dlg2.locator('.sf-color-wheel-input--hex').inputValue()).toUpperCase() === '#26A69A',
    );
    await dlg2.locator('.sf-dialog-btn').first().click();
    await delay(150);
    report(
      'Default clears the pending color',
      (await dlg2.locator('.sf-color-wheel-input--hex').inputValue()).toUpperCase() === '#26A69A',
    );
    await dlg2.locator('.sf-dialog-btn--accent').last().click();
    await delay(250);
    report('Apply after Default commits the empty value', (await triggerText()) === '');

    await field.locator('.sf-form-select').click();
    await delay(200);
    await page.locator('.sf-root > .sf-select-pop .sf-select-row', { hasText: 'Custom…' }).click();
    await delay(300);
    const dlg3 = page.locator('.sf-dialog', { hasText: 'Pick a color' }).last();
    await dlg3.locator('.sf-color-wheel-input--hex').fill('#544fed');
    await dlg3.locator('.sf-color-wheel-input--hex').press('Enter');
    await delay(100);
    await dlg3.locator('.sf-dialog-btn--ghost, .sf-dialog-btn').first().click();
    await delay(250);
    report('Cancel discards the pending wheel edits', (await triggerText()) === '');
  } catch (e) {
    report('suite completed', false, String(e));
  } finally {
    await finish(browser, serverProc, isFailed() || process.exitCode === 1, 'COLOR WHEEL CHECKS');
  }
})();
