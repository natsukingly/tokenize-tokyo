import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";

test("dashboard charts distinguish asset counts, income contribution and cumulative deposits", async ({
  page,
}) => {
  await page.goto("/demo?view=dashboard&sample=1&theme=cyberpunk");
  const overview = page.getByRole("region", { name: "Market analysis" });
  const composition = overview.getByRole("article", {
    name: "Asset composition",
  });
  await expect(
    composition.getByRole("img", {
      name: "Asset type distribution by registered asset count",
    }),
  ).toBeVisible();
  await composition.getByRole("button", { name: /Rooftop/ }).click();
  await expect(
    composition.getByRole("button", { name: /^Rooftop/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    composition.getByRole("button", { name: "Explore Rooftop assets" }),
  ).toBeVisible();
  await composition
    .getByRole("button", { name: "Income", exact: true })
    .click();
  await expect(
    composition.getByRole("img", {
      name: "Revenue contribution by asset type",
    }),
  ).toBeVisible();
  await expect(
    composition.getByRole("button", { name: "Explore Rooftop assets" }),
  ).toHaveCount(0);
  await expect(
    overview.getByRole("img", {
      name: "Primary, secondary and Basket share of settled trading volume",
    }),
  ).toBeVisible();
  await expect(
    overview
      .getByRole("img", { name: "Twenty-four-hour revenue in mJPY" })
      .locator("polyline"),
  ).toHaveCount(1);
  await expect(overview.getByLabel("Activity period")).toHaveValue("24h");
  await overview.getByLabel("Activity period").selectOption("12h");
  await expect(
    overview
      .getByRole("img", { name: "Twelve-hour revenue in mJPY" })
      .locator("circle"),
  ).toHaveCount(13);
  await overview.getByLabel("Activity period").selectOption("daily");
  await expect(
    overview
      .getByRole("img", { name: "Seven-day volume in mJPY" })
      .locator("rect"),
  ).toHaveCount(7);
  await overview.getByLabel("Activity period").selectOption("weekly");
  await expect(
    overview
      .getByRole("img", { name: "Four-week revenue in mJPY" })
      .locator("circle"),
  ).toHaveCount(4);
  mkdirSync(".data/dashboard-charts", { recursive: true });
  await page.screenshot({
    path: ".data/dashboard-charts/desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    composition.getByRole("button", { name: "Income", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".data/dashboard-charts/mobile.png",
    fullPage: true,
  });
  await composition.getByRole("button", { name: /^Rooftop/ }).click();
  await composition
    .getByRole("button", { name: "Explore Rooftop assets" })
    .click();
  await expect(overview).toHaveCount(0);
  await expect(page.locator(".map-pin").first()).toBeVisible();
});
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
    overview.getByRole("img", { name: "Twenty-four-hour volume in mJPY" }),
  ).toBeVisible();
  await expect(
    overview.getByRole("img", { name: "Twenty-four-hour revenue in mJPY" }),
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
