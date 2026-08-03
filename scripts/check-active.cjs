/**
 * Active sub-section tests:
 * - Clicking the body/content activates the sub-section (buttons visible).
 * - Clicking the header to collapse/expand does NOT activate.
 * - Clicking another sub-section's body deactivates the previous one.
 */
const { ensureServer, openApp, makeReporter, finish } = require('./lib/ui-test.cjs');

(async () => {
  const serverProc = await ensureServer();
  const { browser, page, errors } = await openApp();
  const { report, isFailed } = makeReporter();

  try {
    // ── Helpers ────────────────────────────────────────────────────────────

    async function findSub(labelText) {
      const subs = await page.$$('.sf-subsection');
      for (const sub of subs) {
        const lbl = await sub.$('.sf-subsection-label');
        if (lbl) {
          const text = await lbl.textContent();
          if (text && text.includes(labelText)) return sub;
        }
      }
      return null;
    }

    async function getUtilsDisplay(sub) {
      if (!sub) return 'N/A';
      return page.evaluate(el => {
        const u = el.querySelector('.sf-subsection-utils');
        if (!u) return 'N/A';
        return u.offsetWidth > 0 ? 'shown' : 'hidden';
      }, sub);
    }

    async function isActiveEl(sub) {
      if (!sub) return false;
      return page.evaluate(el => el.classList.contains('sf-subsection--active'), sub);
    }

    // ── Tests ──────────────────────────────────────────────────────────────

    // 1. Initially no subsection is active
    const activeInit = await page.$('.sf-subsection--active');
    report('no sub-section active initially', !activeInit);

    const projectSub = await findSub('Project');
    const outlineSub = await findSub('Outline');
    report('found "Project" sub-section', !!projectSub);
    report('found "Outline" sub-section', !!outlineSub);

    // 2. Project utils hidden initially (no space)
    const displayInit = await getUtilsDisplay(projectSub);
    report('project utils take no space initially', displayInit === 'hidden', `display=${displayInit}`);

    // 3. Click project header (collapse) -> should NOT activate
    const projectHeader = await projectSub.$('.sf-subsection-header');
    await projectHeader.click();
    await page.waitForTimeout(50);
    report('header click (collapse) does NOT activate', !await isActiveEl(projectSub));

    // 4. Click project header (expand) -> still NOT active
    await projectHeader.click();
    await page.waitForTimeout(50);
    report('header click (expand) does NOT activate', !await isActiveEl(projectSub));

    // 5. Click project body (content) -> activates
    const projectBody = await projectSub.$('.sf-subsection-body');
    report('project body exists after expand', !!projectBody);
    if (projectBody) {
      await projectBody.click();
      await page.waitForTimeout(50);
    }
    report('body click activates project', await isActiveEl(projectSub));
    const displayActive = await getUtilsDisplay(projectSub);
    report('project utils take space when active', displayActive === 'shown', `display=${displayActive}`);

    // 6. Click outline body -> activates outline, deactivates project
    const outlineBody = await outlineSub.$('.sf-subsection-body');
    report('outline body exists', !!outlineBody);
    if (outlineBody) {
      await outlineBody.click();
      await page.waitForTimeout(50);
    }
    report('project deactivated after clicking outline body', !await isActiveEl(projectSub));
    const displayDeact = await getUtilsDisplay(projectSub);
    report('project utils take no space after deactivation', displayDeact === 'hidden', `display=${displayDeact}`);
    report('outline active after body click', await isActiveEl(outlineSub));

    // 7. Only one active at a time
    const activeCount = await page.$$eval('.sf-subsection--active', els => els.length);
    report('exactly one sub-section active', activeCount === 1, `count=${activeCount}`);

    // 8. No console/page errors
    report('no console/page errors', errors.length === 0, errors.join('; '));

  } catch (e) {
    await page.screenshot({ path: 'scripts/artifacts/active-subsection-fail.png' });
    console.error(e);
  }

  await finish(browser, serverProc, isFailed(), 'ACTIVE SUB-SECTION CHECKS');
})();
