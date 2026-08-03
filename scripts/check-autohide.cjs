/**
 * Auto-hide panels on narrow windows:
 * - Both panels hide when window < 700px
 * - Both panels restore when window grows back
 * - User intent is preserved through auto-hide
 * - Clicking docker/toggle while auto-hidden shows ONLY that side (not both)
 */
const { ensureServer, openApp, makeReporter, finish } = require('./lib/ui-test.cjs');

(async () => {
  const serverProc = await ensureServer();
  const { browser, page, errors } = await openApp();
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

    // ── Tests ──────────────────────────────────────────────────────────────

    // 1. Wide (1440px) -> both panels visible
    await resizeTo(1440);
    report('left panel visible at 1440px', await panelDisplayed('left') === true);
    report('right panel visible at 1440px', await panelDisplayed('right') === true);

    // 2. Narrow (600px) -> both panels auto-hidden
    await resizeTo(600);
    report('left panel hidden at 600px', await panelDisplayed('left') === false);
    report('right panel hidden at 600px', await panelDisplayed('right') === false);

    // 3. Wide again -> panels restored
    await resizeTo(1440);
    report('left panel restored at 1440px', await panelDisplayed('left') === true);
    report('right panel restored at 1440px', await panelDisplayed('right') === true);

    // 4. Toggle right panel off while wide
    await page.locator('.sf-menu-action-btn').last().click();
    await page.waitForTimeout(50);
    report('right panel hidden after toggle', await panelDisplayed('right') === false);
    report('left panel still visible', await panelDisplayed('left') === true);

    // 5. Narrow -> both hidden (right was already off)
    await resizeTo(600);
    report('left panel hidden at 600px', await panelDisplayed('left') === false);
    report('right panel hidden at 600px', await panelDisplayed('right') === false);

    // 6. Wide again -> left restored, right stays off (user intent preserved)
    await resizeTo(1440);
    report('left panel restored at 1440px', await panelDisplayed('left') === true);
    report('right panel still off (intent preserved)', await panelDisplayed('right') === false);

    // 7. Toggle right panel back on
    await page.locator('.sf-menu-action-btn').last().click();
    await page.waitForTimeout(50);
    report('right panel visible after toggle on', await panelDisplayed('right') === true);

    // 8. Narrow -> both hidden
    await resizeTo(600);
    report('both hidden at 600px', (await panelDisplayed('left')) === false && (await panelDisplayed('right')) === false);

    // 9. Click LEFT toggle while auto-hidden -> ONLY left shows (not both)
    await page.locator('.sf-menu-action-btn').first().click();
    await page.waitForTimeout(50);
    report('left panel shows after left toggle (override)', await panelDisplayed('left') === true);
    report('right panel still hidden (per-panel override)', await panelDisplayed('right') === false);

    // 10. Click RIGHT toggle -> right also shows
    await page.locator('.sf-menu-action-btn').last().click();
    await page.waitForTimeout(50);
    report('right panel shows after right toggle', await panelDisplayed('right') === true);
    report('left panel still visible', await panelDisplayed('left') === true);

    // 11. Resize slightly (still narrow) -> auto-hide re-engages for both
    await resizeTo(601);
    report('auto-hide re-engages on resize (left)', await panelDisplayed('left') === false);
    report('auto-hide re-engages on resize (right)', await panelDisplayed('right') === false);

    // 12. Click docker icon while auto-hidden -> ONLY left shows
    await page.locator('.sf-docker-tag').first().click();
    await page.waitForTimeout(50);
    report('left panel shows after docker click', await panelDisplayed('left') === true);
    report('right panel still hidden after docker click', await panelDisplayed('right') === false);

    // 13. No errors
    report('no console/page errors', errors.length === 0, errors.join('; '));

  } catch (e) {
    await page.screenshot({ path: 'scripts/artifacts/autohide-fail.png' });
    console.error(e);
  }

  await finish(browser, serverProc, isFailed(), 'AUTO-HIDE CHECKS');
})();
