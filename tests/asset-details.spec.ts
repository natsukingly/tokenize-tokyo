import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";

test("directory rows open details without losing filters; the map action remains separate", async ({
  page,
}) => {
  await page.goto("/demo?theme=cyberpunk");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Markets", exact: true })
    .click();
  const directory = page.getByRole("region", { name: "Asset directory" });
  await directory.getByLabel("Find a space").fill("Akihabara Parking Bay");
  const row = directory.locator("tbody tr").first();
  await expect(row).toBeVisible();
  const name = await row.locator("strong").first().innerText();
  await row.locator('td[data-label="State"]').click();
  const dialog = page.getByRole("dialog", { name });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: "Rights & offers" }),
  ).toBeVisible();
  mkdirSync(".data/asset-details", { recursive: true });
  await page.screenshot({ path: ".data/asset-details/desktop.png" });
  await expect(page.locator(".map-wrap")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  const detailButton = directory.getByRole("button", {
    name: `View details for ${name}`,
  });
  await expect(detailButton).toBeFocused();
  await expect(directory.getByLabel("Find a space")).toHaveValue(
    "Akihabara Parking Bay",
  );
  await detailButton.press("Enter");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Close space details" }).click();
  await directory.getByRole("button", { name: `View ${name} on map` }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".asset-detail h2")).toHaveText(name);
});

test("space details stay within the mobile screen and can open the map", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo?theme=cyberpunk");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Markets", exact: true })
    .click();
  const directory = page.getByRole("region", { name: "Asset directory" });
  await directory
    .getByRole("button", { name: /^View details for/ })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth + 1,
    ),
  ).toBe(true);
  mkdirSync(".data/asset-details", { recursive: true });
  await page.screenshot({ path: ".data/asset-details/mobile.png" });
  await dialog
    .getByRole("button", { name: "View on map", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".asset-detail")).toBeVisible();
});
