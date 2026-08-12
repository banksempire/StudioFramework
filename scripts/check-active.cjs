/**
 * Active sub-section + hover interaction tests:
 *
 * - Header click (collapse/expand) does NOT activate.
 * - Body click activates; only one active at a time.
 * - Hover any part of a sub-section -> show its buttons.
 * - While hovering, the active sub-section's buttons hide (if different).
 * - When mouse leaves all sub-sections -> active's buttons re-show.
 */
const { ensureServer, openApp, makeReporter, finish } = require('./lib/ui-test.cjs');

(async () => {
  const serverProc = await ensureServer();
  const { browser, page, errors } = await openApp();
  const { report, isFailed } = makeReporter();

  try {
    // ── Helpers ────────────────────────────────────────────────────────────

    const findSub = async (labelText) => {
      const subs = await page.$$('.sf-subsection');
      for (const sub of subs) {
        const lbl = await sub.$('.sf-subsection-label');
        if (lbl) {
          const text = await lbl.textContent();
          if (text?.includes(labelText)) return sub;
        }
      }
      return null;
    };

    const getUtilsDisplay = async (sub) => {
      if (!sub) return 'N/A';
      return page.evaluate((el) => {
        const u = el.querySelector('.sf-subsection-utils');
        if (!u) return 'N/A';
        return u.offsetWidth > 0 ? 'shown' : 'hidden';
      }, sub);
    };

    const isActiveEl = async (sub) => {
      if (!sub) return false;
      return page.evaluate((el) => el.classList.contains('sf-subsection--active'), sub);
    };

    /** Move mouse to the center of a sub-section. */
    const hoverSub = async (sub) => {
      const box = await sub.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(50);
    };

    /** Move mouse to the panel header (outside all sub-sections). */
    const moveMouseAway = async () => {
      const header = await page.$('.sf-panel-header');
      if (header) {
        const box = await header.boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      } else {
        await page.mouse.move(0, 0);
      }
      await page.waitForTimeout(50);
    };

    // ── Setup ──────────────────────────────────────────────────────────────

    await moveMouseAway();

    const projectSub = await findSub('Project');
    const outlineSub = await findSub('Outline');
    report('found "Project" sub-section', !!projectSub);
    report('found "Outline" sub-section', !!outlineSub);

    // ── Phase 1: Header click does not activate ────────────────────────────

    report('no sub-section active initially', !(await page.$('.sf-subsection--active')));

    const projectHeader = await projectSub.$('.sf-subsection-header');
    await projectHeader.click();
    await page.waitForTimeout(50);
    report('header click (collapse) does NOT activate', !(await isActiveEl(projectSub)));

    await projectHeader.click();
    await page.waitForTimeout(50);
    report('header click (expand) does NOT activate', !(await isActiveEl(projectSub)));

    // ── Phase 2: Hover shows buttons, move away hides (non-active) ─────────

    await moveMouseAway();
    report('utils hidden when no hover and no active', (await getUtilsDisplay(projectSub)) === 'hidden');

    await hoverSub(projectSub);
    report('utils shown on hover (any part of sub-section)', (await getUtilsDisplay(projectSub)) === 'shown');

    await moveMouseAway();
    report('utils hidden after moving away (not active)', (await getUtilsDisplay(projectSub)) === 'hidden');

    // ── Phase 3: Active + hover interaction ────────────────────────────────

    // Click project body -> activates (mouse at click pos = hovering)
    const projectBody = await projectSub.$('.sf-subsection-body');
    report('project body exists after expand', !!projectBody);
    if (projectBody) {
      await projectBody.click();
      await page.waitForTimeout(50);
    }
    report('body click activates project', await isActiveEl(projectSub));

    // Move away -> buttons still show (active)
    await moveMouseAway();
    report('utils shown when active (no hover)', (await getUtilsDisplay(projectSub)) === 'shown');

    // Hover outline -> project buttons STILL show (active is not hidden by hover)
    await hoverSub(outlineSub);
    report(
      'active utils still shown when hovering another sub-section',
      (await getUtilsDisplay(projectSub)) === 'shown',
    );

    // Move away -> project buttons still show (active)
    await moveMouseAway();
    report('active utils still shown after moving away', (await getUtilsDisplay(projectSub)) === 'shown');

    // ── Phase 3b: Collapsed sub-section never shows buttons ────────────────

    // Collapse project (header click) -> still active but collapsed
    await projectHeader.click();
    await page.waitForTimeout(50);
    report('project still active after collapse', await isActiveEl(projectSub));
    report('utils hidden when active but collapsed', (await getUtilsDisplay(projectSub)) === 'hidden');

    // Hover collapsed project -> still hidden
    await hoverSub(projectSub);
    report(
      'utils hidden when hovering collapsed sub-section',
      (await getUtilsDisplay(projectSub)) === 'hidden',
    );

    // Expand project -> active + expanded -> buttons back
    await projectHeader.click();
    await page.waitForTimeout(50);
    await moveMouseAway();
    report('utils shown again after expanding (active)', (await getUtilsDisplay(projectSub)) === 'shown');

    // ── Phase 4: Deactivation ──────────────────────────────────────────────

    const outlineBody = await outlineSub.$('.sf-subsection-body');
    report('outline body exists', !!outlineBody);
    if (outlineBody) {
      await outlineBody.click();
      await page.waitForTimeout(50);
    }
    await moveMouseAway();
    report('project deactivated after clicking outline body', !(await isActiveEl(projectSub)));
    report('outline active after body click', await isActiveEl(outlineSub));

    const activeCount = await page.$$eval('.sf-subsection--active', (els) => els.length);
    report('exactly one sub-section active', activeCount === 1, `count=${activeCount}`);

    report('no console/page errors', errors.length === 0, errors.join('; '));
  } catch (e) {
    await page.screenshot({ path: 'scripts/artifacts/active-subsection-fail.png' });
    console.error(e);
  }

  await finish(browser, serverProc, isFailed(), 'ACTIVE SUB-SECTION CHECKS');
})();
