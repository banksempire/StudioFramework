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
        initial.tracks[4] > 100 &&
        initial.tracks[4] < 220 &&
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

    const clearInside = await rowsIn('.sf-tbl-search-box').evaluate((box) => {
      const b = box.getBoundingClientRect();
      const c = box.querySelector('.sf-tbl-search-clear');
      if (!c) return { present: false };
      const r = c.getBoundingClientRect();
      return {
        present: true,
        inside: r.right <= b.right - 1 && r.top >= b.top - 1 && r.bottom <= b.bottom + 1,
        centered: Math.abs((r.top + r.bottom) / 2 - (b.top + b.bottom) / 2) <= 2,
      };
    });
    report(
      'the clear ✕ sits inside the search box, vertically centered',
      clearInside.present && clearInside.inside && clearInside.centered,
      JSON.stringify(clearInside),
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

    const jobGeom = () =>
      page.evaluate(() => {
        const block = [...document.querySelectorAll('.sf-table-demo-block')][1];
        const bar = block.querySelector('.sf-tbl-search');
        const scroller = block.querySelector('.sf-tbl-scroll');
        const head = block.querySelector('.sf-tbl-head');
        const row = block.querySelector('.sf-tbl-row');
        return {
          barTop: Math.round(bar.getBoundingClientRect().top),
          headTop: Math.round(head.getBoundingClientRect().top),
          rowTop: Math.round(row.getBoundingClientRect().top),
          scrollTop: scroller.scrollTop,
          overflows: scroller.scrollHeight > scroller.clientHeight,
          x: scroller.getBoundingClientRect().left + 100,
          y: scroller.getBoundingClientRect().top + scroller.getBoundingClientRect().height / 2,
        };
      });
    const scrollBefore = await jobGeom();
    await page.mouse.move(scrollBefore.x, scrollBefore.y);
    await page.mouse.wheel(0, 140);
    await delay(300);
    const scrollAfter = await jobGeom();
    report(
      'scrolling moves only the rows: toolbar and column header stay pinned',
      scrollBefore.overflows &&
        scrollAfter.scrollTop > 40 &&
        Math.abs(scrollAfter.barTop - scrollBefore.barTop) <= 1 &&
        Math.abs(scrollAfter.headTop - scrollBefore.headTop) <= 1 &&
        scrollAfter.rowTop < scrollBefore.rowTop - 100,
      JSON.stringify({ before: scrollBefore, after: scrollAfter }),
    );
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

    const daysHead = page.locator('.sf-table-demo-block:first-child .sf-tbl-th', { hasText: 'Days' });
    const headBox = await daysHead.boundingBox();
    const handleX = headBox.x + headBox.width - 1;
    const preDrag = await page.evaluate(() => {
      const block = document.querySelector('.sf-table-demo-block');
      return getComputedStyle(block.querySelector('.sf-tbl-head'))
        .gridTemplateColumns.split(' ')
        .map(parseFloat);
    });
    await page.mouse.move(handleX, headBox.y + headBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleX + 40, headBox.y + headBox.height / 2, { steps: 8 });
    await page.mouse.up();
    await delay(150);
    const resized = await page.evaluate(() => {
      const block = document.querySelector('.sf-table-demo-block');
      const head = block.querySelector('.sf-tbl-head');
      const row = block.querySelector('.sf-tbl-row');
      return {
        head: getComputedStyle(head).gridTemplateColumns.split(' ')[4],
        row: getComputedStyle(row).gridTemplateColumns.split(' ')[4],
        note: getComputedStyle(head).gridTemplateColumns.split(' ')[5],
      };
    });
    report(
      'dragging the Days/Note edge widens Days from Note for header and rows alike',
      Math.abs(parseFloat(resized.head) - preDrag[4] - 40) <= 2 &&
        resized.head === resized.row &&
        Math.abs(parseFloat(resized.note) - preDrag[5] + 40) <= 2,
      JSON.stringify({ preDrag, resized }),
    );

    const thRights = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('.sf-table-demo-block:first-child .sf-tbl-th')].map((t) =>
          Math.round(t.getBoundingClientRect().right),
        ),
      );
    const before = await thRights();
    const kb = await daysHead.boundingBox();
    await page.mouse.move(kb.x + kb.width - 1, kb.y + kb.height / 2);
    await page.mouse.down();
    await page.mouse.move(kb.x + kb.width + 39, kb.y + kb.height / 2, { steps: 6 });
    await page.mouse.up();
    await delay(150);
    const after = await thRights();
    report(
      'dragging the Days/Note border right moves it and the note edge, never the columns left of it',
      after[0] === before[0] &&
        after[1] === before[1] &&
        after[2] === before[2] &&
        after[3] === before[3] &&
        after[4] - before[4] >= 30 &&
        after[4] - before[4] <= 40 &&
        after[5] === before[5] &&
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
    const kb2 = await daysHead.boundingBox();
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
      return { note: tracks[5], days: tracks[4], scrolled: scroller.scrollWidth > scroller.clientWidth + 1 };
    });
    const t = preClamp.tracks;
    const expectedDays = t[4] + Math.max(0, t[5] - 48);
    report(
      'growth stops when the variable column to the right floors at its min-width and the table never overflows',
      clamped.note >= 47.5 &&
        clamped.note <= 48.5 &&
        Math.abs(clamped.days - expectedDays) <= 2 &&
        !clamped.scrolled,
      JSON.stringify({ ...clamped, expectedDays }),
    );

    await page.evaluate(() => {
      const s = document.createElement('style');
      s.id = 'sf-table-narrow';
      s.textContent = '.sf-table-demo-block:first-child .sf-tbl-wrap { max-width: 360px !important; }';
      document.head.appendChild(s);
    });
    await delay(400);
    await page.locator('.sf-table-demo').scrollIntoViewIfNeeded();
    await delay(150);
    const wheelBox = await page.evaluate(() => {
      const scroller = document.querySelector('.sf-table-demo-block .sf-tbl-scroll');
      scroller.scrollTop = 0;
      const r = scroller.getBoundingClientRect();
      return { x: Math.round(r.left + Math.min(120, r.width / 2)), y: Math.round(r.top + r.height / 2) };
    });
    await page.mouse.move(wheelBox.x, wheelBox.y);
    const narrowState = await page.evaluate(() => {
      const scroller = document.querySelector('.sf-table-demo-block .sf-tbl-scroll');
      return {
        ox: getComputedStyle(scroller).overflowX,
        cw: scroller.clientWidth,
        sw: scroller.scrollWidth,
        scrollbar: scroller.offsetWidth - scroller.clientWidth,
      };
    });
    await page.mouse.wheel(180, 0);
    await delay(150);
    const xAfter = await page.evaluate(
      () => document.querySelector('.sf-table-demo-block .sf-tbl-scroll').scrollLeft,
    );
    await page.evaluate(() => document.getElementById('sf-table-narrow')?.remove());
    await delay(200);
    report(
      'squeezed below its column floors the table never pans horizontally (wheel deltaX is a no-op)',
      narrowState.ox === 'hidden' &&
        narrowState.scrollbar === 0 &&
        xAfter === 0 &&
        narrowState.cw < narrowState.sw,
      JSON.stringify({ ...narrowState, xAfter }),
    );
    report(
      'handles render only between columns that can exchange space',
      preClamp.handles === 1,
      `handles=${preClamp.handles}`,
    );
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

    const tracksOf = () =>
      page.evaluate(() => {
        const head = document.querySelector('.sf-table-demo-block .sf-tbl-head');
        return getComputedStyle(head).gridTemplateColumns.split(' ').map(parseFloat);
      });
    const evenBefore = await tracksOf();
    await nameHead.click({ button: 'right' });
    await delay(150);
    await rowsIn('.sf-tbl-chk').filter({ hasText: 'Size KB' }).locator('input').click();
    await delay(300);
    const evenHidden = await tracksOf();
    report(
      'hiding a fixed column shares the freed space evenly across the variable columns',
      Math.abs(evenHidden[3] - evenBefore[4] - 38) <= 2 && Math.abs(evenHidden[4] - evenBefore[5] - 38) <= 2,
      JSON.stringify({ evenBefore, evenHidden }),
    );
    await nameHead.click({ button: 'right' });
    await delay(150);
    await rowsIn('.sf-tbl-chk').filter({ hasText: 'Size KB' }).locator('input').click();
    await delay(300);
    const evenRestored = await tracksOf();
    report(
      'showing the fixed column back takes the space evenly from the variable columns',
      Math.abs(evenRestored[4] - evenHidden[3] + 38) <= 2 &&
        Math.abs(evenRestored[5] - evenHidden[4] + 38) <= 2,
      JSON.stringify({ evenHidden, evenRestored }),
    );

    await page.evaluate(() => {
      const s = document.createElement('style');
      s.id = 'sf-table-even';
      s.textContent = '.sf-table-demo-block:first-child .sf-tbl-wrap { max-width: 624px !important; }';
      document.head.appendChild(s);
    });
    await delay(400);
    const squeezed = await tracksOf();
    const daysLost = evenRestored[4] - squeezed[4];
    const noteLost = evenRestored[5] - squeezed[5];
    report(
      'shrinking the window takes space evenly from the variable columns',
      daysLost > 0 && Math.abs(daysLost - noteLost) <= 2 && squeezed[4] >= 47 && squeezed[5] >= 47,
      JSON.stringify({ evenRestored, squeezed, daysLost, noteLost }),
    );
    await page.evaluate(() => document.getElementById('sf-table-even')?.remove());
    await delay(400);
    const regrown = await tracksOf();
    const daysGained = regrown[4] - squeezed[4];
    const noteGained = regrown[5] - squeezed[5];
    report(
      'growing the window gives the space evenly back to the variable columns',
      Math.abs(daysGained - noteGained) <= 2 &&
        Math.abs(regrown[4] - evenRestored[4]) <= 2 &&
        Math.abs(regrown[5] - evenRestored[5]) <= 2,
      JSON.stringify({ squeezed, regrown, daysGained, noteGained }),
    );

    await page.evaluate(() => {
      const s = document.createElement('style');
      s.id = 'sf-table-floor';
      s.textContent = '.sf-table-demo-block:first-child .sf-tbl-wrap { max-width: 484px !important; }';
      document.head.appendChild(s);
    });
    await delay(400);
    const floored = await tracksOf();
    report(
      'squeezing below the column floors parks the variable columns at min-width',
      floored[4] >= 47 && floored[4] <= 49 && floored[5] >= 47 && floored[5] <= 49,
      JSON.stringify({ evenRestored, floored }),
    );
    await page.evaluate(() => document.getElementById('sf-table-floor')?.remove());
    await delay(400);
    const unfloored = await tracksOf();
    report(
      'widening back after a floor-bound squeeze restores the pre-squeeze widths exactly',
      Math.abs(unfloored[4] - evenRestored[4]) <= 1 && Math.abs(unfloored[5] - evenRestored[5]) <= 1,
      JSON.stringify({ evenRestored, floored, unfloored }),
    );

    const kb3 = await daysHead.boundingBox();
    await page.mouse.move(kb3.x + kb3.width - 1, kb3.y + kb3.height / 2);
    await page.mouse.down();
    await page.mouse.move(kb3.x + kb3.width + 40, kb3.y + kb3.height / 2, { steps: 6 });
    await page.mouse.up();
    await delay(150);
    const dragged = await tracksOf();
    await page.evaluate(() => {
      const s = document.createElement('style');
      s.id = 'sf-table-dragwrap';
      s.textContent = '.sf-table-demo-block:first-child .sf-tbl-wrap { max-width: 624px !important; }';
      document.head.appendChild(s);
    });
    await delay(400);
    const draggedSqueezed = await tracksOf();
    await page.evaluate(() => document.getElementById('sf-table-dragwrap')?.remove());
    await delay(400);
    const draggedRegrown = await tracksOf();
    report(
      'a user-dragged width survives shrink and regrow of the container',
      Math.abs(draggedRegrown[4] - dragged[4]) <= 1 && Math.abs(draggedRegrown[5] - dragged[5]) <= 1,
      JSON.stringify({ dragged, draggedSqueezed, draggedRegrown }),
    );
    await nameHead.click({ button: 'right' });
    await delay(150);
    await page
      .locator('.sf-table-demo-block:first-child .sf-tbl-colmenu-act', { hasText: 'Reset column widths' })
      .click();
    await delay(150);
    const resetTracks = await tracksOf();
    report(
      'resetting widths re-anchors the variable columns at their content widths',
      Math.abs(resetTracks[4] - evenRestored[4]) <= 1 && Math.abs(resetTracks[5] - evenRestored[5]) <= 1,
      JSON.stringify({ dragged, resetTracks }),
    );

    await nameHead.click({ button: 'right' });
    await delay(150);
    await rowsIn('.sf-tbl-chk').filter({ hasText: 'Note' }).locator('input').click();
    await delay(250);
    const absorb = await page.evaluate(() => {
      const block = document.querySelector('.sf-table-demo-block');
      const scroller = block.querySelector('.sf-tbl-scroll');
      const head = block.querySelector('.sf-tbl-head');
      const lastTh = [...head.querySelectorAll('.sf-tbl-th')].pop();
      const tracks = getComputedStyle(head).gridTemplateColumns.split(' ').map(parseFloat);
      return {
        edge: Math.abs(lastTh.getBoundingClientRect().right - scroller.getBoundingClientRect().right),
        sum: tracks.reduce((a, b) => a + b, 0),
        w: scroller.clientWidth,
        noteVisible: [...head.querySelectorAll('.sf-tbl-th')].some((t) => t.textContent.includes('Note')),
      };
    });
    report(
      'hiding the flexible column leaves no gap: the first variable column absorbs the freed space',
      !absorb.noteVisible && absorb.edge <= 1 && Math.abs(absorb.sum - absorb.w) <= 1,
      JSON.stringify(absorb),
    );
    await nameHead.click({ button: 'right' });
    await delay(150);
    await rowsIn('.sf-tbl-chk').filter({ hasText: 'Days' }).locator('input').click();
    await delay(250);
    const absorbFixed = await page.evaluate(() => {
      const block = document.querySelector('.sf-table-demo-block');
      const scroller = block.querySelector('.sf-tbl-scroll');
      const head = block.querySelector('.sf-tbl-head');
      const lastTh = [...head.querySelectorAll('.sf-tbl-th')].pop();
      const tracks = getComputedStyle(head).gridTemplateColumns.split(' ').map(parseFloat);
      return {
        edge: Math.abs(lastTh.getBoundingClientRect().right - scroller.getBoundingClientRect().right),
        sum: tracks.reduce((a, b) => a + b, 0),
        w: scroller.clientWidth,
      };
    });
    report(
      'with every variable column hidden the leftover stays unallocated, like a panel with no resizeable sub-sections',
      absorbFixed.edge > 50 && absorbFixed.sum < absorbFixed.w - 50,
      JSON.stringify(absorbFixed),
    );

    await nameHead.click({ button: 'right' });
    await delay(150);
    await page
      .locator('.sf-table-demo-block:first-child .sf-tbl-colmenu-act', { hasText: 'Show all columns' })
      .click();
    await delay(250);
    const restoredFill = await page.evaluate(() => {
      const block = document.querySelector('.sf-table-demo-block');
      const scroller = block.querySelector('.sf-tbl-scroll');
      const head = block.querySelector('.sf-tbl-head');
      const tracks = getComputedStyle(head).gridTemplateColumns.split(' ').map(parseFloat);
      return (
        Math.abs(tracks.reduce((a, b) => a + b, 0) - scroller.clientWidth) <= 1 &&
        [...head.querySelectorAll('.sf-tbl-th')].some((t) => t.textContent.includes('Note'))
      );
    });
    report('Show all columns restores the grid exactly filled', restoredFill);

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
