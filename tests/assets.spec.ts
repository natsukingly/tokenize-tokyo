import { test, expect } from "@playwright/test";

test("asset directory filters independently, opens the selected space and preserves a purchase", async ({
  page,
}) => {
  await page.goto("/?theme=cyberpunk");
  await page.getByLabel("Filters", { exact: true }).click();
  await page.getByRole("button", { name: "Rooftop", exact: true }).click();
  await page.getByLabel("Lifecycle filter").selectOption("Active");
  await expect(page.locator(".opportunity-section")).toHaveCount(0);
  const nav = (name: string) =>
    page
      .getByRole("navigation")
      .getByRole("button", { name, exact: true })
      .click();
  await nav("Markets");
  await expect(
    page
      .getByRole("navigation")
      .getByRole("button", { name: "Assets", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("tab", { name: "All assets", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  const directory = page.getByRole("region", { name: "Asset directory" });
  const table = page.getByRole("table", { name: "Registered assets" });
  await expect(directory).toContainText("53 of 53 registered spaces");
  await expect(page.locator(".map-wrap")).toHaveCount(0);
  await expect(page.locator(".metrics")).toHaveCount(0);
  await page.getByLabel("Sort by", { exact: true }).selectOption("price-asc");
  await expect(table.locator("tbody tr").first()).toContainText("Solar");
  await page.getByLabel("Sort by", { exact: true }).selectOption("price-desc");
  await expect(table.locator("tbody tr").first()).toContainText(
    "80,000",
  );
  await page.getByLabel("Find a space").fill("not-a-real-space");
  await expect(
    page.getByRole("heading", { name: "No spaces match these filters." }),
  ).toBeVisible();
  await directory
    .getByRole("button", { name: "Clear filters", exact: true })
    .first()
    .click();
  await page.getByLabel("Asset type", { exact: true }).selectOption("Parking");
  await page
    .getByLabel("Asset state", { exact: true })
    .selectOption("Available");
  await page.getByLabel("Find a space").fill("chiyoda");
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("tab", { name: "Funding", exact: true }).click();
  await expect(directory).toHaveCount(0);
  await expect(page.locator(".lab-disclaimer")).toHaveCount(0);
  await page.getByRole("tab", { name: "Fractional", exact: true }).click();
  await expect(page.locator(".lab-disclaimer")).toContainText("MOCK ONLY");
  await page.getByRole("tab", { name: "All assets", exact: true }).click();
  await expect(page.getByLabel("Find a space")).toHaveValue("chiyoda");
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await page
    .getByRole("button", { name: "View Akihabara Parking Bay on map" })
    .click();
  await expect(page.locator(".asset-detail")).toBeVisible();
  await expect(page.locator(".asset-detail h2")).toHaveText(
    "Akihabara Parking Bay",
  );
  await expect(page.getByLabel("Lifecycle filter")).toHaveValue("All stages");
  await page.getByLabel("I have reviewed the rights and their terms.").check();
  await page
    .getByRole("button", { name: "Acquire right", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "simulated successfully",
  );
  await nav("Markets");
  await expect(page.getByLabel("Find a space")).toHaveValue("chiyoda");
  await expect(page.getByLabel("Asset type", { exact: true })).toHaveValue(
    "Parking",
  );
  await expect(
    page.getByRole("heading", { name: "No spaces match these filters." }),
  ).toBeVisible();
  await page.getByLabel("Asset state", { exact: true }).selectOption("Funded");
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await expect(table.locator("tbody tr")).toContainText("Not listed");
  await nav("Portfolio");
  await expect(page.locator(".holding")).toContainText("Akihabara Parking Bay");
});

test("asset directory is usable on mobile in both themes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?theme=cyberpunk");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Markets", exact: true })
    .click();
  await page.getByLabel("Asset type", { exact: true }).selectOption("Storage");
  const view = page.getByRole("button", {
    name: "View Asakusabashi Storage on map",
  });
  await expect(view).toBeVisible();
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
  await page.goto("/?theme=original");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Markets", exact: true })
    .click();
  await page.getByLabel("Asset type", { exact: true }).selectOption("Storage");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "original");
  await expect(page.getByLabel("Asset type", { exact: true })).toHaveValue(
    "Storage",
  );
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
  await view.click();
  await expect(page.locator(".asset-detail h2")).toHaveText(
    "Asakusabashi Storage",
  );
});
