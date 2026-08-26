const { ensureServer, openApp, makeReporter, finish } = require('./lib/ui-test.cjs');

(async () => {
  const serverProc = await ensureServer();
  const { browser, page, errors } = await openApp();
  const { report, isFailed } = makeReporter();

  try {
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

    const utilButtonCount = async (sub) => {
      if (!sub) return -1;
      return page.evaluate((el) => el.querySelectorAll('.sf-subsection-util').length, sub);
    };

    const hoverSub = async (sub) => {
      const box = await sub.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(50);
    };

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

    await moveMouseAway();

    const projectSub = await findSub('Project');
    const outlineSub = await findSub('Outline');
    report('found "Project" sub-section', !!projectSub);
    report('found "Outline" sub-section', !!outlineSub);

    report('project has 4 utility buttons', (await utilButtonCount(projectSub)) === 4);
    report('utils visible with no hover and no interaction', (await getUtilsDisplay(projectSub)) === 'shown');

    if (outlineSub) await hoverSub(outlineSub);
    report('utils shown while hovering another sub-section', (await getUtilsDisplay(projectSub)) === 'shown');
    report('hovered sub-section utils shown', (await getUtilsDisplay(outlineSub)) === 'shown');

    await moveMouseAway();
    report('utils stay visible after moving mouse away', (await getUtilsDisplay(projectSub)) === 'shown');

    const projectHeader = await projectSub.$('.sf-subsection-header');
    await projectHeader.click();
    await page.waitForTimeout(50);
    report(
      'project collapsed by header click',
      (await getUtilsDisplay(projectSub)) === 'shown' && !(await page.isVisible('[data-sub-body="project"]')),
    );

    await moveMouseAway();
    report(
      'utils visible on collapsed sub-section (no hover)',
      (await getUtilsDisplay(projectSub)) === 'shown',
    );

    await hoverSub(projectSub);
    report('utils visible on collapsed sub-section (hover)', (await getUtilsDisplay(projectSub)) === 'shown');

    await projectHeader.click();
    await page.waitForTimeout(50);
    await moveMouseAway();
    report('utils visible again after expanding', (await getUtilsDisplay(projectSub)) === 'shown');

    const allUtils = await page.evaluate(() => {
      const utils = Array.from(document.querySelectorAll('.sf-subsection-utils'));
      return {
        count: utils.length,
        shown: utils.filter((u) => u.offsetWidth > 0).length,
      };
    });
    report(
      'every sub-section with utilities shows its buttons (left + right panels)',
      allUtils.count > 0 && allUtils.shown === allUtils.count,
      `shown=${allUtils.shown}/${allUtils.count}`,
    );

    const filterIcon = await page.evaluate(() => {
      const btn = document.querySelector('.sf-subsection-util[title="Filter (demo)"]');
      const path = btn?.querySelector('svg.sf-icon--svg path');
      if (!path) return null;
      const bb = path.getBBox();
      return { x: bb.x, y: bb.y, width: bb.width, height: bb.height };
    });
    report(
      'filter funnel icon fills the 24x24 viewBox (no surrounding padding)',
      filterIcon !== null && filterIcon.width >= 18 && filterIcon.height >= 16,
      filterIcon ? `bbox ${filterIcon.width.toFixed(1)}x${filterIcon.height.toFixed(1)}` : 'not found',
    );
    report(
      'filter funnel icon is centered in the viewBox',
      filterIcon !== null &&
        Math.abs(filterIcon.x + filterIcon.width / 2 - 12) <= 0.1 &&
        Math.abs(filterIcon.y + filterIcon.height / 2 - 12) <= 0.1,
      filterIcon
        ? `center (${(filterIcon.x + filterIcon.width / 2).toFixed(1)}, ${(filterIcon.y + filterIcon.height / 2).toFixed(1)})`
        : 'not found',
    );

    report('no console/page errors', errors.length === 0, errors.join('; '));
  } catch (e) {
    await page.screenshot({ path: 'scripts/artifacts/utils-subsection-fail.png' });
    console.error(e);
  }

  await finish(browser, serverProc, isFailed(), 'SUB-SECTION UTILITY BUTTON CHECKS');
})();
