/**
 * Drag-to-tile (DTT) interaction tests.
 * Usage: npm run check:dtt
 */
const { ensureServer, openApp, makeReporter, finish } = require('./lib/ui-test.cjs');

const WS = '.sf-workspace';

(async () => {
  const serverProc = await ensureServer();
  const { browser, page, errors } = await openApp();
  const { report, isFailed } = makeReporter();

  await page.reload({ waitUntil: 'networkidle' }); // fresh workspace state
  await page.waitForTimeout(500);

  const wsBox = await page.locator(WS).boundingBox();

  // ── 0. mid-drag: landing preview renders; cancel cleans up ──────────────
  const firstTab = page.locator('.sf-tab').first();
  const ftb = await firstTab.boundingBox();
  await page.mouse.move(ftb.x + ftb.width / 2, ftb.y + ftb.height / 2);
  await page.mouse.down();
  await page.mouse.move(ftb.x + ftb.width / 2 + 30, ftb.y + ftb.height / 2, { steps: 3 }); // start drag
  await page.waitForTimeout(250);
  await page.mouse.move(wsBox.x + wsBox.width - 10, wsBox.y + wsBox.height / 2, { steps: 8 }); // right edge
  await page.waitForTimeout(250);
  report('split preview shows the landing half', (await page.locator('.sf-dnd-preview').count()) === 1);
  await page.keyboard.press('Escape'); // cancel drag
  await page.waitForTimeout(250);
  report('drag cancel cleans up the layer', (await page.locator('.sf-dnd-layer').count()) === 0);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  const tab = (label) => page.locator(`.sf-tab:has-text("${label}")`);
  const tileTabs = (i) => page.locator('.sf-tile').nth(i).locator('.sf-tab-label').allTextContents();
  const tileCount = () => page.locator('.sf-tile').count();

  const dropAt = async (sourceLabel, x, y) => {
    await tab(sourceLabel).dragTo(page.locator(WS), { targetPosition: { x, y } });
    await page.waitForTimeout(350);
  };
  const tileBox = async (i) => page.locator('.sf-tile').nth(i).boundingBox();

  // ── 1. split right: drag app.ts onto the right edge → 2 tiles, half each ─
  report('initial: single tile, 4 tabs', (await tileCount()) === 1 && (await tileTabs(0)).length === 4);
  const tileW = wsBox.width;
  await dropAt('app.ts', wsBox.width - 10, wsBox.height / 2);
  report('split right → 2 tiles', (await tileCount()) === 2);
  const w1 = await tileBox(1);
  report('dragged tab takes ~half the window', Math.abs(w1.width - tileW / 2) < 30, `${w1.width}px vs half=${(tileW / 2).toFixed(0)}px`);
  report('right tile holds app.ts', JSON.stringify(await tileTabs(1)) === JSON.stringify(['app.ts']));
  report('left tile keeps the rest', (await tileTabs(0)).length === 3);

  // ── 2. move: drag utils.ts onto the right tile's tab strip → inserted ───
  await dropAt('utils.ts', w1.x - wsBox.x + w1.width / 2, 15);
  report('move into right tile', JSON.stringify(await tileTabs(1)) === JSON.stringify(['app.ts', 'utils.ts']));
  report('source tile keeps remaining', (await tileTabs(0)).length === 2);

  // ── 3. split bottom: drag styles.css onto the bottom edge of right tile ─
  await dropAt('styles.css', w1.x - wsBox.x + w1.width / 2, w1.height - 2);
  report('split bottom → 3 tiles', (await tileCount()) === 3);
  report('cross-tile split removes from source', JSON.stringify(await tileTabs(0)) === JSON.stringify(['Welcome']));
  report('bottom tile holds styles.css', JSON.stringify(await tileTabs(2)) === JSON.stringify(['styles.css']));

  // ── 4. split top: drag app.ts onto the top band of the bottom tile ──────
  const t2 = await tileBox(2);
  const t2BandH = Math.min(Math.max(t2.height * 0.25, 28), 56);
  await dropAt('app.ts', t2.x - wsBox.x + t2.width / 2, t2.y - wsBox.y + 30 + 6 + t2BandH / 2);
  report('split top → 4 tiles', (await tileCount()) === 4);
  report('top tile holds dragged tab', JSON.stringify(await tileTabs(2)) === JSON.stringify(['app.ts']));
  report('target tile keeps its tab', JSON.stringify(await tileTabs(3)) === JSON.stringify(['styles.css']));
  report('source tile keeps remaining', JSON.stringify(await tileTabs(1)) === JSON.stringify(['utils.ts']));

  // ── 5. close the last tab of the top-right tile → merges back to 2 ──────
  await tab('app.ts').hover();
  await tab('app.ts').locator('.sf-tab-close').click();
  await page.waitForTimeout(250);
  await tab('utils.ts').hover();
  await tab('utils.ts').locator('.sf-tab-close').click();
  await page.waitForTimeout(250);
  report('closing last tabs of side tiles merges', (await tileCount()) === 2);

  // ── 6. sash resize: drag row sash +80px → left tile grows ~80px ─────────
  const sash = page.locator('.sf-sash--row');
  const sashBox = await sash.boundingBox();
  const before = (await tileBox(0)).width;
  await page.mouse.move(sashBox.x + sashBox.width / 2, sashBox.y + sashBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(sashBox.x + sashBox.width / 2 + 80, sashBox.y + sashBox.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(250);
  const after = (await tileBox(0)).width;
  report('sash resize changes split', Math.abs(after - before - 80) < 12, `+${(after - before).toFixed(0)}px`);

  // ── 7. proportional resize: window wider → ratio preserved ───────────────
  const rBefore = after / (await tileBox(1)).width;
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.waitForTimeout(300);
  const wa = (await tileBox(0)).width;
  const wb = (await tileBox(1)).width;
  const rAfter = wa / wb;
  report('proportions preserved on window resize', Math.abs(rBefore - rAfter) < 0.02, `ratio ${rBefore.toFixed(3)} → ${rAfter.toFixed(3)}`);

  // ── 8. min size respected: shrink window hard → tiles never below min ────
  await page.setViewportSize({ width: 700, height: 500 });
  await page.waitForTimeout(300);
  const minW = Math.min((await tileBox(0)).width, (await tileBox(1)).width);
  report('tiles never shrink below min width', minW >= 155, `${minW.toFixed(0)}px`);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(300);

  // ── 9. reorder + empty-source merge: styles.css to tile 0 strip start ────
  const leftBox = await tileBox(0);
  await dropAt('styles.css', leftBox.x - wsBox.x + 20, 15); // strip, before Welcome
  report('reorder into strip start', JSON.stringify(await tileTabs(0)) === JSON.stringify(['styles.css', 'Welcome']));
  report('emptied source tile merges away', (await tileCount()) === 1);

  report('no console/page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

  await finish(browser, serverProc, isFailed(), 'DTT CHECKS');
})().catch((e) => { console.error('aborted:', e.message); process.exit(2); });
