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

    await page.waitForFunction(
      () => {
        const row = document.querySelector('.sf-table-demo-block .sf-tbl-row');
        if (!row) return false;
        const cells = [...row.querySelectorAll('.sf-tbl-cell')];
        return cells[cells.length - 1].getBoundingClientRect().width > 40;
      },
      { timeout: 8000 },
    );
    await delay(100);
    const rowsText = () =>
      page.evaluate(() => {
        const block = document.querySelector('.sf-table-demo-block');
        return [...block.querySelectorAll('.sf-tbl-row')].map((r) => r.textContent);
      });

    const initial = await page.evaluate(() => {
      const block = document.querySelector('.sf-table-demo-block');
      const head = block.querySelector('.sf-tbl-head');
      const ths = [...head.children].map((th) => th.textContent.trim());
      const rows = [...block.querySelectorAll('.sf-tbl-row')].map((r) => r.textContent);
      const tracks = getComputedStyle(head).gridTemplateColumns.split(' ').map(parseFloat);
      const th = head.children[1];
      return { count: rows.length, ths, row0: rows[0], tracks, thCase: getComputedStyle(th).textTransform };
    });
    report(
      'renders header labels, a row-number gutter and all rows on a fixed-column grid',
      initial.count === 5 &&
        initial.ths.join('|').toUpperCase().includes('NAME') &&
        initial.ths.join('|').toUpperCase().includes('SIZE KB') &&
        initial.row0.startsWith('1') &&
        initial.tracks.length === 7 &&
        initial.tracks[0] === 34 &&
        initial.tracks[1] === 150 &&
        initial.tracks[2] === 80 &&
        initial.tracks[3] === 76 &&
        initial.tracks[4] > 30 &&
        initial.tracks[4] < 150 &&
        initial.tracks[5] > 0,
      JSON.stringify(initial),
    );
    report(
      'headers keep spreadsheet casing (no uppercase transform)',
      initial.thCase === 'none',
      initial.thCase,
    );

    const toolbar = await page.evaluate(() => {
      const block = document.querySelector('.sf-table-demo-block');
      const lead = block.querySelector('.sf-tbl-search-side');
      const input = block.querySelector('.sf-tbl-search-input');
      const end = block.querySelector('.sf-tbl-search-side--end');
      const scroller = block.querySelector('.sf-tbl').parentElement;
      const r = (el) => Math.round(el.getBoundingClientRect().left);
      return {
        order: r(lead) < r(input) && r(input) < r(end),
        count: end.textContent.trim(),
        noOverflow: scroller.scrollWidth <= scroller.clientWidth + 1,
      };
    });
    report(
      'toolbar reads [lead | search | count] and the fitted columns never overflow on load',
      toolbar.order && toolbar.count === '5/5' && toolbar.noOverflow,
      JSON.stringify(toolbar),
    );

    await rowsIn('.sf-tbl-search-input').fill('ima');
    await delay(150);
    const searched = await rowsText();
    const countFiltered = await rowsIn('.sf-tbl-search-side--end').textContent();
    report(
      'the top search box filters rows across every column',
      searched.length === 2 && searched.every((t) => t.includes('image')) && countFiltered?.trim() === '2/5',
      JSON.stringify(searched),
    );
    await rowsIn('.sf-tbl-search-clear').click();
    await delay(150);
    const clearedCount = await rowsIn('.sf-tbl-search-side--end').textContent();
    report(
      'clearing the search restores the rows and the count',
      (await rowsIn('.sf-tbl-row').count()) === 5 && clearedCount?.trim() === '5/5',
    );

    await rowsIn('.sf-tbl-search-side .sf-tbl-btn').click();
    await delay(100);
    const leadActed = await page.evaluate(() => document.querySelector('.sf-table-demo-state').textContent);
    report('the toolbar lead slot hosts working actions', leadActed.includes('edits=1'), leadActed);
    await rowsIn('.sf-tbl-search-input').fill('mon');
    await delay(150);
    const daySearch = await rowsText();
    report(
      'the search matches any column, not just the first',
      daySearch.length === 3 && daySearch.every((t) => t.includes('Mon–Fri')),
      JSON.stringify(daySearch),
    );
    await rowsIn('.sf-tbl-search-clear').click();
    await delay(150);

    const gutters = await page.evaluate(() => {
      const block = document.querySelector('.sf-table-demo-block');
      return [...block.querySelectorAll('.sf-tbl-gutter')].map((g) => g.textContent);
    });
    report(
      'the gutter numbers the displayed rows 1..n',
      gutters.length === 6 && gutters[0] === '#' && gutters.slice(1).join(',') === '1,2,3,4,5',
      JSON.stringify(gutters),
    );

    const grid = await page.evaluate(() => {
      const block = document.querySelector('.sf-table-demo-block');
      const tbl = block.querySelector('.sf-tbl');
      const th = [...block.querySelectorAll('.sf-tbl-th')][1];
      const cell = [...block.querySelectorAll('.sf-tbl-row')][0].querySelectorAll('.sf-tbl-cell')[1];
      const s = (el) => getComputedStyle(el);
      return {
        tblTop: s(tbl).borderTopWidth,
        tblLeft: s(tbl).borderLeftWidth,
        thRight: s(th).borderRightWidth,
        thBottom: s(th).borderBottomWidth,
        cellRight: s(cell).borderRightWidth,
        cellBottom: s(cell).borderBottomWidth,
        sameColor:
          s(th).borderRightColor === s(cell).borderRightColor &&
          s(th).borderRightColor === s(tbl).borderTopColor,
      };
    });
    const alignCheck = await page.evaluate(() => {
      const block = document.querySelector('.sf-table-demo-block');
      const ths = [...block.querySelectorAll('.sf-tbl-th')];
      const cells = [...block.querySelector('.sf-tbl-row').querySelectorAll('.sf-tbl-cell')];
      const diffs = ths.map((th, i) =>
        Math.abs(th.getBoundingClientRect().right - cells[i].getBoundingClientRect().right),
      );
      return { pairs: ths.length, maxDiff: Math.max(...diffs) };
    });
    report(
      'header and body vertical borders line up column for column',
      alignCheck.pairs === 7 && alignCheck.maxDiff <= 1,
      JSON.stringify(alignCheck),
    );

    report(
      'the spreadsheet grid: outer frame plus right/bottom hairlines on every cell',
      grid.tblTop === '1px' &&
        grid.tblLeft === '1px' &&
        grid.thRight === '1px' &&
        grid.thBottom === '1px' &&
        grid.cellRight === '1px' &&
        grid.cellBottom === '1px' &&
        grid.sameColor,
      JSON.stringify(grid),
    );

    const nameHead = page.locator('.sf-table-demo-block:first-child .sf-tbl-th', { hasText: 'Name' });
    await nameHead.locator('.sf-tbl-hbtn').click();
    await delay(100);
    await rowsIn('.sf-tbl-pop-sortbtn').first().click();
    await delay(150);
    const asc = await rowsText();
    report(
      'dropdown A→Z sorts ascending and shows the ↑ indicator',
      (await nameHead.locator('.sf-tbl-sortind').textContent()) === '↑' &&
        asc[0].includes('archive.zip') &&
        asc[4].includes('report-final.md'),
      JSON.stringify(asc),
    );

    await rowsIn('.sf-tbl-pop-sortbtn').nth(1).click();
    await delay(150);
    const desc = await rowsText();
    report(
      'dropdown Z→A sorts descending (↓)',
      (await nameHead.locator('.sf-tbl-sortind').textContent()) === '↓' &&
        desc[0].includes('report-final.md'),
      JSON.stringify(desc),
    );

    await rowsIn('.sf-tbl-pop-sortbtn').nth(1).click();
    await delay(150);
    const unsorted = await rowsText();
    report(
      'clicking the active sort again clears it back to natural order',
      (await nameHead.locator('.sf-tbl-sortind').count()) === 0 && unsorted[0].includes('report-final.md'),
      JSON.stringify(unsorted),
    );
    await page.mouse.click(400, 10);
    await delay(100);

    const sizeHead = page.locator('.sf-table-demo-block:first-child .sf-tbl-th', { hasText: 'Size KB' });
    await sizeHead.locator('.sf-tbl-hbtn').click();
    await delay(150);
    const numSort = await rowsText();
    report(
      'sortable-only headers cycle on click and numeric columns sort by value',
      numSort[0].includes('12') && numSort[4].includes('2048'),
      JSON.stringify(numSort),
    );
    await sizeHead.locator('.sf-tbl-hbtn').click();
    await sizeHead.locator('.sf-tbl-hbtn').click();
    await delay(150);

    await nameHead.locator('.sf-tbl-hbtn').click();
    await delay(100);
    await rowsIn('.sf-tbl-pop-input').fill('ar');
    await delay(150);
    const textFilter = await rowsText();
    const nameActive = await nameHead.evaluate((el) => el.classList.contains('sf-tbl-th--active'));
    report(
      'search in the dropdown narrows rows by substring and marks the header active',
      textFilter.length === 2 && textFilter.every((t) => t.includes('ar')) && nameActive,
      JSON.stringify(textFilter),
    );

    await rowsIn('.sf-tbl-pop-clear').click();
    await page.mouse.click(400, 10);
    await delay(100);
    const closed = (await rowsText()).length;
    const popGone = (await rowsIn('.sf-tbl-pop').count()) === 0;
    report(
      'clear + outside click restores all rows and closes the dropdown',
      closed === 5 && popGone,
      `rows=${closed}`,
    );

    await nameHead.locator('.sf-tbl-hbtn').click();
    await delay(100);
    await rowsIn('.sf-tbl-pop-input').fill('zzz');
    await delay(150);
    const emptyFiltered = await rowsIn('.sf-tbl-empty').textContent();
    report('empty slot sees the filtered state', emptyFiltered?.trim() === 'No files match.', emptyFiltered);
    await rowsIn('.sf-tbl-pop-input').fill('');
    await delay(150);
    await page.mouse.click(400, 10);
    report('clearing the filter brings the rows back', (await rowsIn('.sf-tbl-row').count()) === 5);

    const kindHead = page.locator('.sf-table-demo-block:first-child .sf-tbl-th', { hasText: 'Kind' });
    await kindHead.locator('.sf-tbl-hbtn').click();
    await delay(100);
    const chkRow = (label) => rowsIn('.sf-tbl-chk').filter({ hasText: label }).first();
    await chkRow('doc').locator('input').click();
    await delay(150);
    const excluded = await rowsText();
    report(
      'unchecking an item in the value list hides its rows',
      excluded.length === 4 && excluded.every((t) => !t.includes('report-final.md')),
      JSON.stringify(excluded),
    );

    await chkRow('doc').locator('input').click();
    await delay(150);
    report('re-checking the item restores its rows', (await rowsIn('.sf-tbl-row').count()) === 5);

    await chkRow('(Select all)').locator('input').click();
    await delay(150);
    const noneChecked = await rowsText();
    report(
      '(Select all) off leaves no rows and the filtered empty state',
      noneChecked.length === 0 && (await rowsIn('.sf-tbl-empty').textContent())?.trim() === 'No files match.',
      JSON.stringify(noneChecked),
    );

    await chkRow('(Select all)').locator('input').click();
    await delay(150);
    report('(Select all) back on restores every row', (await rowsIn('.sf-tbl-row').count()) === 5);

    await rowsIn('.sf-tbl-pop-input').fill('ima');
    await delay(150);
    const narrowed = await page.evaluate(() => {
      const pop = document.querySelector('.sf-table-demo-block .sf-tbl-pop');
      return {
        items: [...pop.querySelectorAll('.sf-tbl-chk-val')]
          .map((c) => c.textContent)
          .filter((t) => t !== '(Select all)'),
        rows: [...document.querySelector('.sf-table-demo-block').querySelectorAll('.sf-tbl-row')].length,
      };
    });
    report(
      'typing in the dropdown narrows the value list and the rows together',
      narrowed.items.length === 1 && narrowed.items[0] === 'image' && narrowed.rows === 2,
      JSON.stringify(narrowed),
    );
    await rowsIn('.sf-tbl-pop-clear').click();
    await delay(150);
    const clearedBoth = await page.evaluate(() => {
      const block = document.querySelector('.sf-table-demo-block');
      return {
        rows: [...block.querySelectorAll('.sf-tbl-row')].length,
        on: block.querySelectorAll('.sf-tbl-th--active').length,
      };
    });
    report(
      'clear wipes the search and the exclusions',
      clearedBoth.rows === 5 && clearedBoth.on === 0,
      JSON.stringify(clearedBoth),
    );
    await page.mouse.click(400, 10);

    const headBox = await nameHead.boundingBox();
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
        head: getComputedStyle(head).gridTemplateColumns.split(' ')[1],
        row: getComputedStyle(row).gridTemplateColumns.split(' ')[1],
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

    const hd2 = await nameHead.boundingBox();
    await page.mouse.dblclick(hd2.x + hd2.width - 1, hd2.y + hd2.height / 2);
    await delay(150);
    const reset = await page.evaluate(() => {
      const block = document.querySelector('.sf-table-demo-block');
      return getComputedStyle(block.querySelector('.sf-tbl-head')).gridTemplateColumns.split(' ')[1];
    });
    report('double-click on the handle resets the column width', reset === '150px', reset);

    const kindTh = page.locator('.sf-table-demo-block:first-child .sf-tbl-th', { hasText: 'Kind' });
    const thRights = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('.sf-table-demo-block:first-child .sf-tbl-th')].map((t) =>
          Math.round(t.getBoundingClientRect().right),
        ),
      );
    const before = await thRights();
    const kb = await kindTh.boundingBox();
    await page.mouse.move(kb.x + kb.width - 1, kb.y + kb.height / 2);
    await page.mouse.down();
    await page.mouse.move(kb.x + kb.width + 39, kb.y + kb.height / 2, { steps: 6 });
    await page.mouse.up();
    await delay(150);
    const after = await thRights();
    report(
      'dragging a border moves it and the columns right of it, never the ones left of it',
      after[0] === before[0] &&
        after[1] === before[1] &&
        Math.abs(after[2] - before[2] - 40) <= 2 &&
        Math.abs(after[3] - before[3] - 40) <= 2 &&
        Math.abs(after[4] - before[4] - 40) <= 2 &&
        after[6] === before[6],
      `before=${before} after=${after}`,
    );

    const preClamp = await page.evaluate(() => {
      const block = document.querySelector('.sf-table-demo-block');
      return {
        tracks: getComputedStyle(block.querySelector('.sf-tbl-row'))
          .gridTemplateColumns.split(' ')
          .map(parseFloat),
        handles: block.querySelectorAll('.sf-tbl-head .sf-tbl-resize').length,
      };
    });
    const kb2 = await kindTh.boundingBox();
    await page.mouse.move(kb2.x + kb2.width - 1, kb2.y + kb2.height / 2);
    await page.mouse.down();
    await page.mouse.move(kb2.x + kb2.width + 600, kb2.y + kb2.height / 2, { steps: 8 });
    await page.mouse.up();
    await delay(150);
    const clamped = await page.evaluate(() => {
      const block = document.querySelector('.sf-table-demo-block');
      const scroller = block.querySelector('.sf-tbl').parentElement;
      const tracks = getComputedStyle(block.querySelector('.sf-tbl-row'))
        .gridTemplateColumns.split(' ')
        .map(parseFloat);
      return { note: tracks[5], kind: tracks[2], scrolled: scroller.scrollWidth > scroller.clientWidth + 1 };
    });
    const t = preClamp.tracks;
    const expectedKind = t[2] + Math.max(0, t[5] - 48) + Math.max(0, t[3] - 48) + Math.max(0, t[4] - 48);
    report(
      'growth stops when every column to the right floors at its min-width and the table never overflows',
      clamped.note === 48 && Math.abs(clamped.kind - expectedKind) <= 2 && !clamped.scrolled,
      JSON.stringify({ ...clamped, expectedKind }),
    );
    report('the last column carries no resize handle', preClamp.handles === 4, `handles=${preClamp.handles}`);
    await nameHead.click({ button: 'right' });
    await delay(150);
    await page
      .locator('.sf-table-demo-block:first-child .sf-tbl-colmenu-act', { hasText: 'Reset column widths' })
      .click();
    await delay(150);
    const kindReset = await page.evaluate(() => {
      const block = document.querySelector('.sf-table-demo-block');
      return getComputedStyle(block.querySelector('.sf-tbl-head')).gridTemplateColumns.split(' ')[2];
    });
    report('resetting widths recovers from the overflow', kindReset === '80px', kindReset);
    await page.mouse.click(400, 10);
    await delay(100);

    await nameHead.click({ button: 'right' });
    await delay(150);
    const menuOpen = (await rowsIn('.sf-tbl-colmenu').count()) === 1;
    await rowsIn('.sf-tbl-chk').filter({ hasText: 'Kind' }).locator('input').click();
    await delay(150);
    const kindGone = await page.evaluate(() => {
      const block = document.querySelector('.sf-table-demo-block');
      const ths = [...block.querySelectorAll('.sf-tbl-th')].map((t) => t.textContent);
      return { n: ths.length, hasKind: ths.some((t) => t.includes('Kind')) };
    });
    report(
      'right-click on a header opens the column menu; unchecking hides the column',
      menuOpen && kindGone.n === 6 && !kindGone.hasKind,
      JSON.stringify(kindGone),
    );

    await nameHead.click({ button: 'right' });
    await delay(150);
    await rowsIn('.sf-tbl-chk').filter({ hasText: 'Kind' }).locator('input').click();
    await delay(150);
    report('re-checking brings the column back', (await rowsIn('.sf-tbl-th').count()) === 7);

    await nameHead.click({ button: 'right' });
    await delay(150);
    await rowsIn('.sf-tbl-chk').filter({ hasText: 'Size KB' }).locator('input').click();
    await delay(100);
    await nameHead.click({ button: 'right' });
    await delay(150);
    await page
      .locator('.sf-table-demo-block:first-child .sf-tbl-colmenu-act', { hasText: 'Show all columns' })
      .click();
    await delay(150);
    report('show-all restores every column', (await rowsIn('.sf-tbl-th').count()) === 7);

    await page.mouse.click(400, 10);
    await delay(100);
    const nb = await nameHead.boundingBox();
    await page.mouse.move(nb.x + nb.width - 1, nb.y + nb.height / 2);
    await page.mouse.down();
    await page.mouse.move(nb.x + nb.width + 39, nb.y + nb.height / 2, { steps: 6 });
    await page.mouse.up();
    await delay(150);
    await nameHead.click({ button: 'right' });
    await delay(150);
    await page
      .locator('.sf-table-demo-block:first-child .sf-tbl-colmenu-act', { hasText: 'Reset column widths' })
      .click();
    await delay(150);
    const afterMenuReset = await page.evaluate(() => {
      const block = document.querySelector('.sf-table-demo-block');
      return getComputedStyle(block.querySelector('.sf-tbl-head')).gridTemplateColumns.split(' ')[1];
    });
    report('the menu resets every column width', afterMenuReset === '150px', afterMenuReset);

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
      const gutter = row.querySelector('.sf-tbl-gutter');
      return {
        head: getComputedStyle(block.querySelector('.sf-tbl-head')).display,
        template: rs.gridTemplateAreas.includes('title'),
        titleTop: title.getBoundingClientRect().top,
        subTop: sub.getBoundingClientRect().top,
        btnW: btn.getBoundingClientRect().width,
        btnH: btn.getBoundingClientRect().height,
        hiddenDisplay: hidden ? getComputedStyle(hidden).display : 'absent',
        noBorder:
          getComputedStyle(title).borderRightWidth === '0px' &&
          getComputedStyle(title).borderBottomWidth === '0px',
        gutter: gutter ? getComputedStyle(gutter).display : 'absent',
      };
    });
    report(
      'mobile: header hides, rows become borderless cards with square actions, gutter gone',
      mobile.head === 'none' &&
        mobile.template === true &&
        mobile.subTop > mobile.titleTop &&
        mobile.btnW === 44 &&
        mobile.btnH === 44 &&
        (mobile.hiddenDisplay === 'none' || mobile.hiddenDisplay === 'absent') &&
        mobile.noBorder &&
        (mobile.gutter === 'none' || mobile.gutter === 'absent'),
      JSON.stringify(mobile),
    );

    const mobileToolbar = await page.evaluate(() => {
      const block = document.querySelector('.sf-table-demo-block');
      const bar = block.querySelector('.sf-tbl-search');
      const input = block.querySelector('.sf-tbl-search-input');
      const lead = block.querySelector('.sf-tbl-search-side .sf-tbl-btn');
      return {
        barH: Math.round(bar.getBoundingClientRect().height),
        inputH: Math.round(input.getBoundingClientRect().height),
        leadW: Math.round(lead.getBoundingClientRect().width),
        leadH: Math.round(lead.getBoundingClientRect().height),
      };
    });
    report(
      'mobile: the toolbar grows to a 60px bar with touch-sized input and lead button',
      mobileToolbar.barH === 60 &&
        mobileToolbar.inputH >= 36 &&
        mobileToolbar.leadW === 44 &&
        mobileToolbar.leadH === 44,
      JSON.stringify(mobileToolbar),
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
    await finish(
      browser,
      serverProc,
      isFailed() || process.exitCode === 1 || errors.length > 0,
      'TABLE CHECKS',
    );
  }
})();
