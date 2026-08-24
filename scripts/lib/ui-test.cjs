const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');

const PORT = process.env.SF_TEST_PORT || '7493';
const URL = `http://localhost:${PORT}/`;

function serverUp() {
  return new Promise((resolve) => {
    const req = http.get(URL, (res) => {
      res.resume();
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function ensureServer() {
  if (await serverUp()) return null;
  console.log(`dev server not running on port ${PORT} — starting it…`);
  const proc = spawn('npm', ['run', 'dev', '--', '--port', PORT, '--strictPort'], {
    cwd: path.join(__dirname, '..', '..'),
    detached: true,
    stdio: 'ignore',
  });
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await serverUp()) return proc;
  }
  throw new Error(`dev server did not start on port ${PORT} within 20s`);
}

async function openApp({ viewport = { width: 1440, height: 900 } } = {}) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()}`));
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForFunction(() => (document.getElementById('framework')?.innerHTML.length ?? 0) > 1000, {
    timeout: 10000,
  });
  return { browser, page, errors };
}

function makeReporter() {
  let failed = false;
  const report = (name, ok, extra = '') => {
    console.log(`${ok ? '  ✓' : '  ✗ FAIL'} ${name}${extra ? ` — ${extra}` : ''}`);
    if (!ok) failed = true;
  };
  return { report, isFailed: () => failed };
}

async function finish(browser, serverProc, failed, label = 'CHECKS') {
  await browser.close();
  if (serverProc) process.kill(-serverProc.pid, 'SIGTERM');
  console.log(failed ? `\n${label} FAILED` : `\nALL ${label} PASSED`);
  process.exit(failed ? 1 : 0);
}

module.exports = { URL, ensureServer, openApp, makeReporter, finish };
