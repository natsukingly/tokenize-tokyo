// Render architecture.html to ../screenshots/architecture.png (4000x2500 @2x)
const path = require('path');
const { chromium } = require('/Users/yamaguchinatsuki/Projects/tokenize-tokyo/node_modules/playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 2000, height: 1250 }, deviceScaleFactor: 2 });
  await page.goto('file://' + path.join(__dirname, 'architecture.html'));
  await page.waitForFunction(() => window.__done === true, null, { timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  const warnings = await page.evaluate(() => window.__warnings || []);
  const fontsOk = await page.evaluate(() => ['800 26px "Barlow Condensed"', '400 18px "IBM Plex Sans"', '500 14px "IBM Plex Mono"'].map(f => document.fonts.check(f)));
  console.log('fonts loaded:', fontsOk.join(','));
  console.log(warnings.length ? 'WARNINGS:\n' + warnings.join('\n') : 'no layout warnings');
  const out = path.join(__dirname, '../screenshots/architecture.png');
  await page.screenshot({ path: out, fullPage: false });
  console.log('wrote', out);
  await browser.close();
})();
