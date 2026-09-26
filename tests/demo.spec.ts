import { test, expect } from "@playwright/test";
import { DEMO_SITES } from "../src/lib/demo-catalog";
test("buy, activate, deposit, claim, secondary trade, custody and basket redemption", async ({
  page,
}) => {
  await page.goto("/?theme=original");
  await expect(
    page.getByRole("heading", { name: "Explore", exact: true }),
  ).toBeAttached();
  await page.getByLabel("I have reviewed the rights and their terms.").check();
  await page.getByLabel("Purchase quantity").fill("10");
  await page
    .getByRole("button", { name: "Acquire right", exact: true })
    .click();
  await expect(page.locator(".feedback[role='status']")).toContainText(
    "simulated successfully",
  );
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "My assets" })
    .click();
  await expect(page.locator(".holding")).toContainText("10 units held");
  await page.getByLabel("Demo role").selectOption("Demo verifier");
  await page
    .getByRole("button", { name: "Tokenize a space", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Activate project", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Deposit revenue", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Close tokenization", exact: true })
    .click();
  await page.getByLabel("Demo role").selectOption("Investor B");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "My assets" })
    .click();
  await expect(page.locator(".holding")).toContainText("1,000 mJPY claimable");
  await page.getByRole("button", { name: "Claim revenue" }).click();
  await expect(page.locator(".holding")).toContainText("0 mJPY claimable");
  await page.getByLabel("Resale / redeem quantity").fill("5");
  await page.getByRole("button", { name: "List for resale" }).click();
  await page.getByLabel("Demo role").selectOption("Investor C");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Explore", exact: true })
    .click();
  await page.getByLabel("I have reviewed the rights and their terms.").check();
  await page.getByLabel("Purchase quantity").fill("5");
  await page
    .getByRole("button", { name: "Acquire right", exact: true })
    .last()
    .click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Markets", exact: true })
    .click();
  const directory = page.getByRole("region", { name: "Asset directory" });
  await directory.getByLabel("Find a space").fill("Kanda Community Solar");
  await directory
    .getByRole("button", {
      name: "View Kanda Community Solar on map",
      exact: true,
    })
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
  await page
    .getByLabel("Basket name", { exact: true })
    .fill("Tokyo Solar Basket");
  await page.getByRole("button", { name: "Save basket plan" }).click();
  await page
    .getByText("Add your rights to this basket", { exact: true })
    .click();
  await page.getByLabel("Shares to receive").fill("5");
  await page
    .getByRole("button", { name: "Deposit rights & receive shares" })
    .click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "My assets" })
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
  await page.goto("/?theme=original");
  await expect(
    page.getByText("Demo simulation · no on-chain transactions", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
});
test("register, verify, issue an exclusive rooftop and reject a conflicting use", async ({
  page,
}) => {
  await page.goto("/?theme=original");
  await page.getByLabel("Demo role").selectOption("Owner A");
  await page
    .getByRole("button", { name: "Tokenize a space", exact: true })
    .click();
  await page
    .getByLabel("Asset name", { exact: true })
    .fill("Spatial conflict demo roof");
  await page.getByRole("button", { name: "Continue to rights" }).click();
  await page
    .getByLabel("Right type", { exact: true })
    .selectOption("Usage Right");
  await page.getByRole("button", { name: "Review & publish" }).click();
  await page
    .getByRole("button", { name: "Register demo asset", exact: true })
    .click();
  const card = page.locator(".tokenize-focus");
  await card.getByRole("button", { name: "Submit for verification" }).click();
  await page.getByLabel("Demo role").selectOption("Demo verifier");
  await card
    .getByRole("button", { name: "Demo verify asset", exact: true })
    .click();
  await page.getByLabel("Demo role").selectOption("Owner A");
  await card.getByRole("button", { name: "Issue right", exact: true }).click();
  await page.getByLabel("Demo role").selectOption("Demo verifier");
  await card
    .getByRole("button", { name: "Demo verify right", exact: true })
    .click();
  await page.getByLabel("Demo role").selectOption("Owner A");
  await page
    .getByRole("button", { name: "Create another right", exact: true })
    .click();
  await page.getByText("Terms & advanced settings", { exact: true }).click();
  await page.getByLabel("Purpose (canonical label)").fill("RESTAURANT");
  await page.getByRole("button", { name: "Review & publish" }).click();
  await card.getByRole("button", { name: "Issue right", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Spatial Right Conflict" }),
  ).toContainText("Spatial Right Conflict");
});
test("3D map mounts, scoped opportunity filters and X-ray remain interactive", async ({
  page,
}) => {
  await page.goto("/?theme=original");
  await expect(page.locator(".map-pin")).toHaveCount(DEMO_SITES.length, {
    timeout: 30000,
  });
  await page.getByRole("button", { name: "City X-ray" }).click();
  await expect(page.getByText("URBAN RIGHTS / X-RAY")).toBeVisible();
  await page.getByRole("button", { name: "Vacant Home", exact: true }).click();
  const markers = page.locator(".map-pin:visible");
  // MapLibre can keep projected markers mounted outside the clipped map.
  // Pick a marker the user can actually hit instead of forcing a hidden one.
  const index = await markers.evaluateAll((elements) =>
    elements.findIndex((element) => {
      const box = element.getBoundingClientRect();
      return element.contains(
        document.elementFromPoint(
          box.x + box.width / 2,
          box.y + box.height / 2,
        ),
      );
    }),
  );
  expect(index).toBeGreaterThanOrEqual(0);
  const marker = markers.nth(index);
  const name = (await marker.getAttribute("aria-label"))!.replace(
    /^Explore /,
    "",
  );
  await marker.click();
  await expect(page.locator(".map-pin")).toHaveCount(
    DEMO_SITES.filter((s) => s.kind === "Vacant Home").length,
  );
  await expect(page.locator(".asset-detail h2")).toHaveText(name);
});
