import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";

test("map groups nearby spaces and expands a few funding projects without hovering", async ({
  page,
}) => {
  await page.goto("/demo?theme=cyberpunk");
  await expect(
    page.locator('.map-stage[data-basemap-state="ready"]'),
  ).toBeVisible({ timeout: 45000 });
  const clusters = page.locator(".map-cluster:visible");
  await expect(clusters.first()).toBeVisible();
  const picks = page.locator(".map-pin.featured:visible");
  await expect.poll(() => picks.count()).toBeGreaterThan(0);
  expect(await picks.count()).toBeLessThanOrEqual(3);
  await expect(picks.first().locator("b")).toBeVisible();
  await expect(picks.first().getByRole("progressbar")).toBeVisible();
  expect(await page.locator(".map-pin:visible").count()).toBeLessThan(100);
  // Aggregate counts and individual markers account for every visible location once.
  const ids = await page
    .locator(".map-pin:visible, .map-cluster:visible")
    .evaluateAll((elements) =>
      elements.flatMap((el) => {
        const node = el as HTMLElement;
        return node.dataset.assetIds?.split(",") ?? [node.dataset.assetId!];
      }),
    );
  expect(new Set(ids).size).toBe(ids.length);
  mkdirSync(".data/map-density", { recursive: true });
  await page.screenshot({ path: ".data/map-density/desktop.png" });
  const chosenId = await picks.first().getAttribute("data-asset-id");
  await picks.first().click();
  await expect(
    page.locator(`.map-pin.selected[data-asset-id="${chosenId}"]`),
  ).toBeVisible();
  await expect(page.locator(".asset-detail")).toBeVisible();
});

test("cluster buttons zoom into their members and funding filters still apply", async ({
  page,
}) => {
  await page.goto("/demo?theme=cyberpunk");
  const clusters = page.locator(".map-cluster:visible");
  await expect(clusters.first()).toBeVisible();
  const index = await clusters.evaluateAll((elements) =>
    elements.findIndex((element) => {
      const box = element.getBoundingClientRect();
      return (
        box.y > 230 &&
        box.bottom < innerHeight - 100 &&
        element.contains(
          document.elementFromPoint(
            box.x + box.width / 2,
            box.y + box.height / 2,
          ),
        )
      );
    }),
  );
  expect(index).toBeGreaterThanOrEqual(0);
  const members = (await clusters
    .nth(index)
    .getAttribute("data-asset-ids"))!.split(",");
  await clusters.nth(index).click();
  await expect
    .poll(() =>
      page
        .locator(".map-cluster:visible")
        .evaluateAll((elements) =>
          elements.map((el) => (el as HTMLElement).dataset.assetIds),
        ),
    )
    .not.toContain(members.join(","));
  await expect(page.locator(".map-pin.selected")).toHaveCount(0);
  await page.getByRole("button", { name: /Funding open/ }).click();
  await expect(page.locator(".map-pin:not(.funding)")).toHaveCount(0);
  await expect(page.locator(".map-cluster:not(.funding)")).toHaveCount(0);
});

test("mobile map uses at most one expanded project and keeps it on screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo?theme=cyberpunk");
  const picks = page.locator(".map-pin.featured:visible");
  await expect(picks).toHaveCount(1);
  const box = (await picks.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await expect(picks.locator("b")).toBeVisible();
  mkdirSync(".data/map-density", { recursive: true });
  await page.screenshot({ path: ".data/map-density/mobile.png" });
});
