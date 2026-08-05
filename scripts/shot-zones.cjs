const { chromium } = require('playwright');
const PORT = process.env.SF_TEST_PORT || '7492';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  // split first so the zone map shows per-tile zones
  const wsBox = await page.locator('.sf-workspace').boundingBox();
  await page.locator('.sf-tab:has-text("framework.ts")').dragTo(page.locator('.sf-workspace'), { targetPosition: { x: wsBox.width - 10, y: wsBox.height / 2 } });
  await page.waitForTimeout(400);
  const tb = await page.locator('.sf-tab:has-text("utils.ts")').boundingBox();
  await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2);
  await page.mouse.down();
  await page.mouse.move(tb.x + tb.width / 2 + 30, tb.y + tb.height / 2, { steps: 3 });
  await page.waitForTimeout(300);
  // hover the bottom band of the right tile to show an active zone + preview
  const right = await page.locator('.sf-tile').nth(1).boundingBox();
  await page.mouse.move(right.x + right.width / 2, right.y + right.height - 4, { steps: 8 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/sf-zones.png' });
  console.log('screenshot: /tmp/sf-zones.png');
  await page.keyboard.press('Escape');
  await browser.close();
})();
