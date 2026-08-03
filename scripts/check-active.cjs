/**
 * Active sub-section: clicking a sub-section's content/body activates it
 * (utility buttons become always-visible). Clicking another sub-section
 * deactivates the previous one.
 */
const { ensureServer, openApp, makeReporter, finish } = require('./lib/ui-test.cjs');

(async () => {
  const serverProc = await ensureServer();
  const { browser, page, errors } = await openApp();
  const { report, isFailed } = makeReporter();

  try {
    // ── Helpers ────────────────────────────────────────────────────────────

    /** Find the .sf-subsection element whose header label contains the text. */
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

    async function getUtilsOpacity(sub) {
      if (!sub) return 'N/A';
      const utils = await sub.$('.sf-subsection-utils');
      if (!utils) return 'N/A';
      return page.evaluate(el => getComputedStyle(el).opacity, utils);
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

    // 2. Project utils hidden initially (opacity: 0)
    const opacityInit = await getUtilsOpacity(projectSub);
    report('project utils hidden initially', opacityInit === '0', `opacity=${opacityInit}`);

    // 3. Click project body (content area) to activate
    const projectBody = await projectSub.$('.sf-subsection-body');
    if (projectBody) {
      await projectBody.click();
    } else {
      await projectSub.click(); // collapsed - click root
    }
    await page.waitForTimeout(200);

    // 4. Project is now active + utils visible
    report('project active after body click', await isActiveEl(projectSub));
    const opacityActive = await getUtilsOpacity(projectSub);
    report('project utils visible when active', opacityActive === '1', `opacity=${opacityActive}`);

    // 5. Click outline header to deactivate project
    const outlineHeader = await outlineSub.$('.sf-subsection-header');
    await outlineHeader.click();
    await page.waitForTimeout(200);

    // 6. Project deactivated, outline activated
    report('project deactivated after clicking outline', !await isActiveEl(projectSub));
    const opacityDeact = await getUtilsOpacity(projectSub);
    report('project utils hidden after deactivation', opacityDeact === '0', `opacity=${opacityDeact}`);
    report('outline active after click', await isActiveEl(outlineSub));

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
