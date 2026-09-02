const { ensureServer, openApp, makeReporter, finish } = require('./lib/ui-test.cjs');

(async () => {
  const serverProc = await ensureServer();
  const { browser, page, errors } = await openApp();
  const { report, isFailed } = makeReporter();

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  try {
    const panelHidden = await page.evaluate(() =>
      document.querySelector('.sf-panel--left')?.classList.contains('sf-panel--hidden'),
    );
    if (panelHidden) await page.locator('.sf-docker-app[title="Explorer"]').click();
    await page.locator('.sf-tab', { hasText: 'Table' }).click();
    const demo = page.locator('.sf-table-demo');
    await demo.waitFor({ state: 'visible', timeout: 10000 });
    await delay(300);

    const rowsIn = (sel) => page.locator(`.sf-table-demo-block:first-child ${sel}`);

    const initial = await page.evaluate(() => {
      const block = document.querySelector('.sf-table-demo-block');
      const head = block.querySelector('.sf-tbl-head');
      const ths = [...head.children].map((th) => th.textContent.trim());
      const rows = [...block.querySelectorAll('.sf-tbl-row')].map((r) => r.textContent);
      const tracks = getComputedStyle(head).gridTemplateColumns.split(' ').map(parseFloat);
      return { count: rows.length, ths, row0: rows[0], tracks };
    });
    report(
      'renders header labels and all rows on a fixed-column grid',
      initial.count === 5 &&
        initial.ths.join('|').toUpperCase().includes('NAME') &&
        initial.ths.join('|').toUpperCase().includes('SIZE KB') &&
        initial.tracks.length === 6 &&
        initial.tracks[0] === 150 &&
        initial.tracks[1] === 80 &&
        initial.tracks[2] === 76 &&
        initial.tracks[4] > 0,
      JSON.stringify(initial),
    );

    const nameBtn = rowsIn('.sf-tbl-th').first().locator('.sf-tbl-sortbtn');
    await nameBtn.click();
    const asc = await page.evaluate(() => {
      const block = document.querySelector('.sf-table-demo-block');
      const rows = [...block.querySelectorAll('.sf-tbl-row')].map((r) => r.textContent);
      return { first: rows[0], last: rows[rows.length - 1], n: rows.length };
    });
    report(
      'clicking a sortable header sorts ascending and shows the ↑ indicator',
      (await rowsIn('.sf-tbl-sortind').first().textContent()) === '↑' &&
        asc.first.includes('archive.zip') &&
        asc.last.includes('report-final.md'),
      JSON.stringify(asc),
    );

    await nameBtn.click();
    const desc = await page.evaluate(() => {
      const block = document.querySelector('.sf-table-demo-block');
      return [...block.querySelectorAll('.sf-tbl-row')][0].textContent;
    });
    report(
      'second click sorts descending (↓)',
      (await rowsIn('.sf-tbl-sortind').first().textContent()) === '↓' && desc.includes('report-final.md'),
      desc,
    );

    await nameBtn.click();
    const unsorted = await page.evaluate(() => {
      const block = document.querySelector('.sf-table-demo-block');
      return {
        first: [...block.querySelectorAll('.sf-tbl-row')][0].textContent,
        ind: block.querySelectorAll('.sf-tbl-sortind').length,
      };
    });
    report(
      'third click clears the sort back to natural order',
      unsorted.ind === 0 && unsorted.first.includes('report-final.md'),
      JSON.stringify(unsorted),
    );

    const sizeBtn = rowsIn('.sf-tbl-th').nth(2).locator('.sf-tbl-sortbtn');
    await sizeBtn.click();
    const numSort = await page.evaluate(() => {
      const block = document.querySelector('.sf-table-demo-block');
      return [...block.querySelectorAll('.sf-tbl-row')].map((r) => r.textContent);
    });
    report(
      'numeric columns sort by value, not string',
      numSort[0].includes('12') && numSort[4].includes('2048'),
      JSON.stringify(numSort),
    );
    await sizeBtn.click();
    await sizeBtn.click();

    await rowsIn('.sf-tbl-th').first().locator('.sf-tbl-filterbtn').click();
    await delay(100);
    await rowsIn('.sf-tbl-pop-input').fill('ar');
    await delay(150);
    const textFilter = await page.evaluate(() => {
      const block = document.querySelector('.sf-table-demo-block');
      return [...block.querySelectorAll('.sf-tbl-row')].map((r) => r.textContent);
    });
    report(
      'text filter narrows rows by substring',
      textFilter.length === 2 &&
        textFilter.every((t) => t.includes('ar')) &&
        (await rowsIn('.sf-tbl-filterbtn--on').count()) === 1,
      JSON.stringify(textFilter),
    );

    await rowsIn('.sf-tbl-pop-clear').click();
    await page.mouse.click(400, 10);
    await delay(100);
    const closed = await page.evaluate(() => {
      const block = document.querySelector('.sf-table-demo-block');
      return [...block.querySelectorAll('.sf-tbl-row')].length;
    });
    report('clear + outside click restores all rows and closes the popover', closed === 5, `rows=${closed}`);

    await rowsIn('.sf-tbl-th').first().locator('.sf-tbl-filterbtn').click();
    await delay(100);
    await rowsIn('.sf-tbl-pop-input').fill('zzz');
    await delay(150);
    const emptyFiltered = await rowsIn('.sf-tbl-empty').textContent();
    report(
      'empty slot sees the filtered state',
      emptyFiltered?.trim() === 'No files match.',
      emptyFiltered,
    );
    await rowsIn('.sf-tbl-pop-input').fill('');
    await delay(150);
    await page.mouse.click(400, 10);
    report('clearing the filter brings the rows back', (await rowsIn('.sf-tbl-row').count()) === 5);

    await rowsIn('.sf-tbl-th').nth(1).locator('.sf-tbl-filterbtn').click();
    await delay(100);
    const kindChips = rowsIn('.sf-tbl-pop .sf-ms-item');
    await kindChips.filter({ hasText: 'image' }).first().click();
    await delay(150);
    const selectFilter = await page.evaluate(() => {
      const block = document.querySelector('.sf-table-demo-block');
      return [...block.querySelectorAll('.sf-tbl-row')].map((r) => r.textContent);
    });
    report(
      'select filter (MultiSelectGroup chips) filters by value',
      selectFilter.length === 2 &&
        selectFilter.every((t) => t.includes('ar')) &&
        selectFilter.some((t) => t.includes('avatar')) &&
        selectFilter.some((t) => t.includes('archive')),
      JSON.stringify(selectFilter),
    );

    await kindChips.filter({ hasText: 'image' }).first().click();
    await delay(150);
    const allOff = await page.evaluate(() => {
      const block = document.querySelector('.sf-table-demo-block');
      return {
        rows: [...block.querySelectorAll('.sf-tbl-row')].length,
        on: block.querySelectorAll('.sf-tbl-filterbtn--on').length,
      };
    });
    report(
      'empty chip selection means no filter',
      allOff.rows === 5 && allOff.on === 0,
      JSON.stringify(allOff),
    );
    await page.mouse.click(400, 10);

    const headBox = await rowsIn('.sf-tbl-th').first().boundingBox();
    const handleX = headBox.x + headBox.width - 1;
    await page.mouse.move(handleX, headBox.y + headBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleX + 60, headBox.y + headBox.height / 2, { steps: 8 });
    await page.mouse.up();
    await delay(150);
    const resized = await page.evaluate(() => {
      const block = document.querySelector('.sf-table-demo-block');
      const head = block.querySelector('.sf-tbl-head');
      const row = block.querySelector('.sf-tbl-row');
      const state = document.querySelector('.sf-table-demo-state').textContent;
      return {
        head: getComputedStyle(head).gridTemplateColumns.split(' ')[0],
        row: getComputedStyle(row).gridTemplateColumns.split(' ')[0],
        state,
      };
    });
    report(
      'dragging the header edge widens the column for header and rows alike',
      Math.round(parseFloat(resized.head)) >= 208 &&
        resized.head === resized.row &&
        resized.state.includes('name:2'),
      JSON.stringify(resized),
    );

    const hd2 = await rowsIn('.sf-tbl-th').first().boundingBox();
    await page.mouse.dblclick(hd2.x + hd2.width - 1, hd2.y + hd2.height / 2);
    await delay(150);
    const reset = await page.evaluate(() => {
      const block = document.querySelector('.sf-table-demo-block');
      return getComputedStyle(block.querySelector('.sf-tbl-head')).gridTemplateColumns.split(' ')[0];
    });
    report('double-click on the handle resets the column width', reset === '150px', reset);

    await rowsIn('.sf-tbl-row').first().locator('.sf-tbl-btn--danger').click();
    await delay(100);
    const removed = await page.evaluate(() => {
      const block = document.querySelector('.sf-table-demo-block');
      return {
        rows: [...block.querySelectorAll('.sf-tbl-row')].length,
        state: document.querySelector('.sf-table-demo-state').textContent,
      };
    });
    report(
      'slot action buttons act on their row',
      removed.rows === 4 && /removed=(report-final\.md|budget\.xlsx)/.test(removed.state),
      JSON.stringify(removed),
    );

    await rowsIn('.sf-tbl-row').first().locator('.sf-tbl-btn:not(.sf-tbl-btn--danger)').click();
    await rowsIn('.sf-tbl-row').nth(1).click();
    await delay(100);
    const clicked = await page.evaluate(() => {
      const block = document.querySelector('.sf-table-demo-block');
      const sel = block.querySelectorAll('.sf-table-demo--sel').length;
      return { sel, state: document.querySelector('.sf-table-demo-state').textContent };
    });
    report(
      'row clicks fire row-click and rowClass marks the row',
      clicked.sel === 1 && /clicked=(avatar\.png|index\.ts|budget\.xlsx)/.test(clicked.state),
      JSON.stringify(clicked),
    );

    await page.setViewportSize({ width: 449, height: 800 });
    await delay(300);
    const mobile = await page.evaluate(() => {
      const block = document.querySelector('.sf-table-demo-block');
      const row = block.querySelector('.sf-tbl-row');
      const rs = getComputedStyle(row);
      const title = row.querySelector('.sf-tbl-c--title');
      const sub = row.querySelector('.sf-tbl-c--sub');
      const hidden = row.querySelector('.sf-tbl-c--hidden');
      const btn = row.querySelector('.sf-tbl-btn');
      return {
        head: getComputedStyle(block.querySelector('.sf-tbl-head')).display,
        template: rs.gridTemplateAreas.includes('title'),
        titleTop: title.getBoundingClientRect().top,
        subTop: sub.getBoundingClientRect().top,
        btnW: btn.getBoundingClientRect().width,
        btnH: btn.getBoundingClientRect().height,
        hiddenDisplay: hidden ? getComputedStyle(hidden).display : 'absent',
      };
    });
    report(
      'mobile: header hides, rows become cards (title over sub, hidden columns gone, square actions)',
      mobile.head === 'none' &&
        mobile.template === true &&
        mobile.subTop > mobile.titleTop &&
        mobile.btnW === 44 &&
        mobile.btnH === 44 &&
        (mobile.hiddenDisplay === 'none' || mobile.hiddenDisplay === 'absent'),
      JSON.stringify(mobile),
    );

    const jobCard = await page.evaluate(() => {
      const blocks = [...document.querySelectorAll('.sf-table-demo-block')];
      const job = blocks[1];
      const row = job.querySelector('.sf-tbl-row');
      const r = row.getBoundingClientRect();
      const lead = row.querySelector('.sf-tbl-c--lead').getBoundingClientRect();
      const title = row.querySelector('.sf-tbl-c--title').getBoundingClientRect();
      const actions = row.querySelector('.sf-tbl-c--actions').getBoundingClientRect();
      const btn = row.querySelector('.sf-tbl-btn').getBoundingClientRect();
      return {
        template: getComputedStyle(row).gridTemplateAreas,
        leadInside: lead.left >= r.left - 1 && lead.right <= title.left + 1,
        btnW: btn.width,
        actionsRight: actions.right <= r.right + 1,
      };
    });
    report(
      'mobile: tables with a lead column put it left, actions stacked on the right',
      jobCard.template.includes('lead') &&
        jobCard.template.includes('title') &&
        jobCard.leadInside &&
        jobCard.btnW === 44 &&
        jobCard.actionsRight,
      JSON.stringify(jobCard),
    );

    await page.setViewportSize({ width: 1440, height: 900 });
    await delay(300);
    const backDesktop = await page.evaluate(() => {
      const block = document.querySelector('.sf-table-demo-block');
      return {
        head: getComputedStyle(block.querySelector('.sf-tbl-head')).display,
        rows: [...block.querySelectorAll('.sf-tbl-row')].length,
      };
    });
    report(
      'desktop layout restored after resizing back',
      backDesktop.head === 'grid' && backDesktop.rows >= 4,
      JSON.stringify(backDesktop),
    );
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    await finish(browser, serverProc, isFailed() || process.exitCode === 1 || errors.length > 0, 'TABLE CHECKS');
  }
})();
