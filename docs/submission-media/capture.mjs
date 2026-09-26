import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const output = fileURLToPath(new URL('./', import.meta.url));
const base = 'https://tokenize-tokyo.vercel.app';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.setDefaultTimeout(30000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const nav = name => page.getByRole('navigation').getByRole('button', { name, exact: true }).click();
async function shot(name) {
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole('status', { name: 'Loading progress' }).waitFor({ state: 'hidden', timeout: 90000 });
  await page.mouse.move(1590, 890);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(output, name), animations: 'disabled' });
  console.log(`Saved ${name}`);
}
try {
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.locator('.map-stage[data-basemap-state="ready"]').waitFor({ timeout: 90000 });
  await shot('01-explore-tokyo.png');
  await nav('Dashboard');
  await expect(page.getByRole('heading', { name: 'Market activity', exact: true })).toBeVisible();
  await shot('02-dashboard-overview.png');
  await page.getByRole('heading', { name: 'Follow the deposited money', exact: true }).scrollIntoViewIfNeeded();
  await shot('03-dashboard-revenue.png');
  await nav('Markets');
  await page.getByLabel('Find a space', { exact: true }).fill('Chiyoda ENS Solar Roof');
  await page.getByRole('button', { name: /^View details for Chiyoda ENS Solar Roof/ }).click();
  const details = page.locator('dialog[aria-labelledby="directory-asset-title"]');
  await expect(details).toBeVisible();
  await page.setViewportSize({ width:1920, height:1080 });
  await expect(details.getByRole('button', { name:'Connect wallet to buy', exact:true })).toBeVisible();
  await shot('05-rooftop-rights.png');
  await page.setViewportSize({ width:1600, height:900 });
  await details.getByRole('button', { name:'View on map', exact: true }).click();
  await page.locator('.map-stage[data-basemap-state="ready"]').waitFor({ timeout:90000 });
  await page.waitForTimeout(4000);
  await shot('06-rooftop-map.png');
  await page.goto(`${base}/ens`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('status', { name: 'Loading progress' }).waitFor({ state: 'hidden', timeout: 90000 });
  await expect(page.getByRole('heading', { name: 'Owner', exact: true })).toBeVisible();
  await expect(page.getByText('Checking receipt…', { exact: true })).toHaveCount(0, { timeout: 90000 });
  await expect(page.getByText('Registered', { exact:true })).toBeVisible({ timeout:90000 });
  await shot('04-ens-permissions.png');
  await writeFile(path.join(output, 'capture.json'), JSON.stringify({ capturedAt: new Date().toISOString(), base, viewport: { width:1600, height:900 }, network:'Sepolia testnet', mode:'Public app; read-only; no wallet connected; no transactions sent', errors }, null, 2));
} catch (error) {
  await page.screenshot({ path:path.join(output, 'capture-error.png') });
  console.error((await page.locator('body').innerText()).slice(0,20000));
  throw error;
} finally {
  await browser.close();
}
