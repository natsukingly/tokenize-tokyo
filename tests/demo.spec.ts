import { test, expect } from "@playwright/test";
test("buy, activate, deposit, claim, secondary trade, custody and basket redemption", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Put the city to work." }),
  ).toBeVisible();
  await page.getByLabel("I have reviewed the rights and their terms.").check();
  await page.getByLabel("Purchase quantity").fill("10");
  await page
    .getByRole("button", { name: "Acquire right", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "simulated successfully",
  );
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Portfolio" })
    .click();
  await expect(page.locator(".holding")).toContainText("10 units held");
  await page.getByLabel("Demo actor").selectOption("Demo verifier");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Tokenize", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Activate project", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Deposit revenue", exact: true })
    .first()
    .click();
  await page.getByLabel("Demo actor").selectOption("Investor B");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Portfolio" })
    .click();
  await expect(page.locator(".holding")).toContainText("1,000 mJPY claimable");
  await page.getByRole("button", { name: "Claim revenue" }).click();
  await expect(page.locator(".holding")).toContainText("0 mJPY claimable");
  await page.getByLabel("Resale / redeem quantity").fill("5");
  await page.getByRole("button", { name: "List for resale" }).click();
  await page.getByLabel("Demo actor").selectOption("Investor C");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Explore", exact: true })
    .click();
  await page.getByLabel("Purchase quantity").fill("5");
  await page
    .getByRole("button", { name: "Acquire right", exact: true })
    .last()
    .click();
  await page
    .locator(".asset-card")
    .filter({ hasText: "Kanda Community Solar" })
    .click();
  await page.getByLabel("I have reviewed the rights and their terms.").check();
  await page.getByLabel("Purchase quantity").fill("5");
  await page
    .getByRole("button", { name: "Acquire right", exact: true })
    .click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Compose" })
    .click();
  await page.locator(".underlying input").nth(0).check();
  await page.locator(".underlying input").nth(1).check();
  await page.getByRole("button", { name: "Create basket definition" }).click();
  await page.getByRole("button", { name: "Deposit & mint" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Portfolio" })
    .click();
  const basket = page
    .locator(".holding")
    .filter({ hasText: "Tokyo Solar Basket" });
  await expect(basket).toContainText("5 units held");
  await basket.getByRole("button", { name: "Redeem", exact: true }).click();
  await expect(basket).toHaveCount(0);
});
test("initial city is clearly simulated and mobile is usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByText("Test assets only.", { exact: false }),
  ).toBeVisible();
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
});
test("register, verify, issue an exclusive rooftop and reject a conflicting use", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Demo actor").selectOption("Owner A");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Tokenize", exact: true })
    .click();
  await page
    .getByLabel("Asset name", { exact: true })
    .fill("Spatial conflict demo roof");
  await page
    .getByLabel("Right type", { exact: true })
    .selectOption("Usage Right");
  await page.getByLabel("Right supply", { exact: true }).fill("1");
  await page
    .getByRole("button", { name: "Register demo asset", exact: true })
    .click();
  let card = page
    .locator(".workflow-card")
    .filter({ hasText: "Spatial conflict demo roof" });
  await card.getByRole("button", { name: "Submit for verification" }).click();
  await page.getByLabel("Demo actor").selectOption("Demo verifier");
  await card
    .getByRole("button", { name: "Demo verify asset", exact: true })
    .click();
  await page.getByLabel("Demo actor").selectOption("Owner A");
  await card
    .getByRole("button", { name: "Issue right from form terms" })
    .click();
  await page.getByLabel("Demo actor").selectOption("Demo verifier");
  await card
    .getByRole("button", { name: "Demo verify right", exact: true })
    .click();
  await page.getByLabel("Demo actor").selectOption("Owner A");
  await page.getByLabel("Purpose (canonical label)").fill("RESTAURANT");
  await card
    .getByRole("button", { name: "Issue right from form terms" })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Spatial Right Conflict" }),
  ).toContainText("Spatial Right Conflict");
});
test("3D map mounts, scoped opportunity filters and X-ray remain interactive", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".map-pin")).toHaveCount(3, { timeout: 30000 });
  await page.getByRole("button", { name: "City X-ray" }).click();
  await expect(page.getByText("URBAN RIGHTS / X-RAY")).toBeVisible();
  await page.getByRole("button", { name: "Vacant Home", exact: true }).click();
  await expect(page.locator(".map-pin")).toHaveCount(1);
  await expect(page.locator(".asset-card")).toHaveCount(1);
});
