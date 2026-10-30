const path = require('node:path');
const { ensureServer, openApp, makeReporter, finish } = require(path.join(__dirname, 'lib', 'ui-test.cjs'));

const { report, isFailed } = makeReporter();

const TAB_ID = 'resource-demo-check';

async function openResourceTab(page) {
  await page.evaluate((tabId) => {
    const ws = window.__sfWorkspace;
    ws.ops.openTab(ws.focusedTileId, {
      id: tabId,
      label: 'Resource',
      icon: '🧩',
      content: 'resource-demo',
      props: { code: 'res-a' },
    });
  }, TAB_ID);
  await page.waitForTimeout(400);
}

async function run(page) {
  const log = () => page.evaluate(() => window.__sfTabResources ?? []);
  const eventsOf = (kind) =>
    page.evaluate((k) => (window.__sfTabResources ?? []).filter((e) => e.kind === k), kind);

  await page.waitForTimeout(300);
  report('no tab requested resources before one is opened', (await log()).length === 0);

  await openResourceTab(page);
  const initialLog = await log();
  report(
    'tab open requests resources exactly once at init',
    initialLog.length === 1 && initialLog[0].kind === 'open' && initialLog[0].detail === 'res-a',
    JSON.stringify(initialLog),
  );

  const resourceTab = page.locator('.sf-tab', { hasText: 'Resource' }).first();
  await resourceTab.click();
  await page.waitForTimeout(300);
  report(
    'activating the tab does not re-request resources',
    (await eventsOf('open')).length === 1,
    `open events=${(await eventsOf('open')).length}`,
  );

  const wsBox = await page.locator('.sf-workspace').boundingBox();
  const tilesBefore = await page.locator('.sf-tile').count();
  await resourceTab.dragTo(page.locator('.sf-workspace'), {
    targetPosition: { x: wsBox.width - 10, y: wsBox.height / 2 },
  });
  await page.waitForTimeout(500);
  report(
    'tile split does not re-request or release resources',
    (await eventsOf('open')).length === 1 && (await eventsOf('close')).length === 0,
    `open=${(await eventsOf('open')).length} close=${(await eventsOf('close')).length}`,
  );

  const otherTile = page.locator('.sf-tile:not(:has(.sf-resource-demo))').first();
  if ((await page.locator('.sf-tile').count()) > tilesBefore) {
    const otherBox = await otherTile.boundingBox();
    await resourceTab.dragTo(otherTile, {
      targetPosition: { x: otherBox.width / 2, y: otherBox.height / 2 },
    });
    await page.waitForTimeout(500);
  }
  report(
    'tile merge does not re-request or release resources',
    (await eventsOf('open')).length === 1 && (await eventsOf('close')).length === 0,
    `open=${(await eventsOf('open')).length} close=${(await eventsOf('close')).length}`,
  );

  await page.locator('[data-test="switch-code"]').click();
  await page.waitForTimeout(300);
  const states = await eventsOf('state');
  report(
    'state change notifies the tab with prev and next props',
    states.length === 1 && states[0].detail === 'res-a→res-b',
    JSON.stringify(states),
  );
  const codeNow = await page.locator('[data-test="resource-code"]').textContent();
  report('demo tab shows the switched state', codeNow === 'res-b', `code=${codeNow}`);

  const openBefore = (await log()).length;
  await resourceTab.click({ button: 'middle' });
  await page.waitForTimeout(400);
  const tail = await page.evaluate((from) => (window.__sfTabResources ?? []).slice(from), openBefore);
  const closeEvents = tail.filter((e) => e.kind === 'close');
  const unmountEvents = tail.filter((e) => e.kind === 'unmount');
  report(
    'closing the tab releases resources exactly once',
    closeEvents.length === 1 && closeEvents[0].detail === 'res-b',
    JSON.stringify(tail),
  );
  report(
    'resources are released before the tab object is torn down',
    closeEvents.length === 1 && unmountEvents.length === 1 && closeEvents[0].seq < unmountEvents[0].seq,
    JSON.stringify(tail),
  );
  report(
    'closed tab requests no further resources',
    (await eventsOf('open')).length === 1 && (await eventsOf('state')).length === 1,
    `open=${(await eventsOf('open')).length} state=${(await eventsOf('state')).length}`,
  );
}

async function main() {
  const serverProc = await ensureServer();
  const { browser, page, errors } = await openApp();
  await run(page);
  report('no page errors during the suite', errors.length === 0, errors.slice(0, 3).join(' | '));
  await finish(browser, serverProc, isFailed(), 'TAB-RESOURCE CHECKS');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
