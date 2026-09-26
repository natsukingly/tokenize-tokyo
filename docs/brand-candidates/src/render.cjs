// Usage: node render.js [filter]   (run from anywhere; resolves playwright from the tokenize-tokyo project)
const path = require('path'), fs = require('fs');
const { chromium } = require('/Users/yamaguchinatsuki/Projects/tokenize-tokyo/node_modules/playwright');
const DIR = __dirname;
const filter = process.argv[2] || '';
(async () => {
  const files = fs.readdirSync(DIR).filter(f => /^\d\d-.*\.html$/.test(f) && f.includes(filter)).sort();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 2000, height: 700 }, deviceScaleFactor: 1 });
  for (const f of files) {
    const base = f.replace(/\.html$/, '');
    for (const [suffix, q] of [['', ''], ['-dark', '?bg=dark']]) {
      await page.goto('file://' + path.join(DIR, f) + q, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(DIR, base + suffix + '.png'), omitBackground: true });
      if (!suffix) {
        const fonts = await page.evaluate(() => [...document.fonts].filter(x => x.status === 'loaded')
          .map(x => `${x.family.replace(/"/g, '')} ${x.weight}${x.style !== 'normal' ? ' ' + x.style : ''}`));
        console.log(base, '| loaded fonts:', [...new Set(fonts)].join(', ') || 'NONE');
      }
    }
    if (f.includes('small')) { // extra sidebar-size render
      await page.setViewportSize({ width: 190, height: 66 });
      for (const [suffix, q] of [['-190', ''], ['-190-dark', '?bg=dark']]) {
        await page.goto('file://' + path.join(DIR, f) + q, { waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(600);
        await page.screenshot({ path: path.join(DIR, base + suffix + '.png'), omitBackground: true });
      }
      await page.setViewportSize({ width: 2000, height: 700 });
    }
  }
  await browser.close();
})();
