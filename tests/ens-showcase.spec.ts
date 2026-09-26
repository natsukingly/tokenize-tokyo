import { expect, test } from "@playwright/test";

test("ENS showcase explains separate permissions and keeps wallet connection explicit", async ({
  page,
}) => {
  await page.goto("/ens");
  await expect(
    page.getByRole("heading", { name: "One rooftop. Precisely delegated." }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Report energy" }).click();
  await expect(
    page.getByText("urban.energyReport", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Publish energy report" }),
  ).toBeDisabled();
  await expect(
    page.getByText("Connect a wallet to grant, report or revoke."),
  ).toBeVisible();
});

test("mobile ENS showcase has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/ens");
  await page.getByRole("tab", { name: "Report energy" }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
});
