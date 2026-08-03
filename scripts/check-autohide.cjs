/**
 * Workspace-width-based auto-hide with two triggers:
 *
 * 1. Window resize: hide BOTH panels when workspace < 640px, restore both when >= 640px.
 * 2. Panel expansion (drag wider): hide the OTHER panel (one-time). User can
 *    re-open it without re-triggering. Reset when panel dragged narrower.
 *
 * Also: if one panel is already user-collapsed, the would-be workspace width
 * is calculated without it, so auto-hide only triggers if still too narrow.
 */
const { ensureServer, openApp, makeReporter, finish } = require('./lib/ui-test.cjs');

// Default panel widths: 260px each. Docker: 48px. MIN_WORKSPACE_WIDTH: 640px.
// At 1300px: ws = 1300-48-260-260 = 732px (both visible)
// At 900px:  ws = 900-48-260-260 = 332px  (both hide)

(async () => {
  const serverProc = await ensureServer();
  const { browser, page, errors } = await openApp({ viewport: { width: 1300, height: 900 } });
  const { report, isFailed } = makeReporter();

  try {
    // ── Helpers ────────────────────────────────────────────────────────────

    async function panelDisplayed(side) {
      return page.evaluate((s) => {
        const el = document.querySelector('.sf-panel--' + s);
        if (!el) return null;
        return getComputedStyle(el).display !== 'none';
      }, side);
    }

    async function resizeTo(w) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.waitForTimeout(100);
    }

    /** Drag a panel's resize handle. deltaPx > 0 = make wider. */
    async function dragPanel(side, deltaPx) {
      const handleClass = side === 'left'
        ? '.sf-panel-resize-handle--right'
        : '.sf-panel-resize-handle--left';
      const handle = await page.$(handleClass);
      if (!handle) { report('handle found: ' + side, false); return; }
      const box = await handle.boundingBox();
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      const dir = side === 'left' ? 1 : -1; // left panel: drag right to widen; right: drag left
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(cx + deltaPx * dir, cy, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(100);
    }

    // ── Phase 1: Window resize trigger (hide/restore BOTH) ─────────────────

    await resizeTo(1300);
    report('both visible at 1300px', (await panelDisplayed('left')) === true && (await panelDisplayed('right')) === true);

    await resizeTo(900);
    report('both hidden at 900px (window resize)', (await panelDisplayed('left')) === false && (await panelDisplayed('right')) === false);

    await resizeTo(1300);
    report('both restored at 1300px', (await panelDisplayed('left')) === true && (await panelDisplayed('right')) === true);

    // ── Phase 2: Panel expansion trigger (one-time, hide OTHER) ────────────

    // Drag right panel wider by 160px: 260 -> 420px
    // ws = 1300-48-260-420 = 572px < 640 -> left auto-hides
    await dragPanel('right', 160);
    report('left auto-hidden after expanding right panel', (await panelDisplayed('left')) === false);
    report('right panel still visible', (await panelDisplayed('right')) === true);

    // Click left toggle to re-open: should stay open (one-time, no re-trigger)
    await page.locator('.sf-menu-action-btn').first().click();
    await page.waitForTimeout(100);
    report('left re-opened by user (stays open)', (await panelDisplayed('left')) === true);
    report('right still visible', (await panelDisplayed('right')) === true);

    // ── Phase 3: Reset by dragging narrower, then re-trigger ───────────────

    // Drag right panel narrower by 80px: 420 -> 340px -> resets trigger
    await dragPanel('right', -80);
    report('right panel narrowed (trigger reset)', true);

    // Drag right panel wider again by 160px: 340 -> 500px (max)
    // ws = 1300-48-260-500 = 492px < 640 -> left auto-hides again
    await dragPanel('right', 160);
    report('left auto-hidden again after new expansion', (await panelDisplayed('left')) === false);

    // ── Phase 4: One panel collapsed -> no auto-hide if workspace ok ───────

    // Reset: reload page for clean state
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(300);

    // At 1000px with both panels: ws = 1000-48-260-260 = 432px < 640 -> both hide
    await resizeTo(1000);
    report('both hidden at 1000px', (await panelDisplayed('left')) === false && (await panelDisplayed('right')) === false);

    // Restore at 1300px, then collapse right panel
    await resizeTo(1300);
    await page.locator('.sf-menu-action-btn').last().click();
    await page.waitForTimeout(100);
    report('right collapsed by user', (await panelDisplayed('right')) === false);

    // Resize to 1000px: would-be ws = 1000-48-260-0 = 692px >= 640 -> no auto-hide
    await resizeTo(1000);
    report('left still visible (workspace ok with 1 panel)', (await panelDisplayed('left')) === true);
    report('right still hidden (user intent)', (await panelDisplayed('right')) === false);

    // Resize to 900px: would-be ws = 900-48-260-0 = 592px < 640 -> left auto-hides
    await resizeTo(900);
    report('left auto-hidden at 900px (too narrow even with 1 panel)', (await panelDisplayed('left')) === false);

    // ── No errors ──────────────────────────────────────────────────────────

    report('no console/page errors', errors.length === 0, errors.join('; '));

  } catch (e) {
    await page.screenshot({ path: 'scripts/artifacts/autohide-fail.png' });
    console.error(e);
  }

  await finish(browser, serverProc, isFailed(), 'AUTO-HIDE CHECKS');
})();
