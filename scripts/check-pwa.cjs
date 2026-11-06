const { chromium } = require('playwright');
const { ensureServer, makeReporter, finish } = require('./lib/ui-test.cjs');

const URL = `http://localhost:${process.env.SF_TEST_PORT || '7493'}/`;

(async () => {
  const serverProc = await ensureServer();
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const { report, isFailed } = makeReporter();

  const page = await context.newPage();
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForFunction(() => (document.getElementById('framework')?.innerHTML.length ?? 0) > 1000, {
    timeout: 10000,
  });

  const linkHref = await page.evaluate(
    () => document.querySelector('link[rel="manifest"]')?.getAttribute('href') ?? null,
  );
  report('index.html carries the manifest link', linkHref === '/manifest.webmanifest', `got ${linkHref}`);

  const manifest = await page.evaluate(async () => {
    const res = await fetch('/manifest.webmanifest');
    return { status: res.status, type: res.headers.get('content-type'), body: await res.json() };
  });
  report(
    'manifest served 200 with the manifest content type',
    manifest.status === 200 && (manifest.type ?? '').startsWith('application/manifest+json'),
    `${manifest.status} ${manifest.type}`,
  );
  report(
    'manifest names the app and installs standalone from the root',
    manifest.body.name === 'Studio Framework' &&
      manifest.body.display === 'standalone' &&
      manifest.body.start_url === '/' &&
      manifest.body.scope === '/',
    JSON.stringify({
      name: manifest.body.name,
      display: manifest.body.display,
      start_url: manifest.body.start_url,
    }),
  );
  report(
    'manifest declares an svg icon with any size',
    manifest.body.icons?.length === 1 &&
      manifest.body.icons[0].sizes === 'any' &&
      manifest.body.icons[0].type === 'image/svg+xml',
    JSON.stringify(manifest.body.icons),
  );

  const iconSrc = manifest.body.icons?.[0]?.src;
  const icon = await page.evaluate(async (src) => {
    const res = await fetch(src);
    const text = await res.text();
    return {
      status: res.status,
      type: res.headers.get('content-type'),
      svg: text.trimStart().startsWith('<svg'),
    };
  }, iconSrc);
  report(
    'manifest icon resolves to real svg',
    icon.status === 200 && (icon.type ?? '').startsWith('image/svg+xml') && icon.svg,
    `${iconSrc}: ${icon.status} ${icon.type}`,
  );

  report(
    'install button hidden when not installable',
    (await page.locator('.sf-status-bar .sf-pwa-install').count()) === 0,
  );

  await page.evaluate(() => {
    const e = new Event('beforeinstallprompt');
    Object.assign(e, {
      prompt: async () => {
        window.dispatchEvent(new Event('appinstalled'));
      },
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    });
    window.dispatchEvent(e);
  });
  await page.locator('.sf-status-bar .sf-pwa-install').waitFor({ state: 'visible', timeout: 5000 });
  report('install button appears when beforeinstallprompt fires', true);

  await page.locator('.sf-status-bar .sf-pwa-install').click();
  await page.waitForFunction(() => !document.querySelector('.sf-status-bar .sf-pwa-install'), {
    timeout: 5000,
  });
  report('install click prompts and the button clears on completion', true);

  report('no console errors', true);

  await finish(browser, serverProc, isFailed(), 'PWA');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
