import { test, expect } from "@playwright/test";
import { DEMO_SITES } from "../src/lib/demo-catalog";
import { dormantCount } from "../src/lib/dormant";
test("Opportunity Lens lights up dormant rooftops with a matching count", async ({
  page,
}) => {
  await page.goto("/demo");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Explore", exact: true })
    .click();
  await page.getByLabel("Map tools", { exact: true }).click();
  await page.getByRole("button", { name: "Opportunity Lens" }).click();
  await expect(
    page.getByRole("button", { name: "Opportunity Lens" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Filters", { exact: true }).click();
  await page.getByRole("button", { name: "Rooftop", exact: true }).click();
  await page.getByLabel("Map tools", { exact: true }).click();
  const overlay = page.locator(".lens-count strong");
  await expect(overlay).toHaveText(/\d+ dormant opportunities/);
  const n = Number((await overlay.textContent())?.match(/\d+/)?.[0]);
  expect(n).toBe(dormantCount("Rooftop"));
  await expect(page.locator(".lens-count")).toContainText(
    "Demo dataset · not real listings",
  );
});

test("filters highlight all matching spaces without selecting or moving the map; reset restores all", async ({
  page,
}) => {
  await page.goto("/demo");
  const land = page.getByRole("button", {
    name: "Explore Yaesu Weekend Market",
    exact: true,
  });
  await expect(land).toBeVisible();
  await expect(land).toHaveCSS("position", "absolute");
  const before = await land.evaluate((element) => {
    const { x, y, width, height } = element.getBoundingClientRect();
    return { x: x + width / 2, y: y + height };
  });
  await page.getByLabel("Filters", { exact: true }).click();
  await page.getByRole("button", { name: "Idle Land", exact: true }).click();
  await expect(page.locator(".map-pin")).toHaveCount(
    DEMO_SITES.filter((site) => site.kind === "Idle Land").length,
  );
  await expect(page.locator(".map-pin.matched")).toHaveCount(
    DEMO_SITES.filter((site) => site.kind === "Idle Land").length,
  );
  await expect(page.locator(".map-pin.selected")).toHaveCount(0);
  await expect(page.locator(".asset-detail")).not.toBeVisible();
  // Wait through the old automatic fly-to duration: the same space must stay put.
  await page.waitForTimeout(1600);
  const after = await land.evaluate((element) => {
    const { x, y, width, height } = element.getBoundingClientRect();
    return { x: x + width / 2, y: y + height };
  });
  expect(Math.abs(after.x - before.x)).toBeLessThan(2);
  expect(Math.abs(after.y - before.y)).toBeLessThan(2);
  await page.getByLabel("Lifecycle filter").selectOption("Secondary Market");
  await expect(page.locator(".map-pin")).toHaveCount(0);
  await expect(page.getByLabel("Map controls")).toContainText(
    "0 matching spaces",
  );
  await page
    .getByRole("button", { name: "Reset filters", exact: true })
    .click();
  await expect(page.locator(".map-pin")).toHaveCount(DEMO_SITES.length);
  await expect(page.locator(".map-pin.matched")).toHaveCount(0);
  await expect(page.locator(".map-pin.selected")).toHaveCount(0);
  await expect(page.getByLabel("Lifecycle filter")).toHaveValue("All stages");
  const restored = await land.evaluate((element) => {
    const { x, y, width, height } = element.getBoundingClientRect();
    return { x: x + width / 2, y: y + height };
  });
  expect(Math.abs(restored.x - before.x)).toBeLessThan(2);
  expect(Math.abs(restored.y - before.y)).toBeLessThan(2);
  await expect(
    page.getByRole("button", { name: "Reset filters", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Map tools", { exact: true }).click();
  await page.getByRole("button", { name: "My spaces", exact: true }).click();
  await expect(page.locator(".map-pin")).toHaveCount(0);
  await page.getByLabel("Filters", { exact: true }).click();
  await page
    .getByRole("button", { name: "Reset filters", exact: true })
    .click();
  await expect(page.locator(".map-pin")).toHaveCount(DEMO_SITES.length);
  await page.getByLabel("Map tools", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "My spaces", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await land.click();
  await expect(page.locator(".asset-detail h2")).toHaveText(
    "Yaesu Weekend Market",
  );
});

test("zooming out keeps compact location markers and reveals names on hover", async ({
  page,
}) => {
  await page.goto("/demo");
  const land = page.getByRole("button", {
    name: "Explore Yaesu Weekend Market",
    exact: true,
  });
  await expect(land).toBeVisible();
  await page.getByRole("button", { name: "Zoom out", exact: true }).click();
  await expect(page.locator(".map-canvas")).toHaveClass(/compact-markers/);
  await expect(land).toHaveCSS("width", "22px");
  await expect(land.locator("b")).not.toBeVisible();
  await land.hover();
  await expect(land.locator("b")).toBeVisible();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(page.locator(".map-canvas")).not.toHaveClass(/compact-markers/);
  await land.hover();
  await expect(land.locator("b")).toBeVisible();
});

test("Active filter shows operating examples while keeping unactivated fundraising projects separate", async ({
  page,
}) => {
  await page.goto("/demo", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Filters", { exact: true }).click();
  await page.getByLabel("Lifecycle filter").selectOption("Active");
  await expect(page.locator(".map-pin.matched")).toHaveCount(
    DEMO_SITES.filter((site) => site.activated).length,
  );
  await expect(
    page.getByRole("button", {
      name: "Explore Nihonbashi Solar Roof",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Rooftop", exact: true }).click();
  await expect(page.locator(".map-pin.matched")).toHaveCount(
    DEMO_SITES.filter((site) => site.activated && site.kind === "Rooftop")
      .length,
  );
  await page
    .getByRole("button", {
      name: "Explore Kodenmacho Operating Solar Roof",
      exact: true,
    })
    .click();
  await expect(page.locator(".asset-detail")).toContainText(
    "Simulated operating project",
  );
  await expect(page.locator(".asset-detail")).toContainText("Active");
});
