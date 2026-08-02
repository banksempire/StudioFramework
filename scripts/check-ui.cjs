/**
 * Headless UI smoke test for the Studio Framework.
 *
 * Usage:  npm run check
 *
 * - Auto-starts the dev server on port 7492 if it isn't running
 * - Loads the page in headless Chromium and asserts core interactions
 * - Exits non-zero on any failure; saves a screenshot to scripts/artifacts/
 */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const URL = 'http://localhost:7492/';
const PORT = 7492;
const ARTIFACT_DIR = path.join(__dirname, 'artifacts');

let serverProc = null;
let failed = false;

function report(name, ok, extra = '') {
  console.log(`${ok ? '  ✓' : '  ✗ FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
  if (!ok) failed = true;
}

function serverUp() {
  return new Promise((resolve) => {
    const req = http.get(URL, (res) => { res.resume(); resolve(true); });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => { req.destroy(); resolve(false); });
  });
}

async function ensureServer() {
  if (await serverUp()) return;
  console.log('dev server not running — starting it…');
  serverProc = spawn('npm', ['run', 'dev'], { cwd: path.join(__dirname, '..'), detached: true, stdio: 'ignore' });
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 500));
    if (await serverUp()) return;
  }
  throw new Error('dev server did not start within 20s');
}

async function main() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  await ensureServer();

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url()));

  // ── Load ────────────────────────────────────────────────────────────────
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForFunction(() => (document.getElementById('app')?.innerHTML.length ?? 0) > 1000, { timeout: 10000 });
  report('app renders (menu bar, docker, panels)', true);

  const visible = (sel) => page.isVisible(sel);

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

  if (failed) {
    const shot = path.join(ARTIFACT_DIR, `failure-${Date.now()}.png`);
    await page.screenshot({ path: shot });
    console.log(`screenshot saved: ${shot}`);
  }

  await browser.close();
  if (serverProc) { process.kill(-serverProc.pid, 'SIGTERM'); } // stop server we started
  console.log(failed ? '\nCHECK FAILED' : '\nALL CHECKS PASSED');
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('check aborted:', e.message); process.exit(2); });
