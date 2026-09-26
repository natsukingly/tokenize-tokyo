import { test, expect } from "@playwright/test";
for (const width of [390, 1512]) {
  test(`return scenarios explain investor and renter economics at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "Markets", exact: true })
      .click();
    await page.getByRole("tab", { name: "Fractional", exact: true }).click();
    const scenario = page.getByRole("region", { name: "Return scenario" });
    await expect(scenario.getByTestId("scenario-roi")).toHaveCount(0);
    await scenario
      .getByLabel("Annual distributable income of entire pool")
      .fill("10000");
    await scenario.getByLabel("Resale price per share").fill("60");
    await scenario.getByLabel("Your total fees and costs").fill("20");
    await expect(scenario.getByTestId("scenario-roi")).toHaveText("+34.62%");
    await expect(scenario).toContainText("42 credits");
    await scenario
      .getByRole("button", { name: "Stress test: no income, no resale" })
      .click();
    await expect(scenario.getByTestId("scenario-roi")).toHaveText("-100%");
    await page.getByRole("tab", { name: "Rental", exact: true }).click();
    await scenario.getByLabel("Revenue from planned use per day").fill("1200");
    await scenario.getByLabel("Operating costs for entire rental").fill("1400");
    await expect(scenario.getByTestId("scenario-roi")).toHaveText("+20%");
    await expect(scenario).toContainText("1,000 credits");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
test("a verified revenue right launches a partial-supply campaign and purchases update funding", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Demo role").selectOption("Owner A");
  await page
    .getByRole("button", { name: "Tokenize a space", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Tokenize a space",
    exact: true,
  });
  await dialog
    .getByLabel("Asset name", { exact: true })
    .fill("Launchpad test roof");
  await dialog.getByRole("button", { name: "Continue to rights" }).click();
  await dialog.getByLabel("Primary price (mJPY)").fill("10");
  await dialog.getByRole("button", { name: "Review & publish" }).click();
  await dialog
    .getByRole("button", { name: "Register demo asset", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Submit for verification", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Switch to Demo verifier" }).click();
  await dialog
    .getByRole("button", { name: "Demo verify asset", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Switch to Owner A" }).click();
  await dialog
    .getByRole("button", { name: "Issue right", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Switch to Demo verifier" }).click();
  await dialog
    .getByRole("button", { name: "Demo verify right", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Switch to Owner A" }).click();
  await dialog.getByLabel("Units to offer").fill("80");
  await expect(dialog).toContainText("Full-subscription target: 800 mJPY");
  await dialog.getByRole("button", { name: "Launch crowdfunding" }).click();
  await dialog.getByRole("button", { name: "View campaign" }).click();
  const card = page
    .getByRole("article")
    .filter({ hasText: "Launchpad test roof" });
  await expect(card).toContainText("800 mJPY full subscription");
  await page.getByLabel("Demo role").selectOption("Investor B");
  await card
    .getByRole("button", { name: "Review rights & participate" })
    .click();
  await page.getByLabel("I have reviewed the rights and their terms.").check();
  await page.getByLabel("Purchase quantity").fill("20");
  await page
    .getByRole("button", { name: "Acquire right", exact: true })
    .click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Markets", exact: true })
    .click();
  await page.getByRole("tab", { name: "Funding", exact: true }).click();
  await expect(card).toContainText("200 mJPY raised");
  await expect(card).toContainText("1 supporting wallets");
  await expect(card.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "25",
  );
});
