const path = require('node:path');
const { ensureServer, openApp, makeReporter, finish } = require(path.join(__dirname, 'lib', 'ui-test.cjs'));

const { report, isFailed } = makeReporter();

async function run(page) {
  const counter = () => page.evaluate(() => window.__sfTabInstances ?? 0);
  const stamps = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('[data-sf-instance]')].map((el) => el.getAttribute('data-sf-instance')),
    );
  const placedStamp = () =>
    page.evaluate(
      () =>
        document.querySelector('.sf-tile-tab-slot [data-sf-instance]')?.getAttribute('data-sf-instance') ??
        null,
    );

  report(
    'demo mounts exactly one TableDemo instance for the open tab',
    (await counter()) === 1,
    `count=${await counter()}`,
  );

  await page.locator('.sf-tab', { hasText: 'Table' }).first().click();
  await page.waitForTimeout(300);
  const stampPlaced1 = await placedStamp();
  report(
    'Table tab places its instance into the active tile slot',
    stampPlaced1 !== null,
    `stamp=${stampPlaced1}`,
  );
  report(
    'exactly one instance exists on initial placement',
    (await stamps()).length === 1 && (await stamps())[0] === stampPlaced1,
  );

  const wsBox = await page.locator('.sf-workspace').boundingBox();
  const tilesBefore = await page.locator('.sf-tile').count();
  await page
    .locator('.sf-tab', { hasText: 'Table' })
    .first()
    .dragTo(page.locator('.sf-workspace'), {
      targetPosition: { x: wsBox.width - 10, y: wsBox.height / 2 },
    });
  await page.waitForTimeout(500);
  report(
    'dragging the tab to the right edge splits a new tile',
    (await page.locator('.sf-tile').count()) === tilesBefore + 1,
  );

  report(
    'tile split did not create a new instance (rule: moves never initialize)',
    (await counter()) === 1 && (await stamps()).length === 1 && (await placedStamp()) === stampPlaced1,
    `count=${await counter()} stamps=${JSON.stringify(await stamps())}`,
  );

  const otherTile = page.locator('.sf-tile:not(:has([data-sf-instance]))').first();
  const otherBox = await otherTile.boundingBox();
  await page
    .locator('.sf-tab', { hasText: 'Table' })
    .first()
    .dragTo(otherTile, { targetPosition: { x: otherBox.width / 2, y: otherBox.height / 2 } });
  await page.waitForTimeout(500);
  report(
    'dragging the tab back merges the split tile',
    (await page.locator('.sf-tile').count()) === tilesBefore,
  );
  report(
    'tile merge did not create a new instance',
    (await counter()) === 1 && (await stamps()).length === 1 && (await placedStamp()) === stampPlaced1,
    `count=${await counter()} stamps=${JSON.stringify(await stamps())}`,
  );

  await page.locator('.sf-tab', { hasText: 'layout.json' }).first().click();
  await page.waitForTimeout(300);
  report(
    'activating another tab parks the instance without destroying it',
    (await counter()) === 1 && (await stamps()).length === 0,
    `stamps=${JSON.stringify(await stamps())}`,
  );

  await page.locator('.sf-tab', { hasText: 'Table' }).first().click();
  await page.waitForTimeout(300);
  report(
    'reactivating the tab shows the same instance again',
    (await counter()) === 1 && (await placedStamp()) === stampPlaced1,
    `stamp=${await placedStamp()}`,
  );

  await page.locator('.sf-tab', { hasText: 'Table' }).first().click({ button: 'middle' });
  await page.waitForTimeout(300);
  report(
    'closing the tab removes the instance without creating a new one',
    (await counter()) === 1 && (await stamps()).length === 0,
    `count=${await counter()} stamps=${JSON.stringify(await stamps())}`,
  );
}

async function main() {
  const serverProc = await ensureServer();
  const { browser, page, errors } = await openApp();
  await run(page);
  report('no page errors during the suite', errors.length === 0, errors.slice(0, 3).join(' | '));
  await finish(browser, serverProc, isFailed(), 'TAB-INSTANCE CHECKS');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
