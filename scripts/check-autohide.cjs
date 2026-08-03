/**
 * Workspace-width-based progressive auto-hide:
 * - Triggered by workspace width < MIN_WORKSPACE_WIDTH, not window width
 * - Progressive collapse: wider panel first (right if tied), then narrower
 * - Progressive restore: narrower first (left if tied)
 * - One panel already collapsed -> no auto-hide if workspace still wide enough
 * - Per-panel override: clicking one toggle shows only that side
 */
const { ensureServer, openApp, makeReporter, finish } = require('./lib/ui-test.cjs');

(async () => {
  const serverProc = await ensureServer();
  const { browser, page, errors } = await openApp();
  const { report, isFailed } = makeReporter();

  try {
    // ── Helpers ────────────────────────────────────────────────────────────
    // Default panel widths: 260px each. Docker: 48px. MIN_WORKSPACE_WIDTH: 200px.
    // At 1440px: ws = 1440-48-260-260 = 872px (both visible)
    // At 600px:  ws = 600-48-260-260 = 32px  -> collapse right -> ws=292 (ok for 1)
    // At 400px:  ws = 400-48-260-0 = 92px    -> collapse left  -> ws=352 (ok for 0)

    async function panelDisplayed(side) {
      return page.evaluate((s) => {
        const el = document.querySelector('.sf-panel--' + s);
        if (!el) return null;
        return getComputedStyle(el).display !== 'none';
      }, side);
    }

    async function resizeTo(w) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.waitForTimeout(200); // wait for ResizeObserver cascade
    }

    // ── Phase 1: Progressive collapse ──────────────────────────────────────

    // 1. Wide (1440px) -> both visible
    await resizeTo(1440);
    report('both visible at 1440px', (await panelDisplayed('left')) === true && (await panelDisplayed('right')) === true);

    // 2. Narrow (600px) -> right auto-hides first (tied width, right first)
    await resizeTo(600);
    report('right hidden at 600px (wider/tied first)', (await panelDisplayed('right')) === false);
    report('left still visible at 600px', (await panelDisplayed('left')) === true);

    // 3. Very narrow (400px) -> left also auto-hides
    await resizeTo(400);
    report('left hidden at 400px (progressive)', (await panelDisplayed('left')) === false);
    report('right still hidden at 400px', (await panelDisplayed('right')) === false);

    // ── Phase 2: Progressive restore ───────────────────────────────────────

    // 4. Back to 600px -> left restores first (narrower/tied, reverse order)
    await resizeTo(600);
    report('left restored at 600px (narrower first)', (await panelDisplayed('left')) === true);
    report('right still hidden at 600px', (await panelDisplayed('right')) === false);

    // 5. Back to 1440px -> right also restores
    await resizeTo(1440);
    report('right restored at 1440px', (await panelDisplayed('right')) === true);
    report('left still visible at 1440px', (await panelDisplayed('left')) === true);

    // ── Phase 3: One panel collapsed -> no auto-hide if workspace ok ───────

    // 6. Toggle right panel off (user intent) at 1440px
    await page.locator('.sf-menu-action-btn').last().click();
    await page.waitForTimeout(100);
    report('right hidden by user toggle', (await panelDisplayed('right')) === false);

    // 7. Narrow to 600px -> workspace = 600-48-260 = 292px >= 200 -> no auto-hide
    await resizeTo(600);
    report('left still visible (workspace ok with 1 panel)', (await panelDisplayed('left')) === true);
    report('right still hidden (user intent)', (await panelDisplayed('right')) === false);

    // 8. Very narrow (400px) -> workspace = 92px < 200 -> left auto-hides
    await resizeTo(400);
    report('left auto-hidden at 400px (workspace too narrow)', (await panelDisplayed('left')) === false);

    // 9. Back to 1440px -> left restores, right stays off (user intent)
    await resizeTo(1440);
    report('left restored at 1440px', (await panelDisplayed('left')) === true);
    report('right still off (user intent preserved)', (await panelDisplayed('right')) === false);

    // ── Phase 4: Per-panel override while auto-hidden ──────────────────────

    // 10. Toggle right back on, then narrow to trigger auto-hide on both
    await page.locator('.sf-menu-action-btn').last().click();
    await page.waitForTimeout(100);
    await resizeTo(400);
    report('both hidden at 400px', (await panelDisplayed('left')) === false && (await panelDisplayed('right')) === false);

    // 11. Click left toggle -> only left shows (not both)
    await page.locator('.sf-menu-action-btn').first().click();
    await page.waitForTimeout(150);
    report('left shows after toggle (override)', (await panelDisplayed('left')) === true);
    report('right still hidden (per-panel)', (await panelDisplayed('right')) === false);

    // 12. Resize slightly -> auto-hide re-engages
    await resizeTo(401);
    report('auto-hide re-engages on resize', (await panelDisplayed('left')) === false);

    // 13. No errors
    report('no console/page errors', errors.length === 0, errors.join('; '));

  } catch (e) {
    await page.screenshot({ path: 'scripts/artifacts/autohide-fail.png' });
    console.error(e);
  }

  await finish(browser, serverProc, isFailed(), 'AUTO-HIDE CHECKS');
})();
