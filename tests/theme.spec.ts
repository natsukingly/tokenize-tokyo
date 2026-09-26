import { test, expect } from "@playwright/test";

test("Cyberpunk sidebar branding and preview URLs preserve demo holdings", async ({
  page,
}) => {
  await page.goto("/?theme=original");
  await expect(page.locator(".brand-mark")).toBeVisible();
  await page.getByLabel("I have reviewed the rights and their terms.").check();
  await page
    .getByRole("button", { name: "Acquire right", exact: true })
    .click();
  await expect(page.locator(".feedback[role='status']")).toContainText(
    "simulated successfully",
  );
  const before = await page.evaluate(() =>
    localStorage.getItem("tokenize-tokyo-demo-v2"),
  );
  await page.goto("/?theme=cyberpunk");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "cyberpunk");
  await expect(page.locator(".sidebar .brand-cyberpunk")).toBeVisible();
  const cityMap = await page.locator(".map-wrap").boundingBox();
  expect(cityMap!.y).toBeLessThan(90);
  expect(cityMap!.height).toBeGreaterThan(page.viewportSize()!.height * 0.85);
  expect(cityMap!.width).toBeGreaterThan(page.viewportSize()!.width * 0.85);
  const canvas = await page.locator(".maplibregl-canvas").elementHandle();
  const sidebarToggle = page.getByRole("button", {
    name: "Toggle sidebar",
    exact: true,
  });
  await expect(sidebarToggle).toHaveAttribute("aria-expanded", "true");
  await sidebarToggle.click();
  await expect(sidebarToggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".sidebar .brand-cyberpunk")).not.toBeVisible();
  await expect(page.locator(".sidebar .brand-compact")).toBeVisible();
  await expect(page.locator(".city-brand")).not.toBeVisible();
  await expect
    .poll(async () => (await page.locator(".map-wrap").boundingBox())!.width)
    .toBeGreaterThan(cityMap!.width);
  await expect
    .poll(
      async () =>
        (await page.locator(".maplibregl-canvas").boundingBox())!.width,
    )
    .toBeGreaterThan(cityMap!.width);
  await sidebarToggle.click();
  await expect(sidebarToggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".sidebar .brand-cyberpunk")).toBeVisible();
  await expect(page.locator(".sidebar .brand-compact")).not.toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Dashboard", exact: true })
    .click();
  await expect(page.locator(".metrics")).toBeVisible();
  await expect(page.locator(".brand-cyberpunk")).toBeVisible();
  expect(await canvas!.evaluate((el) => el.isConnected)).toBe(false);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Explore", exact: true })
    .click();
  await expect(page.locator(".city-view")).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "cyberpunk");
  await page.goto("/?theme=original");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "original");
  await expect(page.locator(".brand-mark")).toBeVisible();
  await expect(page.locator(".brand-cyberpunk")).not.toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("tokenize-tokyo-demo-v2")),
  ).toBe(before);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "original");
});

test("Cyberpunk preview URL works on mobile and can return to Original", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?theme=cyberpunk");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "cyberpunk");
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
  await expect(page.locator(".city-selection")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Explore Nihonbashi Solar Roof", exact: true })
    .click();
  await expect(page.locator(".asset-detail")).toBeVisible();
  await page
    .getByRole("button", { name: "Close asset details", exact: true })
    .click();
  await expect(page.locator(".asset-detail")).not.toBeVisible();
  await page.getByLabel("Filters", { exact: true }).click();
  await page.getByRole("button", { name: "Rooftop", exact: true }).click();
  await page
    .getByRole("button", { name: "Explore Nihonbashi Solar Roof", exact: true })
    .click();
  await expect(page.locator(".asset-detail")).toBeVisible();
  await page.getByLabel("I have reviewed the rights and their terms.").check();
  await page
    .getByRole("button", { name: "Acquire right", exact: true })
    .click();
  await expect(page.locator(".feedback[role='status']")).toContainText(
    "simulated successfully",
  );
  await page.goto("/?theme=original");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "original");
});
