/**
 * Workspace-width-based auto-hide with two triggers:
 *
 * 1. Window resize: progressive auto-hide. Hide LEFT first, then RIGHT
 *    when narrowing. Restore RIGHT first, then LEFT when widening.
 * 2. Panel expansion (drag wider): hide the OTHER panel (one-time).
 *    - Drag back narrower: REVERT the auto-hide if workspace would be >= 640px
 *      with both panels open. Does NOT expand user-collapsed panels.
 *    - The left toggle still collapses the docker while auto-hidden;
 *      clicking again re-opens the group (user override, no re-trigger).
 *
 * Also: if one panel is already user-collapsed, the would-be workspace width
 * is calculated without it, so auto-hide only triggers if still too narrow.
 */
const { ensureServer, openApp, makeReporter, finish } = require('./lib/ui-test.cjs');

// Default panel widths: 260px each. Docker: 48px. MIN_WORKSPACE_WIDTH: 640px.
// At 1300px: ws = 1300-48-260-260 = 732px (both visible)
// Drag right +160 (260->420): ws = 1300-48-260-420 = 572px < 640 -> trigger
// Drag right -160 (420->260): ws = 732px >= 640 -> revert

(async () => {
  const serverProc = await ensureServer();
  const { browser, page, errors } = await openApp({ viewport: { width: 1300, height: 900 } });
  const { report, isFailed } = makeReporter();

  try {
    // ── Helpers ────────────────────────────────────────────────────────────

    const panelDisplayed = async (side) => {
      return page.evaluate((s) => {
        const el = document.querySelector(`.sf-panel--${s}`);
        if (!el) return null;
        return getComputedStyle(el).display !== 'none';
      }, side);
    };

    /** The whole left group (docker bar + panel) actually on screen. */
    const leftGroupDisplayed = async () => {
      return page.evaluate(() => {
        const el = document.querySelector('.sf-left-group');
        if (!el) return null;
        return getComputedStyle(el).display !== 'none';
      });
    };

    const resizeTo = async (w) => {
      await page.setViewportSize({ width: w, height: 900 });
      await page.waitForTimeout(100);
    };

    /** Drag a panel's resize handle. deltaPx > 0 = make wider. */
    const dragPanel = async (side, deltaPx) => {
      const handleClass =
        side === 'left' ? '.sf-panel-resize-handle--right' : '.sf-panel-resize-handle--left';
      const handle = await page.$(handleClass);
      if (!handle) {
        report(`handle found: ${side}`, false);
        return;
      }
      const box = await handle.boundingBox();
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      const dir = side === 'left' ? 1 : -1;
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(cx + deltaPx * dir, cy, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(100);
    };

    // ── Phase 1: Window resize trigger (progressive: left first, then right) ─

    await resizeTo(1300);
    report(
      'both visible at 1300px',
      (await panelDisplayed('left')) === true && (await panelDisplayed('right')) === true,
    );

    // Narrow to 1000px: ws=432 < 640 but wNoLeft=692 >= 640 -> left hidden, right visible
    await resizeTo(1000);
    report(
      'left hidden at 1000px (left first)',
      (await panelDisplayed('left')) === false && (await panelDisplayed('right')) === true,
    );

    // Narrow to 900px: wNoLeft=592 < 640 -> both hidden
    await resizeTo(900);
    report(
      'both hidden at 900px',
      (await panelDisplayed('left')) === false && (await panelDisplayed('right')) === false,
    );

    // Widen to 1000px: right restored first (reverse order)
    await resizeTo(1000);
    report(
      'right restored at 1000px (right first)',
      (await panelDisplayed('left')) === false && (await panelDisplayed('right')) === true,
    );

    // Widen to 1300px: left also restored
    await resizeTo(1300);
    report(
      'both restored at 1300px',
      (await panelDisplayed('left')) === true && (await panelDisplayed('right')) === true,
    );

    // ── Phase 2: Panel expansion + revert ─────────────────────────────────

    // Drag right wider -> left auto-hides
    await dragPanel('right', 160);
    report('left auto-hidden after expanding right', (await panelDisplayed('left')) === false);
    report('right still visible', (await panelDisplayed('right')) === true);

    // Drag right back narrower -> left reverted (workspace wide enough for both)
    await dragPanel('right', -160);
    report('left reverted after shrinking right back', (await panelDisplayed('left')) === true);
    report('right still visible', (await panelDisplayed('right')) === true);

    // ── Phase 3: One-time + re-trigger after reset ────────────────────────

    // Drag right wider again -> left auto-hides (new trigger)
    await dragPanel('right', 160);
    report('left auto-hidden again (new trigger)', (await panelDisplayed('left')) === false);

    // Click left toggle -> collapses the whole group (docker bar included)
    await page.locator('.sf-menu-action-btn').first().click();
    await page.waitForTimeout(100);
    report('left group collapsed by toggle while auto-hidden', (await leftGroupDisplayed()) === false);

    // Click again -> restores the group (user override, stays open)
    await page.locator('.sf-menu-action-btn').first().click();
    await page.waitForTimeout(100);
    report('left re-opened by user (stays open)', (await panelDisplayed('left')) === true);

    // Drag right narrower -> trigger resets, left stays visible (user override)
    await dragPanel('right', -80);
    report('left still visible after shrinking (user override)', (await panelDisplayed('left')) === true);

    // Drag right wider -> left auto-hides again
    await dragPanel('right', 160);
    report('left auto-hidden after new expansion', (await panelDisplayed('left')) === false);

    // ── Phase 4: Don't expand user-collapsed panel on revert ──────────────

    // Collapse the group (auto-hidden), re-open it (clears auto-hide), then
    // collapse again (user intent)
    await page.locator('.sf-menu-action-btn').first().click();
    await page.waitForTimeout(100);
    await page.locator('.sf-menu-action-btn').first().click();
    await page.waitForTimeout(100);
    await page.locator('.sf-menu-action-btn').first().click();
    await page.waitForTimeout(100);
    report('left user-collapsed', (await panelDisplayed('left')) === false);

    // Drag right narrower -> revert fires but left stays hidden (user intent)
    await dragPanel('right', -240);
    report('left still hidden after revert (user-collapsed)', (await panelDisplayed('left')) === false);
    report('right still visible', (await panelDisplayed('right')) === true);

    // ── Phase 5: One panel collapsed -> no auto-hide if workspace ok ───────

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(300);

    await resizeTo(1300);
    // The reload restores the persisted panel state (phase 4 ended with the
    // left group user-collapsed) — reopen the left group first.
    await page.locator('.sf-menu-action-btn').first().click();
    await page.waitForTimeout(100);
    report('left group reopened after reload', (await panelDisplayed('left')) === true);
    await page.locator('.sf-tab-panel-toggle').click();
    await page.waitForTimeout(100);
    report('right collapsed by user', (await panelDisplayed('right')) === false);

    // 1000px: would-be ws = 1000-48-260-0 = 692 >= 640 -> no auto-hide
    await resizeTo(1000);
    report('left still visible (workspace ok with 1 panel)', (await panelDisplayed('left')) === true);

    // 900px: would-be ws = 900-48-260-0 = 592 < 640 -> left auto-hides
    await resizeTo(900);
    report(
      'left auto-hidden at 900px (too narrow even with 1 panel)',
      (await panelDisplayed('left')) === false,
    );

    // ── Phase 6: User override survives height-only resizes ───────────────
    // Narrow window auto-hides the panel; a docker click re-opens it (user
    // override). A HEIGHT-only resize (width unchanged) must not re-enforce
    // the width guard and collapse the panel again.

    await resizeTo(700);
    report('both auto-hidden at 700px', (await panelDisplayed('left')) === false);
    await page.locator('.sf-docker-app[title="Explorer"]').click();
    await page.waitForTimeout(100);
    report('docker click re-opens left (override)', (await panelDisplayed('left')) === true);
    await page.setViewportSize({ width: 700, height: 1100 });
    await page.waitForTimeout(100);
    report('override survives height-only resize', (await panelDisplayed('left')) === true);
    await page.setViewportSize({ width: 760, height: 1100 });
    await page.waitForTimeout(100);
    report('override survives widening while still narrow', (await panelDisplayed('left')) === true);
    await resizeTo(590);
    report('genuine shrink re-enforces the guard', (await panelDisplayed('left')) === false);
    await resizeTo(1300);
    report('wide restores both', (await panelDisplayed('left')) === true);

    // ── No errors ──────────────────────────────────────────────────────────

    report('no console/page errors', errors.length === 0, errors.join('; '));
  } catch (e) {
    await page.screenshot({ path: 'scripts/artifacts/autohide-fail.png' });
    console.error(e);
  }

  await finish(browser, serverProc, isFailed(), 'AUTO-HIDE CHECKS');
})();
