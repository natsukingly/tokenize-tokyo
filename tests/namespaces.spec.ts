import { expect, test } from "@playwright/test";

test("namespace dashboard shows a searchable hierarchy, honest status and the linked map space", async ({
  page,
}) => {
  await page.goto("/demo", { waitUntil: "domcontentloaded" });
  // Wait for client hydration; individual map pins may be inside a cluster.
  await expect(
    page.getByRole("region", { name: "Map", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "ENS Index", exact: true })
    .click();
  const dashboard = page.getByRole("region", {
    name: "ENS Index",
    exact: true,
  });
  await expect(dashboard).toContainText(
    "This simulated market shows example names.",
  );
  await expect(page.locator(".metrics")).toHaveCount(0);
  await expect(
    page.getByRole("dialog", { name: "ENS name details" }),
  ).toHaveCount(0);
  await expect(
    page
      .getByRole("navigation")
      .getByRole("group", { name: "Platform" })
      .getByRole("button", { name: "ENS Index", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation")
      .getByRole("group", { name: "My workspace" })
      .getByRole("button", { name: "My assets", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Search ENS names").fill("Nihonbashi Solar Roof");
  await page
    .getByRole("button", {
      name: "Inspect right-1.rooftop.building-1.chuo.tokenizetokyo.eth",
      exact: true,
    })
    .click();
  const details = page.getByRole("region", {
    name: "ENS details",
    exact: true,
  });
  await expect(details).toContainText("Unregistered preview");
  await expect(details).toContainText("ENS controller");
  await expect(details).toContainText("Not connected");
  await expect(
    page.getByRole("dialog", { name: "ENS name details" }),
  ).toBeVisible();
  await expect(details).toContainText("None · no ENS record registered");
  await expect(details).toContainText("Revenue Share #1");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const opener = page.getByRole("button", {
    name: "Inspect right-1.rooftop.building-1.chuo.tokenizetokyo.eth",
    exact: true,
  });
  await expect(opener).toBeFocused();
  await opener.click();
  await details
    .getByText("What does ENS control allow?", { exact: true })
    .click();
  await expect(details).toContainText(
    "The connected Sepolia rooftop supports delegated issuance and report-only access.",
  );
  await expect(
    details.getByRole("link", { name: "Open connected rooftop permissions" }),
  ).toHaveAttribute("href", "/ens");
  await details.getByRole("button", { name: "View this space on map" }).click();
  await expect(page.locator(".asset-detail h2")).toHaveText(
    "Nihonbashi Solar Roof",
  );
});

test("namespace page has a shareable entry and a usable mobile hierarchy", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo?view=namespaces", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("region", { name: "ENS Index", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Search ENS names").fill("Kuramae Makers House");
  await page
    .getByRole("button", {
      name: "Inspect right-3.interior.building-3.taito.tokenizetokyo.eth",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("region", { name: "ENS details", exact: true }),
  ).toContainText("Usage Right #3");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Close ENS details" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("Search ENS names").fill("no-such-space");
  await expect(page.getByText("No ENS names match this search.")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "ENS details", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await expect(page.getByLabel("Search ENS names")).toHaveValue("");
});
