import { test, expect } from "@playwright/test";

test("funding filters all matching map spaces and a project opens its exact ENS entry", async ({
  page,
}) => {
  await page.goto("/demo");
  const pins = page.locator(".map-pin");
  await expect(pins).toHaveCount(265);
  const button = page.getByRole("button", { name: /Funding open/ });
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  const count = await pins.count();
  expect(count).toBeGreaterThan(20);
  expect(count).toBeLessThan(265);
  await expect(page.locator(".map-pin.funding.matched")).toHaveCount(count);
  await expect(page.locator(".map-pin.selected")).toHaveCount(0);
  await page.getByLabel("Filters", { exact: true }).click();
  await page
    .getByRole("button", { name: "Reset filters", exact: true })
    .click();
  await expect(pins).toHaveCount(265);
  await expect(button).toHaveAttribute("aria-pressed", "false");
  await page.getByLabel("Project picks", { exact: true }).click();
  const picks = page.getByRole("region", { name: "Funding project picks" });
  await expect(picks.getByRole("button")).toHaveCount(3);
  await picks.getByRole("button").first().click();
  await expect(picks).not.toBeVisible();
  const detail = page.locator(".asset-detail");
  await expect(detail).toBeVisible();
  const ens = detail.getByRole("region", { name: "Space ENS name" });
  await expect(ens).toContainText("Unregistered preview");
  const name = await ens.locator("code").innerText();
  await ens
    .getByRole("button", { name: "View in ENS Index", exact: true })
    .click();
  await expect(
    page
      .getByRole("region", { name: "ENS details", exact: true })
      .locator("code"),
  ).toHaveText(name);
  await expect(
    page
      .locator(".sidebar nav")
      .getByRole("button", { name: "ENS Index", exact: true }),
  ).toHaveAttribute("aria-current", "page");
});

test("map funding controls and picks fit a mobile screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo");
  await page.getByLabel("Project picks", { exact: true }).click();
  const picks = page.getByRole("region", { name: "Funding project picks" });
  await expect(picks).toBeVisible();
  const box = await picks.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
