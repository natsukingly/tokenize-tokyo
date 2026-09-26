import { test, expect } from "@playwright/test";
import { dormantCount } from "../src/lib/dormant";
test("Opportunity Lens lights up dormant rooftops with a matching count", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Explore", exact: true })
    .click();
  await page.getByRole("button", { name: "Opportunity Lens" }).click();
  await expect(page.getByText("DORMANT CITY / LENS")).toBeVisible();
  await page.getByRole("button", { name: "Rooftop", exact: true }).click();
  const overlay = page.locator(".lens-count strong");
  await expect(overlay).toHaveText(/\d+ dormant opportunities/);
  const n = Number((await overlay.textContent())?.match(/\d+/)?.[0]);
  expect(n).toBe(dormantCount("Rooftop"));
  await expect(page.locator(".lens-count")).toContainText(
    "Demo dataset · not real listings",
  );
});
