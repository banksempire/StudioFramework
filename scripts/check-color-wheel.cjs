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

  const swatchBg = () =>
    page.evaluate(() => {
      const el = document.querySelector('[data-color-field="accent"] .sf-color-swatch');
      return el ? getComputedStyle(el).backgroundColor : '';
    });

  try {
    await openDemoDialog();

    const field = page.locator('[data-color-field="accent"]');
    report('color field renders in the demo dialog', (await field.count()) === 1);
    const trigger = field.locator('.sf-color-trigger');
    const initial = {
      text: (await trigger.locator('.sf-color-trigger-text').textContent())?.trim(),
      swatch: await swatchBg(),
    };
    report(
      'color trigger shows the initial hex and swatch',
      initial.text === '#544FED' && initial.swatch === 'rgb(84, 79, 237)',
    );

    await trigger.click();
    await delay(200);
    const wheel = field.locator('.sf-color-wheel');
    report('clicking the trigger opens the color wheel', (await wheel.count()) === 1);
    report(
      'wheel renders disc, two bars and five inputs',
      (await wheel.locator('.sf-color-wheel-disc').count()) === 1 &&
        (await wheel.locator('.sf-color-wheel-bar').count()) === 2 &&
        (await wheel.locator('.sf-color-wheel-input').count()) === 5,
    );

    const hexInput = wheel.locator('.sf-color-wheel-input--hex');
    await hexInput.fill('#ff0000');
    await hexInput.press('Enter');
    await delay(150);
    report('typing a hex sets the exact color', (await swatchBg()) === 'rgb(255, 0, 0)');

    const rIn = wheel.locator('.sf-color-wheel-input').nth(1);
    const gIn = wheel.locator('.sf-color-wheel-input').nth(2);
    const bIn = wheel.locator('.sf-color-wheel-input').nth(3);
    const alphaIn = wheel.locator('.sf-color-wheel-input').nth(4);
    await rIn.fill('84');
    await gIn.fill('79');
    await bIn.fill('237');
    await delay(150);
    report('editing RGB channels updates the hex', (await hexInput.inputValue()).toUpperCase() === '#544FED');

    await alphaIn.fill('50');
    await delay(150);
    report(
      'alpha input appends the hex alpha pair',
      (await hexInput.inputValue()).toUpperCase() === '#544FED80',
    );
    await alphaIn.fill('100');
    await delay(100);
    await hexInput.fill('#544fed80');
    await hexInput.press('Enter');
    await delay(150);
    report(
      'an 8-digit hex restores the transparency',
      (await hexInput.inputValue()).toUpperCase() === '#544FED80' && (await alphaIn.inputValue()) === '50',
    );
    const swatchAlpha = await swatchBg();
    report(
      'the swatch renders the transparent color',
      /^rgba\(84, 79, 237, 0\.5/.test(swatchAlpha) || swatchAlpha.includes('/ 0.5'),
    );

    const valBar = wheel.locator('.sf-color-wheel-bar').first();
    const valBox = await valBar.boundingBox();
    if (!valBox) report('value bar is measurable', false);
    else {
      await page.mouse.click(valBox.x + valBox.width * 0.15, valBox.y + valBox.height / 2);
      await delay(150);
      const dark = await swatchBg();
      const m = dark.match(/rgba?\((\d+), (\d+), (\d+)/);
      const ok = !!m && Number(m[3]) > Number(m[1]) && Number(m[3]) > Number(m[2]) && Number(m[3]) < 200;
      report('value bar darkens while keeping the hue', ok);
    }

    const alphaBar = wheel.locator('.sf-color-wheel-bar--alpha');
    const alphaBox = await alphaBar.boundingBox();
    if (!alphaBox) report('alpha bar is measurable', false);
    else {
      await page.mouse.click(alphaBox.x + 1, alphaBox.y + alphaBox.height / 2);
      await delay(150);
      const hex = (await hexInput.inputValue()).toUpperCase();
      const pct = await alphaIn.inputValue();
      report('alpha bar far left makes the color fully transparent', /0[0-2]$/.test(hex) && Number(pct) <= 2);
    }

    await alphaIn.fill('100');
    await delay(150);

    const clearBtn = field.locator('.sf-color-clear');
    if ((await clearBtn.count()) !== 1) report('Default button renders in the wheel pop', false);
    else {
      await clearBtn.click();
      await delay(150);
      const text = (await trigger.locator('.sf-color-trigger-text').textContent())?.trim();
      report('Default button clears to the empty value', text === 'Default' && (await wheel.count()) === 0);
    }

    await trigger.click();
    await delay(150);
    await hexInput.fill('#544fed');
    await hexInput.press('Enter');
    await delay(150);
    await page.locator('#sf-dialog-demo-name').click();
    await delay(200);
    report('outside click closes the wheel', (await field.locator('.sf-color-wheel').count()) === 0);

    await page.locator('.sf-dialog-btn--accent').last().click();
    await delay(200);
    const saved = await page.evaluate(
      () => document.querySelector('.sf-dialog-demo-status')?.textContent ?? '',
    );
    report('the demo save echo carries the color value', /accent:#[0-9a-fA-F]{6}/.test(saved));
  } catch (e) {
    report('suite completed', false, String(e));
  } finally {
    await finish(browser, serverProc, isFailed() || process.exitCode === 1, 'COLOR WHEEL CHECKS');
  }
})();
