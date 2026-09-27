import { expect, test } from "@playwright/test";

test.skip(
  process.env.TOKENIZE_LIVE_E2E !== "1",
  "Run against a Sepolia-configured app with TOKENIZE_LIVE_E2E=1.",
);

test("market loading covers the viewport and clears on success and failed refresh", async ({
  page,
}) => {
  let release!: () => void;
  let gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let fail = false;
  await page.route("https://*.multibaas.com/api/v0/**", async (route) => {
    await gate;
    await route.fulfill(
      fail
        ? { status: 503, json: { message: "Unavailable" } }
        : {
            json: { status: 200, message: "success", result: { rows: [] } },
          },
    );
  });
  await page.goto("/?theme=original");
  const overlay = page.getByRole("status", { name: "Loading progress" });
  await expect(overlay).toContainText("Loading Tokyo");
  expect(await overlay.boundingBox()).toEqual({
    x: 0,
    y: 0,
    ...page.viewportSize()!,
  });
  release();
  await expect(overlay).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Refresh market", exact: true }),
  ).toBeEnabled();

  gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page
    .getByRole("button", { name: "Refresh market", exact: true })
    .click();
  await expect(overlay).toContainText("Updating market data");
  fail = true;
  release();
  await expect(overlay).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Retry update" }),
  ).toBeVisible();
});

test("background market refresh stays unobtrusive", async ({ page }) => {
  await page.clock.install();
  let hold = false;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  await page.route("https://*.multibaas.com/api/v0/**", async (route) => {
    calls++;
    if (hold) await gate;
    await route.fulfill({
      json: { status: 200, message: "success", result: { rows: [] } },
    });
  });
  await page.goto("/?view=dashboard");
  await expect(page.locator(".metrics")).toBeVisible();
  hold = true;
  const before = calls;
  await page.clock.runFor(60001);
  await expect.poll(() => calls).toBeGreaterThan(before);
  await expect(
    page.getByRole("status", { name: "Loading progress" }),
  ).toHaveCount(0);
  release();
});

test("ENS loading stays readable on mobile and releases the screen on RPC failure", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/*", async (route) => {
    if (
      route.request().method() !== "POST" ||
      !route.request().postData()?.includes('"jsonrpc"')
    )
      return route.fallback();
    await gate;
    await route.fulfill({ status: 503, body: "Unavailable" });
  });
  await page.goto("/ens");
  const overlay = page.getByRole("status", { name: "Loading progress" });
  await expect(overlay).toContainText("Verifying ENS on Sepolia");
  expect(await overlay.boundingBox()).toEqual({
    x: 0,
    y: 0,
    width: 390,
    height: 844,
  });
  await expect(overlay.locator("svg")).toHaveCSS("animation-name", "none");
  release();
  await expect(overlay).toHaveCount(0);
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Could not verify");
  await expect(
    page.getByRole("button", { name: "Refresh live data" }),
  ).toBeEnabled();
});
