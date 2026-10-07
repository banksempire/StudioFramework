const { ensureServer, openApp, makeReporter, finish } = require('./lib/ui-test.cjs');

(async () => {
  const serverProc = await ensureServer();
  const { browser, page, errors } = await openApp();
  const { report, isFailed } = makeReporter();

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  async function openDemoDialog() {
    const panelHidden = await page.evaluate(() =>
      document.querySelector('.sf-panel--left')?.classList.contains('sf-panel--hidden'),
    );
    if (panelHidden) await page.locator('.sf-docker-app[title="Explorer"]').click();
    const demo = page.locator('.sf-dialog-demo');
    await demo.scrollIntoViewIfNeeded();
    await demo.waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('.sf-dialog-demo-open').click();
    await page.locator('.sf-dialog').waitFor({ state: 'visible', timeout: 5000 });
    await delay(150);
  }

  const trigger = page.locator('#sf-dialog-demo-size');

  try {
    await openDemoDialog();

    const native = await page.evaluate(() => document.querySelector('.sf-dialog select') !== null);
    report('dialog selects render as custom triggers, not native selects', !native);

    const triggerState = await page.evaluate(() => {
      const el = document.querySelector('#sf-dialog-demo-size');
      return {
        tag: el?.tagName,
        expanded: el?.getAttribute('aria-expanded'),
        popup: el?.getAttribute('aria-haspopup'),
        label: el?.textContent?.trim(),
      };
    });
    report(
      'trigger is a combobox button with the current label',
      triggerState.tag === 'BUTTON' &&
        triggerState.expanded === 'false' &&
        triggerState.popup === 'listbox' &&
        triggerState.label === 'Medium',
      JSON.stringify(triggerState),
    );

    await trigger.click();
    await page.locator('.sf-select-pop').waitFor({ state: 'visible', timeout: 5000 });
    await delay(150);

    const openState = await page.evaluate(() => {
      const pop = document.querySelector('.sf-select-pop');
      const trg = document.querySelector('#sf-dialog-demo-size');
      const popRect = pop.getBoundingClientRect();
      const trgRect = trg.getBoundingClientRect();
      const style = getComputedStyle(pop);
      const rows = [...pop.querySelectorAll('.sf-select-row')];
      const selected = pop.querySelector('.sf-select-row--selected');
      const disabled = pop.querySelector('.sf-select-row--disabled');
      const probe = document.createElement('div');
      probe.style.background = 'var(--sf-bg-lighter)';
      probe.style.border = '1px solid var(--sf-border)';
      document.body.appendChild(probe);
      const probeStyle = getComputedStyle(probe);
      const themeBg = probeStyle.backgroundColor;
      const themeBorder = probeStyle.borderColor;
      probe.remove();
      return {
        inBody: document.body.contains(pop),
        fixed: style.position,
        bg: style.backgroundColor,
        border: style.borderColor,
        themeBg,
        themeBorder,
        widthMatch: Math.abs(popRect.width - trgRect.width) < 1.5,
        below: popRect.top >= trgRect.bottom,
        onScreen: popRect.bottom <= window.innerHeight && popRect.top >= 0,
        rowCount: rows.length,
        selectedLabel: selected?.querySelector('.sf-select-row-label')?.textContent,
        selectedMark: selected?.querySelector('.sf-select-mark') !== null,
        disabledLabel: disabled?.querySelector('.sf-select-row-label')?.textContent,
        disabledAria: disabled?.getAttribute('aria-disabled'),
      };
    });
    report(
      'popup is a themed listbox matching the trigger width',
      openState.inBody &&
        openState.fixed === 'fixed' &&
        openState.bg === openState.themeBg &&
        openState.border === openState.themeBorder &&
        openState.widthMatch &&
        openState.below &&
        openState.onScreen,
      JSON.stringify(openState),
    );
    report(
      'options carry selected mark and disabled state',
      openState.rowCount === 4 &&
        openState.selectedLabel === 'Medium' &&
        openState.selectedMark &&
        openState.disabledLabel === 'Extra large' &&
        openState.disabledAria === 'true',
      JSON.stringify(openState),
    );

    const hover = await page.evaluate(() => {
      const row = [...document.querySelectorAll('.sf-select-row')].find(
        (r) => r.querySelector('.sf-select-row-label')?.textContent === 'Large',
      );
      if (!row) return { before: 'missing' };
      const before = getComputedStyle(row).boxShadow;
      return { row, before };
    });
    await page
      .locator('.sf-select-row')
      .filter({ hasText: /^Large$/ })
      .hover();
    await delay(100);
    const hoverAfter = await page.evaluate((before) => {
      const row = [...document.querySelectorAll('.sf-select-row')].find(
        (r) => r.querySelector('.sf-select-row-label')?.textContent === 'Large',
      );
      return getComputedStyle(row).boxShadow !== before;
    }, hover.before);
    report('options highlight on hover with the theme overlay', hoverAfter);

    await page
      .locator('.sf-select-row')
      .filter({ hasText: /^Large$/ })
      .click();
    await delay(150);
    const picked = await page.evaluate(() => ({
      pop: document.querySelector('.sf-select-pop') !== null,
      label: document.querySelector('#sf-dialog-demo-size')?.textContent?.trim(),
      expanded: document.querySelector('#sf-dialog-demo-size')?.getAttribute('aria-expanded'),
    }));
    report(
      'picking an option patches the value and closes',
      !picked.pop && picked.label === 'Large' && picked.expanded === 'false',
      JSON.stringify(picked),
    );

    await trigger.click();
    await page.locator('.sf-select-pop').waitFor({ state: 'visible', timeout: 5000 });
    await delay(100);
    await page.locator('.sf-select-row--disabled').click({ force: true });
    await delay(100);
    const disabledPick = await page.evaluate(() => ({
      pop: document.querySelector('.sf-select-pop') !== null,
      label: document.querySelector('#sf-dialog-demo-size')?.textContent?.trim(),
    }));
    report(
      'disabled options cannot be picked',
      disabledPick.pop && disabledPick.label === 'Large',
      JSON.stringify(disabledPick),
    );

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await delay(80);
    const keyNav = await page.evaluate(() => {
      const pop = document.querySelector('.sf-select-pop');
      const active = pop?.querySelector('.sf-select-row--active');
      return {
        activeLabel: active?.querySelector('.sf-select-row-label')?.textContent,
        desc: pop?.getAttribute('aria-activedescendant'),
      };
    });
    report('arrow keys move the active option', keyNav.activeLabel === 'Medium', JSON.stringify(keyNav));

    const beforeEscape = await page.evaluate(() =>
      document.querySelector('#sf-dialog-demo-size')?.textContent?.trim(),
    );
    await page.keyboard.press('Escape');
    await delay(100);
    const afterEscape = await page.evaluate(() => ({
      pop: document.querySelector('.sf-select-pop') !== null,
      label: document.querySelector('#sf-dialog-demo-size')?.textContent?.trim(),
      focusOnTrigger: document.activeElement?.id,
    }));
    report(
      'escape closes without changing the value and refocuses the trigger',
      !afterEscape.pop &&
        afterEscape.label === beforeEscape &&
        afterEscape.focusOnTrigger === 'sf-dialog-demo-size',
      JSON.stringify({ afterEscape, beforeEscape }),
    );

    await trigger.click();
    await page.locator('.sf-select-pop').waitFor({ state: 'visible', timeout: 5000 });
    await delay(100);
    await page.mouse.click(8, 8);
    await delay(100);
    report('clicking outside closes the listbox', (await page.locator('.sf-select-pop').count()) === 0);

    await openDemoDialog();
    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    await page.locator('.sf-select-pop').waitFor({ state: 'visible', timeout: 5000 });
    await delay(80);
    const typeAhead = await page.evaluate(() => document.querySelector('.sf-select-pop') !== null);
    await page.keyboard.press('Escape');
    report('arrow-down on the closed trigger opens the listbox', typeAhead);

    await trigger.click();
    await page.locator('.sf-select-pop').waitFor({ state: 'visible', timeout: 5000 });
    await page.keyboard.type('sm');
    await delay(150);
    const typed = await page.evaluate(() => {
      const active = document.querySelector('.sf-select-row--active');
      return active?.querySelector('.sf-select-row-label')?.textContent;
    });
    await page.keyboard.press('Enter');
    await delay(100);
    const typedLabel = await page.evaluate(() =>
      document.querySelector('#sf-dialog-demo-size')?.textContent?.trim(),
    );
    report(
      'type-ahead jumps to the matching option',
      typed === 'Small' && typedLabel === 'Small',
      JSON.stringify({ typed, typedLabel }),
    );

    const grouped = await page.evaluate(() => {
      const trg = document.querySelector('#sf-dialog-demo-tier');
      trg.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return true;
    });
    await page.locator('.sf-select-pop').waitFor({ state: 'visible', timeout: 5000 });
    await delay(100);
    const groups = await page.evaluate(() => {
      const pop = document.querySelector('.sf-select-pop');
      return {
        headers: [...pop.querySelectorAll('.sf-select-group')].map((g) => g.textContent),
        rows: pop.querySelectorAll('.sf-select-row').length,
      };
    });
    report(
      'grouped options render under uppercase group headers',
      grouped && JSON.stringify(groups.headers) === JSON.stringify(['Core', 'Edge']) && groups.rows === 3,
      JSON.stringify(groups),
    );
    await page.keyboard.press('Escape');
    await delay(80);

    await page.setViewportSize({ width: 1440, height: 320 });
    await delay(150);
    await trigger.click();
    await page.locator('.sf-select-pop').waitFor({ state: 'visible', timeout: 5000 });
    await delay(150);
    const flipped = await page.evaluate(() => {
      const pop = document.querySelector('.sf-select-pop').getBoundingClientRect();
      const trg = document.querySelector('#sf-dialog-demo-size').getBoundingClientRect();
      return {
        fits: pop.bottom <= window.innerHeight && pop.top >= 0,
        above: pop.bottom <= trg.top + 1,
      };
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.keyboard.press('Escape');
    report(
      'listbox flips above when the trigger sits near the viewport bottom',
      flipped.fits && flipped.above,
      JSON.stringify(flipped),
    );

    await page.locator('#sf-dialog-demo-name').fill('select-hero');
    await page.locator('.sf-dialog-foot .sf-dialog-btn--accent').click();
    await delay(150);
    const saved = await page.evaluate(() => document.querySelector('.sf-dialog-demo-status')?.textContent);
    report(
      'saved payload carries the select values',
      saved?.includes('saved select-hero · workspace · size:s tier:b') === true,
      saved,
    );

    report('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  } catch (e) {
    report('suite completed', false, String(e));
  } finally {
    await finish(browser, serverProc, isFailed() || process.exitCode === 1, 'SELECT CHECKS');
  }
})();
