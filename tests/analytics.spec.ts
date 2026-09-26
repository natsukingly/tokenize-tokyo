import { test, expect } from "@playwright/test";
test("overview explains financial flows and activation, then filters actual map spaces", async ({
  page,
}) => {
  await page.goto("/demo?theme=cyberpunk");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Dashboard", exact: true })
    .click();
  const overview = page.getByRole("region", { name: "Market analysis" });
  await expect(page.locator(".explore-layout")).toHaveCount(0);
  await expect(page.locator(".explore-filters")).toHaveCount(0);
  await expect(
    overview.getByRole("heading", { name: "Market activity" }),
  ).toBeVisible();
  await expect(
    overview.getByRole("img", { name: "Seven-day volume in mJPY" }),
  ).toBeVisible();
  await expect(
    overview.getByRole("img", { name: "Seven-day revenue in mJPY" }),
  ).toBeVisible();
  await overview.getByRole("button", { name: "Show Parking on map" }).click();
  await expect(overview).toHaveCount(0);
  await page.getByLabel("Filters", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Parking", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".map-pin").first()).toBeVisible();
  await expect(page.locator(".explore-layout")).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Dashboard", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".explore-layout")).toHaveCount(0);
  await expect(
    overview.getByRole("heading", { name: "Follow the deposited money" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBeTruthy();
});
