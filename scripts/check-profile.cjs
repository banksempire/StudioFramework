const { chromium } = require('playwright');
const fs = require('node:fs');
const { ensureServer, makeReporter, finish } = require('./lib/ui-test.cjs');

const WS = '.sf-workspace';
const PANEL = '[data-sub-body="ws-list"]';
const SAVE_BTN = '.sf-subsection-util[title="Save the current layout as a workspace"]';
const IMPORT_BTN = '.sf-subsection-util[title="Import a workspace profile from a file"]';

(async () => {
  const serverProc = await ensureServer();
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    downloadsPath: '/tmp/profile-downloads',
  });
  await context.addInitScript(() => {
    if (!sessionStorage.getItem('profile-check-cleared')) {
      sessionStorage.setItem('profile-check-cleared', '1');
      localStorage.clear();
    }
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(`http://localhost:${process.env.SF_TEST_PORT || '7493'}/`, {
    waitUntil: 'networkidle',
    timeout: 15000,
  });
  await page.waitForFunction(() => (document.getElementById('framework')?.innerHTML.length ?? 0) > 1000, {
    timeout: 10000,
  });
  const { report, isFailed } = makeReporter();

  const tileCount = () => page.locator('.sf-tile').count();
  const tileTabs = (i) => page.locator('.sf-tile').nth(i).locator('.sf-tab-label').allTextContents();
  const wsItem = (name) => page.locator(`${PANEL} .sf-pl-item`, { hasText: name });
  const menuRow = (label) => page.locator('.sf-sm-menu-row', { hasText: label }).first();
  const openWsPanel = async () => {
    for (let i = 0; i < 2; i++) {
      if (
        await page
          .locator(PANEL)
          .isVisible()
          .catch(() => false)
      )
        return;
      await page.locator('.sf-docker-app[title="Workspace"]').click();
      await page.waitForTimeout(300);
    }
  };
  const itemMenu = async (name, option) => {
    await wsItem(name).click({ button: 'right' });
    await page.waitForSelector('.sf-sm-menu', { timeout: 3000 });
    await menuRow(option).click();
    await page.waitForTimeout(300);
  };

  report('initial layout: single tile', (await tileCount()) === 1);
  const wb = await page.locator(WS).boundingBox();
  await tab_drag(page, WS, wb);

  await page.waitForTimeout(400);
  report('split right → 2 tiles', (await tileCount()) === 2);
  await openWsPanel();
  await page.click(SAVE_BTN);
  await page.waitForTimeout(400);
  await itemMenu('Workspace 1', 'Rename');
  await page.fill('#sf-ws-rename-input', 'Export Me');
  await page.locator('.sf-dialog-foot button', { hasText: 'Save' }).click();
  await page.waitForTimeout(300);
  report('workspace saved for export', (await wsItem('Export Me').count()) === 1);

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 5000 }),
    itemMenu('Export Me', 'Export to file'),
  ]);
  const exportPath = '/tmp/profile-export.json';
  await download.saveAs(exportPath);
  const envelope = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
  report(
    'exported file is a workspace profile envelope',
    envelope.format === 'sf.workspace-profile' &&
      envelope.profileVersion === 1 &&
      typeof envelope.app === 'string' &&
      envelope.app.length > 0 &&
      typeof envelope.capturedAt === 'number' &&
      envelope.name === 'Export Me',
    JSON.stringify({ format: envelope.format, app: envelope.app }),
  );
  report(
    'exported snapshot carries location + per-tab config',
    envelope.snapshot?.version === 1 &&
      Array.isArray(envelope.snapshot?.roots) &&
      envelope.snapshot?.roots?.length === 2 &&
      typeof envelope.snapshot?.focusedTileId === 'string' &&
      'layout-json' in (envelope.snapshot?.defs ?? {}) &&
      'table-demo' in (envelope.snapshot?.defs ?? {}),
    `defs=${Object.keys(envelope.snapshot?.defs ?? {}).join(',')}`,
  );
  report(
    'exported snapshot carries global config (ui block)',
    typeof envelope.snapshot?.ui === 'object' && envelope.snapshot?.ui !== null,
  );

  await page.waitForTimeout(600);
  report(
    'export banner confirms the file name',
    (
      (await page
        .locator(`${PANEL} .sf-banner`)
        .textContent()
        .catch(() => '')) ?? ''
    ).includes('workspace-export-me.json'),
  );

  await itemMenu('Export Me', 'Delete');
  await page.waitForTimeout(300);
  report('workspace deleted before import', (await page.locator(`${PANEL} .sf-pl-item`).count()) === 0);

  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 5000 }),
    page.click(IMPORT_BTN),
  ]);
  await chooser.setFiles(exportPath);
  await page.waitForTimeout(900);
  report(
    'import restores the saved workspace and loads it',
    (await wsItem('Export Me').count()) === 1 && (await tileCount()) === 2 && (await tileTabs(1)).length >= 1,
    `tiles=${await tileCount()}`,
  );

  await itemMenu('Export Me', 'Delete');
  await page.waitForTimeout(300);

  const foreign = {
    format: 'sf.workspace-profile',
    profileVersion: 1,
    app: 'quant-studio on another machine',
    capturedAt: Date.now(),
    name: 'Foreign Profile',
    snapshot: {
      version: 1,
      rootDir: null,
      roots: [
        {
          ratio: 1,
          node: {
            kind: 'tile',
            tabs: ['remote-tab'],
            activeId: 'remote-tab',
          },
        },
      ],
      focusedTileId: 'restored-anyway',
      defs: {
        'remote-tab': {
          id: 'remote-tab',
          label: 'Remote Tab',
          icon: '📄',
          content: 'welcome',
          props: { seed: 7 },
        },
      },
    },
  };
  const foreignPath = '/tmp/profile-foreign.json';
  fs.writeFileSync(foreignPath, JSON.stringify(foreign, null, 2));
  const [chooser2] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 5000 }),
    page.click(IMPORT_BTN),
  ]);
  await chooser2.setFiles(foreignPath);
  await page.waitForTimeout(900);
  report(
    'profile from another app imports and loads',
    (await wsItem('Foreign Profile').count()) === 1 &&
      (await tileCount()) === 1 &&
      (await tileTabs(0)).includes('Remote Tab'),
  );
  report(
    'import banner names the producing app',
    (
      (await page
        .locator(`${PANEL} .sf-banner`)
        .textContent()
        .catch(() => '')) ?? ''
    ).includes('quant-studio on another machine'),
  );

  const badPath = '/tmp/profile-corrupt.json';
  fs.writeFileSync(badPath, JSON.stringify({ format: 'nope', hello: 1 }));
  const itemsBefore = await page.locator(`${PANEL} .sf-pl-item`).count();
  const [chooser3] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 5000 }),
    page.click(IMPORT_BTN),
  ]);
  await chooser3.setFiles(badPath);
  await page.waitForTimeout(600);
  report(
    'corrupt profile is rejected with an error banner',
    (
      (await page
        .locator(`${PANEL} .sf-banner--error`)
        .textContent()
        .catch(() => '')) ?? ''
    ).includes('Could not import workspace') &&
      (await page.locator(`${PANEL} .sf-pl-item`).count()) === itemsBefore,
  );

  const junkPath = '/tmp/profile-junk.json';
  fs.writeFileSync(junkPath, 'not json at all {{{');
  const [chooser4] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 5000 }),
    page.click(IMPORT_BTN),
  ]);
  await chooser4.setFiles(junkPath);
  await page.waitForTimeout(600);
  report(
    'non-JSON file is rejected without breaking the panel',
    (await page.locator(`${PANEL} .sf-pl-item`).count()) === itemsBefore,
  );

  report('no page errors during the whole check', errors.length === 0, errors.join('; ').slice(0, 300));

  await finish(browser, serverProc, isFailed(), 'WORKSPACE PROFILE CHECKS');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

async function tab_drag(page, WS, wb) {
  await page.locator('.sf-tab').first().hover();
  await page
    .locator('.sf-tab')
    .first()
    .dragTo(page.locator(WS), { targetPosition: { x: wb.width - 10, y: wb.height / 2 } });
}
