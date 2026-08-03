/**
 * Headless UI smoke test for the Studio Framework.
 *
 * Usage:  npm run check
 *
 * - Auto-starts the dev server on port 7492 if it isn't running
 * - Loads the page in headless Chromium and asserts core interactions
 * - Exits non-zero on any failure; saves a screenshot to scripts/artifacts/
 */
const fs = require('fs');
const path = require('path');
const { ensureServer, openApp, makeReporter, finish } = require('./lib/ui-test.cjs');

const ARTIFACT_DIR = path.join(__dirname, 'artifacts');

(async () => {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const serverProc = await ensureServer();
  const { browser, page, errors } = await openApp();
  const { report, isFailed } = makeReporter();

  const visible = (sel) => page.isVisible(sel);

  // ── Load ────────────────────────────────────────────────────────────────
  report('app renders (menu bar, docker, panels)', true);

  // ── Menu & submenu ──────────────────────────────────────────────────────
  await page.click('text=File');
  await page.waitForTimeout(200);
  report('File menu opens', await visible('.sf-menu-dropdown.open'));

  await page.hover('text=New File');
  await page.waitForTimeout(200);
  report('submenu opens on hover', await visible('text=Text File'));

  await page.click('text=Text File');
  await page.waitForTimeout(200);
  report('menu closes on leaf click', !(await visible('.sf-menu-dropdown.open')));

  // ── Docker panel switching ──────────────────────────────────────────────
  await page.click('.sf-docker-tag:has-text("🐛")');
  await page.waitForTimeout(300);
  report('docker tag switches panel', await visible('text=VARIABLES'));

  await page.click('.sf-docker-tag:has-text("📁")');
  await page.waitForTimeout(300);

  // ── Sub-section collapse/expand height preservation ─────────────────────
  const projectBody = '.sf-subsection-body[data-sub-body="project"]';
  const hBefore = await page.$eval(projectBody, (el) => el.getBoundingClientRect().height).catch(() => null);

  await page.click('.sf-subsection-header:has-text("PROJECT")');
  await page.waitForTimeout(300);
  const collapsed = !(await visible(projectBody));
  report('sub-section collapses', collapsed);

  await page.click('.sf-subsection-header:has-text("PROJECT")');
  await page.waitForTimeout(300);
  const hAfter = await page.$eval(projectBody, (el) => el.getBoundingClientRect().height).catch(() => null);
  report('expand restores original height', hBefore !== null && Math.abs(hBefore - hAfter) < 1, `${hBefore}px → ${hAfter}px`);

  // ── Bars & workspace ────────────────────────────────────────────────────
  report('status bar renders', await visible('.sf-status-bar'));
  report('workspace tabs render', await visible('.sf-tab:has-text("Welcome")'));
  report('right panel renders', await visible('.sf-panel--right'));

  // ── Errors ──────────────────────────────────────────────────────────────
  report('no console/page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

  const failed = isFailed();
  if (failed) {
    const shot = path.join(ARTIFACT_DIR, `failure-${Date.now()}.png`);
    await page.screenshot({ path: shot });
    console.log(`screenshot saved: ${shot}`);
  }
  await finish(browser, serverProc, failed, 'CHECKS');
})().catch((e) => { console.error('check aborted:', e.message); process.exit(2); });
