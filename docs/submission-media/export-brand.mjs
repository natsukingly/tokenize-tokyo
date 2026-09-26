import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const output = fileURLToPath(new URL('./', import.meta.url));
const browser = await chromium.launch({ headless:true });
try {
  const page = await browser.newPage({ viewport:{ width:512, height:512 } });
  const mark = await readFile(new URL('../brand/mark-monow.svg', import.meta.url), 'utf8');
  await page.setContent(`<style>html,body{margin:0;width:512px;height:512px;background:#0b0c0e}svg{display:block;width:512px;height:512px}</style>${mark}`);
  await page.screenshot({ path:path.join(output,'logo-512.png') });
  await page.setViewportSize({width:1920,height:1080});
  await page.goto(pathToFileURL(path.join(output,'cover.html')).href);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path:path.join(output,'cover-1920x1080.png') });
  console.log('Exported 512×512 logo and 1920×1080 cover.');
} finally { await browser.close(); }
