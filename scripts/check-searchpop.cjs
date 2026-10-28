const { ensureServer, openApp, makeReporter, finish } = require('./lib/ui-test.cjs');

(async () => {
  const serverProc = await ensureServer();
  const { browser, page, errors } = await openApp();
  const { report, isFailed } = makeReporter();

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  const SEARCH_BOX = '.sf-form-field[data-field="psearch"] input.sf-search-select-box';

  async function openPanelPopup() {
    const demoVisible = await page
      .locator('.sf-dialog-demo')
      .isVisible()
      .catch(() => false);
    if (!demoVisible) {
      await page.locator('.sf-docker-app[title="Explorer"]').click();
      await delay(300);
    }
    await page.locator('.sf-dialog-demo').scrollIntoViewIfNeeded();
    await page.locator('.sf-dialog-demo').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('.sf-dialog-demo-open-panel').click();
    await page.locator('.sf-dialog').waitFor({ state: 'visible', timeout: 5000 });
    await delay(150);
  }

  const box = page.locator(SEARCH_BOX);

  try {
    await openPanelPopup();

    const closed = await page.evaluate(
      (sel) => ({
        input: document.querySelector(sel)?.tagName,
        pop: document.querySelector('.sf-search-select-pop') !== null,
      }),
      SEARCH_BOX,
    );
    report(
      'search field renders as a plain input with no popup until focus',
      closed.input === 'INPUT' && !closed.pop,
      JSON.stringify(closed),
    );

    await box.click();
    await page.locator('.sf-search-select-pop').waitFor({ state: 'visible', timeout: 5000 });
    await delay(150);

    const state = await page.evaluate((sel) => {
      const pop = document.querySelector('.sf-search-select-pop');
      const box = document.querySelector(sel);
      const dialog = document.querySelector('.sf-dialog');
      if (
        !(pop instanceof HTMLElement) ||
        !(box instanceof HTMLElement) ||
        !(dialog instanceof HTMLElement)
      ) {
        return { missing: true };
      }
      const popRect = pop.getBoundingClientRect();
      const boxRect = box.getBoundingClientRect();
      const style = getComputedStyle(pop);
      const rows = [...pop.querySelectorAll('.sf-search-select-row')].filter((r) => r instanceof HTMLElement);
      const heights = rows.map((r) => r.getBoundingClientRect().height);
      const overlapsInput = popRect.top < boxRect.bottom - 1 && popRect.bottom > boxRect.top + 1;
      return {
        insideDialog: dialog.contains(pop),
        fixed: style.position,
        zIndex: style.zIndex,
        widthMatch: Math.abs(popRect.width - boxRect.width) < 1.5,
        anchored: (popRect.top >= boxRect.bottom - 1 || popRect.bottom <= boxRect.top + 1) && !overlapsInput,
        flipped: popRect.bottom <= boxRect.top + 1,
        onScreen:
          popRect.top >= 0 &&
          popRect.left >= 0 &&
          popRect.right <= window.innerWidth + 0.5 &&
          popRect.bottom <= window.innerHeight + 0.5,
        rowCount: rows.length,
        rowMinHeight: Math.min(...heights),
        rowHeightsEqual: Math.max(...heights) - Math.min(...heights) < 1,
        rowTextClipped: rows.some((r) => r.scrollHeight > r.clientHeight + 1),
        scrollable: pop.scrollHeight > pop.clientHeight,
      };
    }, SEARCH_BOX);
    report(
      'popup teleports out of the dialog as a fixed listbox',
      !state.missing && !state.insideDialog && state.fixed === 'fixed' && state.zIndex === '1200',
      JSON.stringify(state),
    );
    report(
      'popup hugs the input width, anchors to it without covering it, stays fully on screen',
      state.widthMatch && state.anchored && state.onScreen,
      JSON.stringify(state),
    );
    report(
      'rows keep natural height instead of squashing into each other',
      state.rowCount > 0 &&
        state.rowMinHeight >= 26 &&
        state.rowHeightsEqual &&
        !state.rowTextClipped &&
        state.scrollable,
      JSON.stringify(state),
    );

    await page.locator('.sf-search-select-row').filter({ hasText: 'Charlie option' }).click();
    await delay(150);
    const picked = await page.evaluate(
      (sel) => ({
        pop: document.querySelector('.sf-search-select-pop') !== null,
        value: document.querySelector(sel)?.value,
      }),
      SEARCH_BOX,
    );
    report(
      'picking a row patches the value and closes',
      !picked.pop && picked.value === 'Charlie option',
      JSON.stringify(picked),
    );

    await box.click();
    await page.locator('.sf-search-select-pop').waitFor({ state: 'visible', timeout: 5000 });
    await delay(100);
    await page.keyboard.type('li');
    await delay(200);
    const filtered = await page.evaluate(() => {
      const pop = document.querySelector('.sf-search-select-pop');
      const rows = pop ? [...pop.querySelectorAll('.sf-search-select-row')] : [];
      return {
        labels: rows.map((r) => r.textContent?.trim()),
        cursorOn: pop?.querySelector('.sf-search-select-row--on')?.textContent?.trim(),
      };
    });
    report(
      'typing filters the option list',
      filtered.labels.length === 3 &&
        filtered.labels.includes('Charlie option') &&
        filtered.labels.includes('Juliett option') &&
        filtered.labels.includes('Lima option'),
      JSON.stringify(filtered),
    );

    const dialogBefore = await page.evaluate(() => document.querySelector('.sf-dialog') !== null);
    await page.keyboard.press('Escape');
    await delay(150);
    const afterEscape = await page.evaluate(
      (sel) => ({
        pop: document.querySelector('.sf-search-select-pop') !== null,
        dialog: document.querySelector('.sf-dialog') !== null,
        value: document.querySelector(sel)?.value,
      }),
      SEARCH_BOX,
    );
    report(
      'escape closes only the popup, not the dialog',
      dialogBefore && !afterEscape.pop && afterEscape.dialog && afterEscape.value === 'Charlie option',
      JSON.stringify({ dialogBefore, afterEscape }),
    );

    await box.click();
    await page.locator('.sf-search-select-pop').waitFor({ state: 'visible', timeout: 5000 });
    await delay(100);
    await page.locator('.sf-dialog-body').evaluate((el) => el.scrollBy(0, 60));
    await delay(200);
    const followed = await page.evaluate((sel) => {
      const pop = document.querySelector('.sf-search-select-pop');
      const box = document.querySelector(sel);
      if (!(pop instanceof HTMLElement) || !(box instanceof HTMLElement)) return { missing: true };
      const popRect = pop.getBoundingClientRect();
      const boxRect = box.getBoundingClientRect();
      return {
        missing: false,
        gap: popRect.top - boxRect.bottom,
        onScreen: popRect.bottom <= window.innerHeight && popRect.top >= 0,
      };
    }, SEARCH_BOX);
    report(
      'popup follows the input when the dialog body scrolls',
      !followed.missing && Math.abs(followed.gap - 4) < 3 && followed.onScreen,
      JSON.stringify(followed),
    );

    report('no page errors during the suite', errors.length === 0, errors.join(' | '));
  } catch (e) {
    report('suite completed without throwing', false, String(e));
  } finally {
    await finish(browser, serverProc, isFailed(), 'SEARCHPOP');
  }
})();
