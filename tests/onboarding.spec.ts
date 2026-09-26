import { test, expect } from "@playwright/test";
test("Tokenize presents one focused step and keeps technical fields folded away", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Demo role").selectOption("Owner A");
  await page
    .getByRole("button", { name: "Tokenize a space", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Where is your space?" }),
  ).toBeVisible();
  await expect(page.getByLabel("Longitude", { exact: true })).not.toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "Tokenize a space", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".breadcrumb")).toContainText("EXPLORE");
  await page.getByLabel("Asset name", { exact: true }).fill("My storage space");
  await page.getByLabel("Asset type", { exact: true }).selectOption("Storage");
  await page.getByRole("button", { name: "Continue to rights" }).click();
  await expect(
    page.getByRole("heading", { name: "What can people use?" }),
  ).toBeVisible();
  await expect(page.getByLabel("Right type", { exact: true })).toHaveValue(
    "Usage Right",
  );
  await expect(
    page.getByLabel("Right supply", { exact: true }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Review & publish" }).click();
  await page
    .getByRole("button", { name: "Register demo asset", exact: true })
    .click();
  await expect(page.locator(".workflow-card")).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "My storage space" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Submit for verification", exact: true })
    .click();
  await page.getByRole("button", { name: "Switch to Demo verifier" }).click();
  await page
    .getByRole("button", { name: "Demo verify asset", exact: true })
    .click();
  await page.getByRole("button", { name: "Switch to Owner A" }).click();
  await page.getByRole("button", { name: "Issue right", exact: true }).click();
  await page.getByRole("button", { name: "Switch to Demo verifier" }).click();
  await page
    .getByRole("button", { name: "Demo verify right", exact: true })
    .click();
  await page.getByRole("button", { name: "Switch to Owner A" }).click();
  await page
    .getByRole("button", { name: "Publish listing", exact: true })
    .click();
  await expect(
    page.getByText("Your right is on the market.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "View listing", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator(".asset-detail h2")).toHaveText("My storage space");
});
test("tutorial guides an actual usage-right purchase and can be restarted", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Quick tour", exact: true }).click();
  await page.getByRole("button", { name: "Buy a right" }).click();
  await expect(page.locator(".guide-target")).toHaveCount(1);
  await page.getByLabel("Filters", { exact: true }).click();
  await page.getByRole("button", { name: "Parking", exact: true }).click();
  await page
    .getByRole("button", { name: "Explore Akihabara Parking Bay", exact: true })
    .click();
  await expect(page.locator(".asset-detail h2")).toHaveText(
    "Akihabara Parking Bay",
  );
  await page.getByRole("button", { name: "Inspect right" }).click();
  await expect(
    page.getByRole("button", { name: "View My assets" }),
  ).toBeDisabled();
  await page.getByLabel("I have reviewed the rights and their terms.").check();
  await page
    .getByRole("button", { name: "Acquire right", exact: true })
    .click();
  await page.getByRole("button", { name: "View My assets" }).click();
  await expect(page.locator(".holding")).toContainText("Parking");
  await page.getByRole("button", { name: "Finish tour" }).click();
  await expect(page.getByRole("region", { name: "Quick tour" })).toHaveCount(0);
  await page.getByRole("button", { name: "Quick tour", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "List my space" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("region", { name: "Quick tour" })).toHaveCount(0);
});
test("mock markets support fractional resale and rental without touching protocol balances", async ({
  page,
}) => {
  await page.goto("/");
  const before = await page.evaluate(() =>
    localStorage.getItem("tokenize-tokyo-demo-v2"),
  );
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Markets", exact: true })
    .click();
  await page.getByRole("tab", { name: "Fractional", exact: true }).click();
  await expect(page.getByText("CONCEPT MARKET · MOCK ONLY")).toBeVisible();
  await page
    .getByRole("button", { name: "Preview purchase", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm mock purchase", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Mock positions" }),
  ).toContainText("10 mock shares");
  await page.getByRole("button", { name: "List 10 shares for resale" }).click();
  await page.getByRole("button", { name: "Simulate a buyer" }).click();
  await expect(page.getByText("10 shares · Resale settled")).toBeVisible();
  await page.getByRole("tab", { name: "Rental", exact: true }).click();
  await page
    .getByRole("button", { name: "Preview rental", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm mock rental", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Mock positions" }),
  ).toContainText("Owner keeps token");
  await page
    .getByRole("button", { name: "Return access", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Mock positions" }),
  ).toContainText("Returned");
  expect(
    await page.evaluate(() => localStorage.getItem("tokenize-tokyo-demo-v2")),
  ).toBe(before);
  await page.reload();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Markets", exact: true })
    .click();
  await page.getByRole("tab", { name: "Fractional", exact: true }).click();
  await expect(page.getByText("10 shares · Resale settled")).toBeVisible();
});
test("a held usage right can be referenced by a new mock fractional market", async ({
  page,
}) => {
  await page.goto("/?theme=original");
  await page.getByRole("button", { name: "Storage", exact: true }).click();
  await page
    .getByRole("button", { name: "Explore Asakusabashi Storage", exact: true })
    .click();
  await page.getByLabel("I have reviewed the rights and their terms.").check();
  await page
    .getByRole("button", { name: "Acquire right", exact: true })
    .click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "My assets", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Fractionalize / lend · mock", exact: true })
    .click();
  await page.getByLabel("Mock offer price").fill("70");
  await page
    .getByRole("button", { name: "Create fraction pool", exact: true })
    .click();
  await expect(page.locator(".mock-offers")).toContainText(
    "Asakusabashi Storage",
  );
  await expect(
    page.getByRole("status").filter({ hasText: "Mock market created" }),
  ).toBeVisible();
});
