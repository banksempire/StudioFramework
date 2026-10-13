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
    const rgbToHsvTest = (r, g, b) => {
      const rn = r / 255,
        gn = g / 255,
        bn = b / 255;
      const max = Math.max(rn, gn, bn),
        min = Math.min(rn, gn, bn);
      const d = max - min;
      let h = 0;
      if (d > 0) {
        if (max === rn) h = (((gn - bn) / d) % 6) * 60;
        else if (max === gn) h = ((bn - rn) / d + 2) * 60;
        else h = ((rn - gn) / d + 4) * 60;
        if (h < 0) h += 360;
      }
      return { h, s: max === 0 ? 0 : d / max, v: max };
    };
    const hsvToHexTest = ({ h, s, v }) => {
      const c = v * s;
      const hp = (((h % 360) + 360) % 360) / 60;
      const x = c * (1 - Math.abs((hp % 2) - 1));
      const seg = Math.floor(hp);
      const part =
        seg === 0
          ? [c, x, 0]
          : seg === 1
            ? [x, c, 0]
            : seg === 2
              ? [0, c, x]
              : seg === 3
                ? [0, x, c]
                : seg === 4
                  ? [x, 0, c]
                  : [c, 0, x];
      const m = v - c;
      return `#${[part[0] + m, part[1] + m, part[2] + m]
        .map((cv) =>
          Math.round(cv * 255)
            .toString(16)
            .padStart(2, '0'),
        )
        .join('')}`;
    };
    const base = rgbToHsvTest(84, 79, 237);

    const schemeBtn = wheel.locator('.sf-color-schemes-btn');
    report(
      'scheme selector shows Complementary by default',
      (await schemeBtn.textContent())?.trim().startsWith('Complementary') === true,
    );
    report('complementary shows two chips', (await wheel.locator('.sf-color-scheme-chip').count()) === 2);
    const compHex = await wheel
      .locator('.sf-color-scheme-chip')
      .nth(1)
      .evaluate((el) => el.title);
    report(
      'the complementary chip sits opposite on the wheel',
      compHex.toUpperCase() === hsvToHexTest({ ...base, h: base.h + 180 }).toUpperCase(),
    );

    await wheel.locator('.sf-color-scheme-chip').nth(1).click();
    await delay(150);
    report(
      'clicking the complementary chip applies it',
      (await hexInput.inputValue()).toUpperCase() ===
        hsvToHexTest({ ...base, h: base.h + 180 }).toUpperCase(),
    );

    await schemeBtn.click();
    await delay(150);
    report(
      'the scheme list offers six harmonies',
      (await wheel.locator('.sf-color-schemes-item').count()) === 6,
    );
    await wheel.locator('.sf-color-schemes-item', { hasText: 'Triadic' }).click();
    await delay(150);
    report('triadic shows three chips', (await wheel.locator('.sf-color-scheme-chip').count()) === 3);
    await wheel.locator('.sf-color-scheme-chip').nth(1).click();
    await delay(150);
    report(
      'clicking a triadic chip applies hue +120 from the current color',
      (await hexInput.inputValue()).toUpperCase() ===
        hsvToHexTest({ ...base, h: base.h + 300 }).toUpperCase(),
    );

    await schemeBtn.click();
    await delay(100);
    await wheel.locator('.sf-color-schemes-item', { hasText: 'Monochromatic' }).click();
    await delay(150);
    report('monochromatic shows three chips', (await wheel.locator('.sf-color-scheme-chip').count()) === 3);
    const monoHexNow = (await hexInput.inputValue()).toUpperCase();
    const monoHue = rgbToHsvTest(
      parseInt(monoHexNow.slice(1, 3), 16),
      parseInt(monoHexNow.slice(3, 5), 16),
      parseInt(monoHexNow.slice(5, 7), 16),
    ).h;
    await wheel.locator('.sf-color-scheme-chip').nth(2).click();
    await delay(150);
    const monoAfter = (await hexInput.inputValue()).toUpperCase();
    const afterMono = rgbToHsvTest(
      parseInt(monoAfter.slice(1, 3), 16),
      parseInt(monoAfter.slice(3, 5), 16),
      parseInt(monoAfter.slice(5, 7), 16),
    );
    report(
      'monochromatic keeps the hue',
      Math.abs(afterMono.h - monoHue) < 30 || Math.abs(afterMono.h - monoHue) > 330,
    );

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
