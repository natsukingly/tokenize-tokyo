import { test, expect } from "@playwright/test";

test("activity pages through all indexed events in newest-first order", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "Activity", exact: true })
    .click();
  const pager = page.getByRole("navigation", { name: "Activity pages" });
  const rows = page.locator(".activity-table .table-row");
  await expect(rows).toHaveCount(20);
  await expect(pager).toContainText("1–20 of");
  await expect(
    pager.getByRole("button", { name: "Previous activity page" }),
  ).toBeDisabled();
  const firstPage = await rows.allTextContents();
  const newestBlock = Number(
    await rows.first().locator("span").nth(2).textContent(),
  );
  await pager.getByRole("button", { name: "Next activity page" }).click();
  await expect(pager).toContainText("21–40 of");
  await expect(rows).toHaveCount(20);
  const olderBlock = Number(
    await rows.first().locator("span").nth(2).textContent(),
  );
  expect(olderBlock).toBeLessThanOrEqual(newestBlock);
  expect(await rows.allTextContents()).not.toEqual(firstPage);
  await pager.getByRole("button", { name: "Latest", exact: true }).click();
  await expect(pager).toContainText("1–20 of");
  expect(await rows.allTextContents()).toEqual(firstPage);
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
});
