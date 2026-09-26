import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";

test("dashboard integrates activity with filters, pagination and mobile layout", async ({
  page,
}) => {
  await page.goto("/demo?view=dashboard&sample=1");
  const overview = page.getByRole("region", { name: "Market analysis" });
  const feed = overview.getByRole("region", { name: "Activity ledger" });
  const pager = feed.getByRole("navigation", { name: "Activity pages" });
  const rows = feed.locator("tbody tr");
  await expect(
    page
      .locator(".sidebar nav")
      .getByRole("button", { name: "Activity", exact: true }),
  ).toHaveCount(0);
  await expect(
    overview.getByRole("heading", { name: "Follow the deposited money" }),
  ).toBeVisible();
  await overview.getByRole("link", { name: "View activity" }).click();
  await expect(rows).toHaveCount(20);
  await expect(pager).toContainText("1–20 of");
  await expect(
    pager.getByRole("button", { name: "Previous activity page" }),
  ).toBeDisabled();
  const firstPage = await rows.allTextContents();
  const newestBlock = Number(
    (await rows
      .first()
      .locator("td")
      .nth(3)
      .locator("small")
      .textContent())!.replace(/\D/g, ""),
  );
  await pager.getByRole("button", { name: "Next activity page" }).click();
  await expect(pager).toContainText("21–40 of");
  await expect(rows).toHaveCount(20);
  const olderBlock = Number(
    (await rows
      .first()
      .locator("td")
      .nth(3)
      .locator("small")
      .textContent())!.replace(/\D/g, ""),
  );
  expect(olderBlock).toBeLessThanOrEqual(newestBlock);
  expect(await rows.allTextContents()).not.toEqual(firstPage);
  await pager.getByRole("button", { name: "Latest", exact: true }).click();
  await expect(pager).toContainText("1–20 of");
  expect(await rows.allTextContents()).toEqual(firstPage);
  await feed.getByRole("button", { name: "Income", exact: true }).click();
  await expect(pager).toContainText("1–20 of");
  expect(
    (await rows.locator("td:first-child small").allTextContents()).every(
      (name) => name.includes("Revenue"),
    ),
  ).toBe(true);
  await expect(rows.first().locator("td").nth(2)).toContainText("mJPY");
  await feed.getByRole("button", { name: "Trades", exact: true }).click();
  await feed
    .getByRole("searchbox", { name: "Search activity" })
    .fill("ListingPurchased");
  await expect(rows.first().locator("td").nth(0)).toContainText(
    "ListingPurchased",
  );
  await expect(rows.first().locator("td").nth(1)).not.toHaveText(/^Right \d+$/);
  await expect(rows.first().locator("td").nth(2)).toContainText("mJPY");
  await expect(feed.locator('a[href*="/tx/"]')).toHaveCount(0);
  await feed
    .getByRole("searchbox", { name: "Search activity" })
    .fill("no-matching-project-xyz");
  await expect(feed).toContainText("No activity matches these filters.");
  await feed.getByRole("button", { name: "Clear filters" }).click();
  await expect(rows).toHaveCount(20);
  await expect(
    feed.getByRole("button", { name: "All activity", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  mkdirSync(".data/dashboard-activity", { recursive: true });
  await feed.screenshot({ path: ".data/dashboard-activity/desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await pager.scrollIntoViewIfNeeded();
  await expect(
    pager.getByRole("button", { name: "Next activity page" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await feed
    .getByRole("heading", { name: "Activity", exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: ".data/dashboard-activity/mobile.png" });
});
